"""Test the app's combined risk score on OULAD and set its parts from data.

The app combines three risks into one 0-100 score (src/lib/agents/risk-scoring.ts):
early-warning probability, a learning risk, and a knowledge-gap risk, then
labels it LOW / MEDIUM / HIGH / CRITICAL. The weights (0.4 / 0.35 / 0.25), the
learning risk (from a coarse UP / STABLE / DOWN trend) and the level cut-offs
(25 / 45 / 70) were chosen by hand. This script:

  1. Rebuilds every student-presentation at an early cut-off week with what
     both models would know then (the same features the live agents send).
  2. Splits by presentation into train / test, and train into fit / validation.
     Both models are re-fitted on FIT only, with the settings saved by the
     training scripts, so nothing below is scored on data a model has seen.
  3. On VALIDATION: learns the learning risk from the predicted mark
     (isotonic: predicted mark -> observed fail/withdraw rate), the weight
     between early-warning and learning risk (best AUC), and the level
     cut-offs, so that LOW / MEDIUM / HIGH / CRITICAL mean an observed
     fail-or-withdraw rate below 25% / 25-50% / 50-75% / above 75%.
  4. On TEST: compares the hand-set formula with the data-driven one (AUC, and
     the observed fail-or-withdraw rate inside each level).

OULAD has no concept data, so the knowledge-gap part cannot be tested here; it
keeps its hand-set share (0.35) and is reported as untested.

Writes ml/models/risk_config.json (read by the app; without it the app keeps
the hand-set values) and ml/reports/risk_score.json.

Run after both training scripts:  python calibrate_risk_score.py
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier, XGBRegressor

from _paths import DATA, MODELS, REPORTS, require
from evaluation_extras import DEFAULT_PARAMS, validation_split
from oulad_features import (ATTENDANCE_FEATURES, KEY, LEARNING_FEATURES, assessment_history, build_attendance_frame,
                            build_learning_frame, class_means, context_features, history_features,
                            presentation_groups, vle_weeks)

SEED = 42
KNOWLEDGE_WEIGHT = 0.35                          # untestable on OULAD; kept as hand-set
HAND_SET = {'weights': {'attendance': 0.40, 'knowledge': 0.35, 'learning': 0.25},
            'trend_risk': {'DOWN': 0.70, 'STABLE': 0.35, 'UP': 0.15},
            'cutoffs': {'MEDIUM': 25, 'HIGH': 45, 'CRITICAL': 70}}
TARGET_RATES = {'MEDIUM': 0.25, 'HIGH': 0.50, 'CRITICAL': 0.75}


def learning_at_cutoff(info: pd.DataFrame, history, frame: pd.DataFrame, assessments: pd.DataFrame,
                       means: dict, weeks_by_key: dict) -> pd.DataFrame:
    """Learning features from work known before each row's cut-off (NaN when nothing is scored yet).
    The predicted assessment is the next one due after the cut-off in that presentation."""
    by_key, tma_due = history
    a = assessments.assign(date=pd.to_numeric(assessments['date'], errors='coerce')).dropna(subset=['date'])
    schedule = {k: sorted(zip(g['date'], g['assessment_type'])) for k, g in a.groupby(['code_module', 'code_presentation'])}
    cut_by_key = {tuple(k): int(w) * 7 for k, w in zip(frame[KEY].itertuples(index=False), frame['attendanceCount'])}
    rows = []
    for key, cutoff_day in cut_by_key.items():
        subs = [r for r in by_key.get(key, []) if pd.notna(r['date_submitted']) and r['date_submitted'] < cutoff_day]
        known = pd.DataFrame(subs)
        scored = known.dropna(subset=['score']) if not known.empty else known
        if scored.empty:
            rows.append(dict(zip(KEY, key)))
            continue
        scored = scored.assign(order_date=pd.to_numeric(scored['date'], errors='coerce').fillna(scored['date_submitted']))
        scored = scored.sort_values(['order_date', 'id_assessment'])
        feats = history_features(scored, tma_due.get((key[1], key[2]), []), float(cutoff_day), set(known['id_assessment']))
        upcoming = [t for d, t in schedule.get((key[1], key[2]), []) if d >= cutoff_day]
        feats.update(context_features(scored, upcoming[0] if upcoming else 'CMA', float(cutoff_day), means, weeks_by_key.get(key, set())))
        rows.append({**dict(zip(KEY, key)), **{k: v for k, v in feats.items() if k != 'baseline'}})
    out = pd.DataFrame(rows)
    for column in ('avgQuizScore', 'avgSubmissionScore'):
        if column in out:
            out[column] = out[column].fillna(out['avgMastery'])
    return out


def hand_set_score(att, pred, avg_quiz):
    """Today's formula with no knowledge part (the app renormalises the remaining weights)."""
    w_a, w_l = HAND_SET['weights']['attendance'], HAND_SET['weights']['learning']
    has_l = ~np.isnan(pred)
    trend = np.where(pred > avg_quiz + 3, 'UP', np.where(pred < avg_quiz - 3, 'DOWN', 'STABLE'))
    lrisk = np.vectorize(HAND_SET['trend_risk'].get)(trend)
    score = np.where(has_l, (w_a * att + w_l * lrisk) / (w_a + w_l), att)
    return 100 * score


def level_of(score, cutoffs):
    return np.where(score >= cutoffs['CRITICAL'], 'CRITICAL', np.where(score >= cutoffs['HIGH'], 'HIGH',
                    np.where(score >= cutoffs['MEDIUM'], 'MEDIUM', 'LOW')))


def per_level(y, levels) -> dict:
    out = {}
    for lvl in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'):
        mask = levels == lvl
        out[lvl] = {'n': int(mask.sum()), 'observed_fail_or_withdraw_rate': float(y[mask].mean()) if mask.any() else None}
    return out


def main():
    require('studentInfo.csv', 'studentVle.csv', 'studentRegistration.csv', 'studentAssessment.csv', 'assessments.csv')
    att_artifact = joblib.load(MODELS / 'attendance_risk_v1.pkl')
    learn_artifact = joblib.load(MODELS / 'learning_analysis_v1.pkl')
    att_params = att_artifact.get('params', DEFAULT_PARAMS)
    learn_params = learn_artifact.get('params', DEFAULT_PARAMS)

    info = pd.read_csv(DATA / 'studentInfo.csv', na_values=['?'])
    vle = pd.read_csv(DATA / 'studentVle.csv', usecols=['id_student', 'code_module', 'code_presentation', 'date'])
    registration = pd.read_csv(DATA / 'studentRegistration.csv', na_values=['?'])
    student_assessment = pd.read_csv(DATA / 'studentAssessment.csv', na_values=['?'])
    assessments = pd.read_csv(DATA / 'assessments.csv', na_values=['?'])
    print('Preparing students at their cut-off week...')
    weeks = vle_weeks(vle)
    del vle
    history = assessment_history(student_assessment, assessments)
    frame = build_attendance_frame(info, weeks, registration, seed=SEED, history=history)
    means = class_means(student_assessment)
    frame = frame.merge(learning_at_cutoff(info, history, frame, assessments, means, weeks), on=KEY, how='left')

    groups = presentation_groups(frame)
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
    train, test = frame.iloc[tr], frame.iloc[te]
    fit, val = validation_split(train, presentation_groups(train), SEED)
    fit_presentations = set(presentation_groups(fit))

    print('Re-fitting both models on the fit presentations only...')
    att_model = XGBClassifier(eval_metric='logloss', random_state=SEED, **att_params).fit(fit[ATTENDANCE_FEATURES], fit['target'])
    att_cal = IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1).fit(att_model.predict_proba(val[ATTENDANCE_FEATURES])[:, 1], val['target'])
    learning_rows = build_learning_frame(student_assessment, assessments, target='next', weeks_by_key=weeks)
    learning_rows = learning_rows[presentation_groups(learning_rows).isin(fit_presentations)]
    learn_model = XGBRegressor(random_state=SEED, **{'objective': 'reg:squarederror', **learn_params}).fit(learning_rows[LEARNING_FEATURES], learning_rows['target'])

    def signals(part):
        att = att_cal.predict(att_model.predict_proba(part[ATTENDANCE_FEATURES])[:, 1])
        has = part['avgMastery'].notna().to_numpy()
        pred = np.full(len(part), np.nan)
        if has.any():
            pred[has] = np.clip(learn_model.predict(part.loc[has, LEARNING_FEATURES]), 0, 100)
        return att, pred, part['avgQuizScore'].to_numpy(dtype=float)

    att_v, pred_v, quiz_v = signals(val)
    y_v = val['target'].to_numpy()
    has_v = ~np.isnan(pred_v)
    lrisk_map = IsotonicRegression(increasing=False, out_of_bounds='clip', y_min=0, y_max=1).fit(pred_v[has_v], y_v[has_v])

    def combine(att, pred, w):
        lrisk = np.where(np.isnan(pred), np.nan, lrisk_map.predict(np.nan_to_num(pred)))
        return 100 * np.where(np.isnan(pred), att, w * att + (1 - w) * lrisk)

    grid = [round(x, 2) for x in np.arange(0, 1.0001, 0.05)]
    w_auc = [(w, roc_auc_score(y_v, combine(att_v, pred_v, w))) for w in grid]
    best_w, best_auc = max(w_auc, key=lambda t: t[1])
    comp_v = combine(att_v, pred_v, best_w)
    comp_cal = IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1).fit(comp_v, y_v)
    probe = np.linspace(0, 100, 1001)
    probe_rate = comp_cal.predict(probe)
    cutoffs = {}
    for level, rate in TARGET_RATES.items():
        reached = probe[probe_rate >= rate]
        cutoffs[level] = float(round(reached[0], 1)) if len(reached) else 101.0   # 101 = never reached
    for lower, upper in (('MEDIUM', 'HIGH'), ('HIGH', 'CRITICAL')):
        cutoffs[upper] = max(cutoffs[upper], cutoffs[lower])

    print('Comparing on the test presentations...')
    att_t, pred_t, quiz_t = signals(test)
    y_t = test['target'].to_numpy()
    old_t = hand_set_score(att_t, pred_t, quiz_t)
    new_t = combine(att_t, pred_t, best_w)
    result = {
        'rows': {'fit': int(len(fit)), 'validation': int(len(val)), 'test': int(len(test))},
        'with_learning_signal_test': float((~np.isnan(pred_t)).mean()),
        'hand_set': {'auc': float(roc_auc_score(y_t, old_t)), 'levels': per_level(y_t, level_of(old_t, HAND_SET['cutoffs'])),
                     'cutoffs': HAND_SET['cutoffs']},
        'data_driven': {'auc': float(roc_auc_score(y_t, new_t)), 'levels': per_level(y_t, level_of(new_t, cutoffs)),
                        'cutoffs': cutoffs, 'attendance_vs_learning_weight': best_w, 'validation_auc': float(best_auc)},
        'early_warning_alone_auc': float(roc_auc_score(y_t, att_t)),
        'target_rates': TARGET_RATES,
        'knowledge_part': f'not testable on OULAD (no concept data); keeps hand-set weight {KNOWLEDGE_WEIGHT}',
    }
    gain = result['data_driven']['auc'] - result['hand_set']['auc']
    result['verdict'] = (f"data-driven score AUC {result['data_driven']['auc']:.3f} vs hand-set {result['hand_set']['auc']:.3f} "
                         f"({gain:+.3f}); levels now map to observed fail-or-withdraw rates on unseen presentations")

    shares = 1 - KNOWLEDGE_WEIGHT
    config = {
        'version': 1,
        'source': 'ml/calibrate_risk_score.py',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'weights': {'attendance': round(best_w * shares, 4), 'learning': round((1 - best_w) * shares, 4), 'knowledge': KNOWLEDGE_WEIGHT},
        'learningRiskMap': {'x': [float(v) for v in lrisk_map.X_thresholds_], 'y': [float(v) for v in lrisk_map.y_thresholds_]},
        'levelCutoffs': cutoffs,
        'note': 'Learning risk and the attendance/learning weighting are learned on OULAD validation presentations; '
                'level cut-offs map to observed fail-or-withdraw rates of 25/50/75%. The knowledge weight is hand-set and untested.',
    }
    (MODELS / 'risk_config.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    (REPORTS / 'risk_score.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
