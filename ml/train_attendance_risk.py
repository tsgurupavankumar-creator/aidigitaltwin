"""Train the attendance-risk model: predict Fail/Withdrawn from ONLINE PRESENCE
(weeks with any VLE activity) observed up to an early cut-off week.

OULAD has no attendance records, so this is a stand-in and is reported as one.
It contains no assessment scores, and students who had already left before the
cut-off are excluded. See oulad_features.py.

Protocol (nothing is tuned on the test set):
  1. Split by module presentation into train / test.
  2. Inside train, hold out 25% of presentations as validation; fit there and
     choose the alert threshold on validation (highest threshold reaching
     recall 0.70, see evaluation_extras.choose_threshold). The baseline (absence
     rate alone) gets its threshold the same way.
  3. Refit on all of train; report on test at the chosen threshold.
Version 4 adds what is known about the student's assessed work by the cut-off
(early average score, assessed / missed / late counts), isotonic calibration
fitted on validation, a second baseline (early score alone; the model is
compared with the stronger baseline) and an accuracy-vs-prediction-week curve.
Also reported: repeated presentation splits, a 2013 -> 2014 time split,
calibration (Brier score, reliability) and subgroup fairness.
"""
import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier

from _paths import DATA, MODELS, REPORTS, require
from evaluation_extras import (DEFAULT_PARAMS, FAIRNESS_COLUMNS, calibration, choose_threshold, fairness_classification,
                               per_course_classification, stamp,
                               repeated_splits, temporal_split, tune, validation_split)
from oulad_features import (ATTENDANCE_FEATURES, KEY, assessment_history, build_attendance_frame, presentation_groups,
                            vle_weeks)

SEED = 42
REPEATS = int(os.environ.get('ML_REPEATS', '5'))
CURVE_WEEKS = (4, 6, 8, 10, 12)


def classification_metrics(y_true, y_pred, y_prob) -> dict:
    return {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true, y_pred, zero_division=0)),
        'f1': float(f1_score(y_true, y_pred, zero_division=0)),
        'auc': float(roc_auc_score(y_true, y_prob)),
    }


def new_model(**params):
    params = params or DEFAULT_PARAMS
    return XGBClassifier(eval_metric='logloss', random_state=SEED, **params)


class Calibrated:
    """XGBoost model plus an isotonic map from its raw score to an observed
    at-risk rate, both fitted without touching the test set."""

    def __init__(self, model, calibrator):
        self.model, self.calibrator = model, calibrator
        self.params, self.tuning, self.fairness = DEFAULT_PARAMS, [], {}

    def probability(self, frame: pd.DataFrame):
        raw = self.model.predict_proba(frame[ATTENDANCE_FEATURES])[:, 1]
        return self.calibrator.predict(raw)


def score_baseline(frame: pd.DataFrame, fill: float):
    """Second baseline: early average score alone (lower score = higher risk)."""
    return -frame['earlyAvgScore'].fillna(fill).to_numpy()


FAIR_GROUP = 'gender'
FAIR_MIN_GAP_REDUCTION = 0.25     # keep reweighing only if it cuts the false-alarm gap by >= 25% on validation
FAIR_MAX_AUC_LOSS = 0.01          # ... while losing at most 0.01 AUC on validation


def reweighing_weights(frame: pd.DataFrame, group: str = FAIR_GROUP):
    """Kamiran & Calders reweighing: weight w(g, y) = P(g) P(y) / P(g, y), so that group and outcome are
    independent in the weighted training data. Uses the group ONLY in training; the model never sees it."""
    if group not in frame:
        return None
    g, y = frame[group].astype(str), frame['target']
    p_g, p_y, p_gy = g.value_counts(normalize=True), y.value_counts(normalize=True), pd.crosstab(g, y, normalize=True)
    return np.array([p_g[gi] * p_y[yi] / p_gy.loc[gi, yi] for gi, yi in zip(g, y)])


def fpr_gap(frame: pd.DataFrame, pred, group: str = FAIR_GROUP):
    """Largest difference in false-positive rate between groups (rows with a known group only)."""
    if group not in frame:
        return None
    rates = []
    for _, idx in frame.groupby(frame[group].astype(str)).indices.items():
        y = frame['target'].to_numpy()[idx]; p = np.asarray(pred)[idx]
        neg = (y == 0)
        if neg.sum() >= 30:
            rates.append(float(((p == 1) & neg).sum() / neg.sum()))
    return max(rates) - min(rates) if len(rates) > 1 else None


def fit_with_threshold(train: pd.DataFrame):
    """Within TRAIN: fit on 75% of presentations, calibrate and choose thresholds on the other 25%.
    The deployed model is exactly this one, so calibration and threshold match what is served."""
    fit, val = validation_split(train, presentation_groups(train), SEED)
    if val['target'].nunique() < 2 or fit['target'].nunique() < 2:
        raise ValueError('validation split has one class only')
    auc = lambda y, m, X: roc_auc_score(y, m.predict_proba(X)[:, 1])
    params, table = tune(new_model, fit[ATTENDANCE_FEATURES], fit['target'], val[ATTENDANCE_FEATURES], val['target'], auc)

    def candidate(weights):
        model = new_model(**params).fit(fit[ATTENDANCE_FEATURES], fit['target'], sample_weight=weights)
        raw_val = model.predict_proba(val[ATTENDANCE_FEATURES])[:, 1]
        cal = Calibrated(model, IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1).fit(raw_val, val['target']))
        prob = cal.probability(val)
        t = choose_threshold(val['target'], prob)
        pred = (prob >= t['threshold']).astype(int)
        return cal, t, {'auc': float(roc_auc_score(val['target'], prob)), 'fpr_gap': fpr_gap(val, pred)}

    plain, plain_t, plain_v = candidate(None)
    weights = reweighing_weights(fit)
    decision = {'rule': f'reweighing kept only if validation false-alarm gap falls by >= {FAIR_MIN_GAP_REDUCTION:.0%} '
                        f'and validation AUC drops by <= {FAIR_MAX_AUC_LOSS}', 'plain_validation': plain_v}
    calibrated, model_t, used = plain, plain_t, False
    if weights is not None and plain_v['fpr_gap']:
        fair, fair_t, fair_v = candidate(weights)
        decision['reweighed_validation'] = fair_v
        if (fair_v['fpr_gap'] is not None and fair_v['fpr_gap'] <= (1 - FAIR_MIN_GAP_REDUCTION) * plain_v['fpr_gap']
                and plain_v['auc'] - fair_v['auc'] <= FAIR_MAX_AUC_LOSS):
            calibrated, model_t, used = fair, fair_t, True
    decision['reweighing_used'] = used
    calibrated.params, calibrated.tuning, calibrated.fairness = params, table, decision
    baseline_t = choose_threshold(val['target'], val['absenceRate'])
    fill = float(fit['earlyAvgScore'].median()) if fit['earlyAvgScore'].notna().any() else 0.0
    return calibrated, model_t, baseline_t, fill


def score(model: Calibrated, model_t, baseline_t, test: pd.DataFrame):
    if test['target'].nunique() < 2:
        raise ValueError('test split has one class only')
    prob = model.probability(test)
    pred = (prob >= model_t['threshold']).astype(int)
    base_scores = test['absenceRate'].to_numpy()
    base_pred = (base_scores >= baseline_t['threshold']).astype(int)
    return prob, pred, base_scores, base_pred


def evaluate_split(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    model, mt, bt, fill = fit_with_threshold(train)
    prob, pred, bs, bp = score(model, mt, bt, test)
    m = classification_metrics(test['target'], pred, prob)
    b = classification_metrics(test['target'], bp, bs)
    score_auc = float(roc_auc_score(test['target'], score_baseline(test, fill)))
    best = max(b['auc'], score_auc)
    return {'model_auc': m['auc'], 'model_recall': m['recall'], 'model_precision': m['precision'], 'model_f1': m['f1'],
            'baseline_auc': b['auc'], 'baseline_recall': b['recall'], 'baseline_precision': b['precision'], 'baseline_f1': b['f1'],
            'score_baseline_auc': score_auc, 'best_baseline_auc': best, 'auc_gain': m['auc'] - best}


def fairness_diagnosis(test: pd.DataFrame, prob, pred, group: str = FAIR_GROUP) -> dict:
    """Step 1: why do false alarms differ between groups? Per group: calibration (mean predicted risk vs
    observed rate), false-positive rate, the average inputs of false alarms vs correctly-left-alone students,
    and the false-alarm rate per course (module)."""
    if group not in test:
        return {}
    df = test.assign(_prob=np.asarray(prob), _pred=np.asarray(pred))
    out = {}
    for g, part in df.groupby(df[group].astype(str)):
        neg = part[part['target'] == 0]
        fp, tn = neg[neg['_pred'] == 1], neg[neg['_pred'] == 0]
        out[g] = {
            'n': int(len(part)),
            'mean_predicted_risk': float(part['_prob'].mean()),
            'observed_rate': float(part['target'].mean()),
            'false_positive_rate': float(len(fp) / len(neg)) if len(neg) else None,
            'false_alarms_avg_inputs': {f: float(fp[f].mean()) for f in ATTENDANCE_FEATURES} if len(fp) else {},
            'correctly_cleared_avg_inputs': {f: float(tn[f].mean()) for f in ATTENDANCE_FEATURES} if len(tn) else {},
        }
    by_module = {}
    for (mod, g), part in df.groupby([df['code_module'], df[group].astype(str)]):
        neg = part[part['target'] == 0]
        if len(neg) >= 30:
            by_module.setdefault(mod, {})[g] = {'negatives': int(len(neg)), 'false_positive_rate': float((neg['_pred'] == 1).mean()),
                                                'share_of_group': float(len(part) / max(1, (df[group].astype(str) == g).sum()))}
    out['by_course'] = by_module
    return out


def cutoff_curve(info, weeks_by_key, registration, history) -> list[dict]:
    """AUC when everyone is predicted at the same week: accuracy vs how early the warning comes."""
    rows = []
    for w in CURVE_WEEKS:
        frame = build_attendance_frame(info, weeks_by_key, registration, seed=SEED, fixed_weeks=w, history=history)
        demographics = [c for c in FAIRNESS_COLUMNS if c in info.columns]
        frame = frame.merge(info[KEY + demographics], on=KEY, how='left')
        groups = presentation_groups(frame)
        tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
        try:
            r = evaluate_split(frame.iloc[tr], frame.iloc[te])
            rows.append({'week': w, 'rows': int(len(frame)), **{k: r[k] for k in ('model_auc', 'model_recall', 'model_precision', 'baseline_auc', 'score_baseline_auc', 'auc_gain')}})
        except ValueError as error:
            rows.append({'week': w, 'skipped': str(error)})
        print(f'  week {w}: ' + (f"AUC {rows[-1]['model_auc']:.3f}" if 'model_auc' in rows[-1] else rows[-1]['skipped']))
    return rows


def main():
    require('studentInfo.csv', 'studentVle.csv', 'studentRegistration.csv', 'studentAssessment.csv', 'assessments.csv')
    info = pd.read_csv(DATA / 'studentInfo.csv', na_values=['?'])
    vle = pd.read_csv(DATA / 'studentVle.csv', usecols=['id_student', 'code_module', 'code_presentation', 'date'])
    registration = pd.read_csv(DATA / 'studentRegistration.csv', na_values=['?'])
    student_assessment = pd.read_csv(DATA / 'studentAssessment.csv', na_values=['?'])
    assessments = pd.read_csv(DATA / 'assessments.csv', na_values=['?'])
    print('Preparing activity and assessment history...')
    weeks_by_key = vle_weeks(vle)
    del vle
    history = assessment_history(student_assessment, assessments)
    frame = build_attendance_frame(info, weeks_by_key, registration, seed=SEED, history=history)
    if frame['target'].nunique() < 2:
        raise ValueError('The target must contain both classes.')
    demographics = [c for c in FAIRNESS_COLUMNS if c in info.columns]
    frame = frame.merge(info[KEY + demographics], on=KEY, how='left')

    groups = presentation_groups(frame)
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
    train, test = frame.iloc[train_idx], frame.iloc[test_idx]

    model, model_t, baseline_t, fill = fit_with_threshold(train)
    probabilities, predictions, baseline_scores, baseline_predictions = score(model, model_t, baseline_t, test)
    score_baseline_auc = float(roc_auc_score(test['target'], score_baseline(test, fill)))

    metrics = {'model': 'XGBoost Classifier', 'params': model.params, 'threshold': model_t, **classification_metrics(test['target'], predictions, probabilities)}
    baseline = {'model': 'Baseline: absence rate alone', 'threshold': baseline_t,
                **classification_metrics(test['target'], baseline_predictions, baseline_scores),
                'score_baseline_auc': score_baseline_auc}
    protocol = {
        'version': 7,
        'target': 'final_result in (Fail, Withdrawn)',
        'stand_in': 'attendance = weeks with any VLE activity; OULAD has no attendance records',
        'features': 'online presence and assessed work known before the cut-off (4-12 weeks); early leavers excluded (see ml/oulad_features.py)',
        'calibration': 'isotonic, fitted on the validation split',
        'tuning': 'grid chosen on the validation split by AUC, never on test',
        'fairness': 'class-relative inputs (presence and marks vs the class); Kamiran-Calders reweighing by gender in TRAINING only, kept only if it narrows the validation false-alarm gap enough (see fairness_training)',
        'baselines': 'absence rate alone; early average score alone (model is compared with the stronger)',
        'split': 'GroupShuffleSplit by module presentation, test_size=0.2, seed 42',
        'threshold_rule': 'chosen on a validation split of the training presentations, never on test',
        'rows': {'train': int(len(train)), 'test': int(len(test))},
        'positive_rate_test': float(test['target'].mean()),
        'test_presentations': sorted(groups.iloc[test_idx].unique().tolist()),
    }

    print(f'Repeated presentation splits ({REPEATS})...')
    repeated = repeated_splits(frame, groups, REPEATS, SEED + 1, evaluate_split)
    temporal = None
    split = temporal_split(frame)
    if split:
        print('2013 -> 2014 time split...')
        try:
            temporal = {'train': '2013 presentations', 'test': '2014 presentations', **evaluate_split(*split)}
        except ValueError as error:
            temporal = {'skipped': str(error)}
    extras = {
        'fairness_training': model.fairness,
        'fairness_diagnosis': fairness_diagnosis(test, probabilities, predictions),
        'calibration': calibration(test['target'], probabilities),
        'fairness': fairness_classification(test, 'target', predictions, probabilities),
        'by_course': per_course_classification(test, predictions, probabilities),
        'repeated_splits': repeated,
        'temporal_split': temporal,
    }
    print('Accuracy vs prediction week...')
    extras['cutoff_curve'] = cutoff_curve(info, weeks_by_key, registration, history)
    extras['tuning'] = model.tuning
    extras['fairness_training'] = model.fairness
    extras['params'] = model.params

    joblib.dump({'model': model.model, 'calibrator': model.calibrator, 'params': model.params, 'fairness': model.fairness, 'trained_at': stamp(), 'features': ATTENDANCE_FEATURES, 'threshold': model_t['threshold'], 'metrics': metrics,
                 'baseline': baseline, 'protocol': protocol}, MODELS / 'attendance_risk_v1.pkl')
    joblib.dump({'y_test': test['target'].to_numpy(), 'predictions': predictions, 'probabilities': probabilities,
                 'baseline_scores': baseline_scores, 'baseline_predictions': baseline_predictions,
                 'threshold': model_t['threshold'], 'baseline_threshold': baseline_t['threshold'], 'score_baseline_auc': score_baseline_auc,
                 'protocol': protocol}, REPORTS / 'attendance_test.pkl')
    (REPORTS / 'attendance_extras.json').write_text(json.dumps(extras, indent=2), encoding='utf-8')
    print(json.dumps({'model': metrics, 'baseline': baseline, 'protocol': protocol,
                      'repeated_splits': repeated, 'temporal_split': temporal}, indent=2))


if __name__ == '__main__':
    main()
