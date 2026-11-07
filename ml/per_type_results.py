"""Marks-model results per assessment type, from the SAVED model (no retraining).

The app predicts quizzes and assignments only (it has no exams), so error on those types
is the evaluation that matches the deployed use; both are reported, never just one.
Rebuilds the exact test set of train_learning_analysis.py (same data, same seed 42) and
scores the saved model on it.

    python per_type_results.py   (writes reports/per_type_results.json, adds it to
                                  evaluation_report.json and refreshes the model cards)
"""
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit

from _paths import DATA, MODELS, REPORTS, require
from oulad_features import build_learning_frame, presentation_groups, vle_weeks

SEED = 42
NAMES = {'CMA': 'quizzes (computer-marked)', 'TMA': 'assignments (tutor-marked)', 'Exam': 'exams'}


def metrics(part: pd.DataFrame, pred) -> dict:
    y, b = part['target'].to_numpy(), part['baseline'].to_numpy()
    mae, base = float(mean_absolute_error(y, pred)), float(mean_absolute_error(y, b))
    return {'n': int(len(part)), 'mae': mae, 'r2': float(r2_score(y, pred)) if len(part) > 1 else None,
            'baseline_mae': base, 'improvement_pct': 100 * (base - mae) / base if base else None}


def per_type(test: pd.DataFrame, pred) -> dict:
    pred = np.asarray(pred)
    out = {'all': metrics(test, pred)}
    for t in ('CMA', 'TMA', 'Exam'):
        m = (test['target_type'] == t).to_numpy()
        if m.sum() >= 30:
            out[t] = {'label': NAMES[t], **metrics(test[m], pred[m])}
    cw = test['target_type'].isin(['CMA', 'TMA']).to_numpy()
    if cw.sum() >= 30:
        out['coursework'] = {'label': 'quizzes + assignments (what the app predicts)', **metrics(test[cw], pred[cw])}
    return out


def main():
    require('studentAssessment.csv', 'assessments.csv', 'studentVle.csv')
    artifact = joblib.load(MODELS / 'learning_analysis_v1.pkl')
    sa = pd.read_csv(DATA / 'studentAssessment.csv', na_values=['?'])
    a = pd.read_csv(DATA / 'assessments.csv', na_values=['?'])
    vle = pd.read_csv(DATA / 'studentVle.csv', usecols=['id_student', 'code_module', 'code_presentation', 'date'])
    frame = build_learning_frame(sa, a, target='next', weeks_by_key=vle_weeks(vle))
    groups = presentation_groups(frame)
    _, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
    test = frame.iloc[te]
    pred = artifact['model'].predict(test[artifact['features']])
    result = {'source': 'saved model, rebuilt test set (seed 42)', 'model_version': artifact.get('trained_at'), **per_type(test, pred)}
    saved = REPORTS / 'learning_test.pkl'
    if saved.exists():   # sanity check: the rebuilt test set must reproduce the saved predictions
        old = joblib.load(saved)
        result['matches_saved_test'] = bool(len(old['y_test']) == len(test) and np.allclose(old['predictions'], pred, atol=1e-4))
    (REPORTS / 'per_type_results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    report_path = REPORTS / 'evaluation_report.json'
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding='utf-8'))
        report.setdefault('learning_analysis', {})['by_assessment_type'] = result
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        from make_model_cards import write_model_cards
        write_model_cards(report)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
