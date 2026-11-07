"""AI digital twin vs the "traditional dashboard", judged on REAL outcomes (OULAD).

The app's own comparison (npm run report:comparison) can only grade itself against a
mastery-based proxy on the few students in the database. This runs the same comparison on
the OULAD test presentations, where the real outcome (failed or withdrew) is known.

Traditional dashboard: exactly the app's rules (scripts/lib/comparison-metrics.ts):
    flag if attendance < 75%  OR  most recent quiz < 50%  OR  >= 2 missed assignments
    (OULAD stand-ins: weekly online presence; computer-marked assessments as quizzes;
     tutor-marked assignments due before the cut-off with nothing handed in)
AI (a) early-warning model: calibrated probability >= its validation-chosen threshold.
AI (b) app risk level: HIGH or CRITICAL from the deployed models and models/risk_config.json
     (knowledge-gap part not available on OULAD; the app renormalises without it).
Truth: final_result is Fail or Withdrawn.

Uses the deployed models as they are (no retraining) on the same test presentations as
train_attendance_risk.py, which those models never saw. Writes reports/ai_vs_traditional.json,
adds it to evaluation_report.json and refreshes the model cards.

    python compare_ai_vs_traditional.py
"""
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from _paths import DATA, MODELS, REPORTS, require
from calibrate_risk_score import learning_at_cutoff
from oulad_features import (ATTENDANCE_FEATURES, KEY, LEARNING_FEATURES, assessment_history, build_attendance_frame,
                            class_means, presentation_groups, vle_weeks)

SEED = 42
RULE_ATTENDANCE, RULE_QUIZ, RULE_MISSED = 75, 50, 2      # same as the app's traditional dashboard
WEEKS = (4, 6, 8, 10, 12)


def latest_quiz_before(by_key, key, cutoff_day):
    known = [r for r in by_key.get(key, []) if r['assessment_type'] == 'CMA' and pd.notna(r['score'])
             and pd.notna(r['date_submitted']) and r['date_submitted'] < cutoff_day]
    return max(known, key=lambda r: r['date_submitted'])['score'] if known else np.nan


def traditional_flags(frame: pd.DataFrame, by_key) -> np.ndarray:
    quiz = np.array([latest_quiz_before(by_key, tuple(k), w * 7)
                     for k, w in zip(frame[KEY].itertuples(index=False), frame['attendanceCount'])])
    return ((frame['currentAttendance'].to_numpy() < RULE_ATTENDANCE)
            | (np.nan_to_num(quiz, nan=100) < RULE_QUIZ)
            | (frame['earlyMissedCount'].to_numpy() >= RULE_MISSED)).astype(int)


def ai_flags(frame: pd.DataFrame, artifact) -> tuple[np.ndarray, np.ndarray]:
    raw = artifact['model'].predict_proba(frame[ATTENDANCE_FEATURES])[:, 1]
    prob = artifact['calibrator'].predict(raw) if artifact.get('calibrator') is not None else raw
    return (prob >= artifact.get('threshold', 0.5)).astype(int), prob


def risk_level_flags(frame: pd.DataFrame, att_prob, learn_artifact, config) -> np.ndarray:
    has = frame['avgMastery'].notna().to_numpy() if 'avgMastery' in frame else np.zeros(len(frame), bool)
    pred = np.full(len(frame), np.nan)
    if has.any():
        pred[has] = np.clip(learn_artifact['model'].predict(frame.loc[has, LEARNING_FEATURES]), 0, 100)
    w = config['weights']
    x, y = config['learningRiskMap']['x'], config['learningRiskMap']['y']
    lrisk = np.interp(np.nan_to_num(pred), x, y)
    score = 100 * np.where(np.isnan(pred), att_prob,
                           (w['attendance'] * att_prob + w['learning'] * lrisk) / (w['attendance'] + w['learning']))
    return (score >= config['levelCutoffs']['HIGH']).astype(int)


def summary(flags, truth) -> dict:
    f, t = np.asarray(flags).astype(bool), np.asarray(truth).astype(bool)
    tp, fp, fn, tn = int((f & t).sum()), int((f & ~t).sum()), int((~f & t).sum()), int((~f & ~t).sum())
    p = tp / (tp + fp) if tp + fp else None
    r = tp / (tp + fn) if tp + fn else None
    return {'tp': tp, 'fp': fp, 'fn': fn, 'tn': tn, 'accuracy': (tp + tn) / len(t), 'precision': p, 'recall': r,
            'specificity': tn / (tn + fp) if tn + fp else None,
            'f1': 2 * p * r / (p + r) if p and r else None, 'flagged_share': float(f.mean())}


def main():
    require('studentInfo.csv', 'studentVle.csv', 'studentRegistration.csv', 'studentAssessment.csv', 'assessments.csv')
    att = joblib.load(MODELS / 'attendance_risk_v1.pkl')
    learn = joblib.load(MODELS / 'learning_analysis_v1.pkl')
    config = json.loads((MODELS / 'risk_config.json').read_text()) if (MODELS / 'risk_config.json').exists() else None
    info = pd.read_csv(DATA / 'studentInfo.csv', na_values=['?'])
    registration = pd.read_csv(DATA / 'studentRegistration.csv', na_values=['?'])
    sa = pd.read_csv(DATA / 'studentAssessment.csv', na_values=['?'])
    a = pd.read_csv(DATA / 'assessments.csv', na_values=['?'])
    vle = pd.read_csv(DATA / 'studentVle.csv', usecols=['id_student', 'code_module', 'code_presentation', 'date'])
    print('Preparing students at their cut-off week...', flush=True)
    weeks = vle_weeks(vle)
    del vle
    history = assessment_history(sa, a)

    # Same rows and test presentations as train_attendance_risk.py (per-student cut-off week 4-12).
    frame = build_attendance_frame(info, weeks, registration, seed=SEED, history=history)
    groups = presentation_groups(frame)
    _, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
    test = frame.iloc[te].reset_index(drop=True)
    test_presentations = set(groups.iloc[te])
    truth = test['target'].to_numpy()

    ai, prob = ai_flags(test, att)
    saved = REPORTS / 'attendance_test.pkl'
    matches = None
    if saved.exists():
        s = joblib.load(saved)
        matches = bool(len(s['probabilities']) == len(prob) and np.allclose(s['probabilities'], prob, atol=1e-6))
    trad = traditional_flags(test, history[0])
    result = {
        'purpose': "AI digital twin vs the app's traditional-dashboard rules, judged on real OULAD outcomes",
        'truth': 'final_result is Fail or Withdrawn',
        'traditional_rules': f'attendance < {RULE_ATTENDANCE}% OR most recent quiz < {RULE_QUIZ}% OR >= {RULE_MISSED} missed assignments',
        'test': {'students': int(len(test)), 'at_risk_rate': float(truth.mean()), 'presentations': sorted(test_presentations),
                 'matches_saved_test_predictions': matches},
        'traditional_dashboard': summary(trad, truth),
        'ai_early_warning_model': summary(ai, truth),
    }
    if config:
        print('Adding the app risk level (HIGH/CRITICAL)...', flush=True)
        lc = learning_at_cutoff(info, history, test, a, class_means(sa), weeks)
        test2 = test.merge(lc, on=KEY, how='left')
        result['ai_risk_level_high_or_critical'] = summary(risk_level_flags(test2, prob, learn, config), truth)

    print('Same students predicted at fixed weeks (how early each catches them)...', flush=True)
    per_week, first_ai, first_trad = [], {}, {}
    for w in WEEKS:
        fw = build_attendance_frame(info, weeks, registration, seed=SEED, fixed_weeks=w, history=history)
        fw = fw[presentation_groups(fw).isin(test_presentations)].reset_index(drop=True)
        f_ai, _ = ai_flags(fw, att)
        f_tr = traditional_flags(fw, history[0])
        per_week.append({'week': w, 'students': int(len(fw)), 'traditional': summary(f_tr, fw['target']),
                         'ai_early_warning_model': summary(f_ai, fw['target'])})
        for k, y, fa, ft in zip(fw[KEY].itertuples(index=False), fw['target'], f_ai, f_tr):
            if y == 1:
                if fa and k not in first_ai:
                    first_ai[k] = w
                if ft and k not in first_trad:
                    first_trad[k] = w
    both = set(first_ai) & set(first_trad)
    lead = [first_trad[k] - first_ai[k] for k in both]
    result['by_week'] = per_week
    result['early_detection'] = {
        'students_who_failed_or_withdrew_caught_by_both': len(both),
        'mean_weeks_ai_earlier': float(np.mean(lead)) if lead else None,
        'ai_earlier_share': float(np.mean([d > 0 for d in lead])) if lead else None,
        'same_week_share': float(np.mean([d == 0 for d in lead])) if lead else None,
        'rule_earlier_share': float(np.mean([d < 0 for d in lead])) if lead else None,
        'caught_only_by_ai': len(set(first_ai) - set(first_trad)),
        'caught_only_by_traditional': len(set(first_trad) - set(first_ai)),
        'note': 'first week (4, 6, 8, 10, 12) at which each method flags a student who later failed or withdrew; students who had already left by a week are excluded from that week',
    }
    t, m = result['traditional_dashboard'], result['ai_early_warning_model']
    result['verdict'] = (f"On {len(test)} unseen students: traditional rules precision {t['precision']:.1%}, recall {t['recall']:.1%}, "
                         f"flagging {t['flagged_share']:.0%} of students; AI model precision {m['precision']:.1%}, recall {m['recall']:.1%}, "
                         f"flagging {m['flagged_share']:.0%}.")
    (REPORTS / 'ai_vs_traditional.json').write_text(json.dumps(result, indent=2, default=str), encoding='utf-8')
    rp = REPORTS / 'evaluation_report.json'
    if rp.exists():
        report = json.loads(rp.read_text(encoding='utf-8'))
        report['ai_vs_traditional'] = result
        rp.write_text(json.dumps(report, indent=2, default=str), encoding='utf-8')
        from make_model_cards import write_model_cards
        write_model_cards(report)
    print(result['verdict'])


if __name__ == '__main__':
    main()
