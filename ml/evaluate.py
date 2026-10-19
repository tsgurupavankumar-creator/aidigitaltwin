"""Recompute every reported metric from the saved test predictions and write
reports/evaluation_report.json.

Works with both prediction formats: version 2 (written by the current training
scripts, includes a baseline and the protocol) and the older version 1 files
(no baseline; flagged as such in the report).
"""
from datetime import datetime, timezone
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, mean_absolute_error,
                             mean_squared_error, precision_score, r2_score, recall_score, roc_auc_score)

from _paths import REPORTS


def regression(y, p):
    return {'mae': float(mean_absolute_error(y, p)), 'rmse': float(np.sqrt(mean_squared_error(y, p))),
            'r2': float(r2_score(y, p))}


def classification(y, pred, prob):
    return {'accuracy': float(accuracy_score(y, pred)), 'precision': float(precision_score(y, pred, zero_division=0)),
            'recall': float(recall_score(y, pred, zero_division=0)), 'f1': float(f1_score(y, pred, zero_division=0)),
            'auc': float(roc_auc_score(y, prob)), 'confusion_matrix': confusion_matrix(y, pred).tolist()}


def verdict(name: str, section: dict) -> str:
    """Plain-language comparison with the baseline over the repeated splits."""
    rep = section.get('repeated_splits') or {}
    key = 'mae_improvement_pct' if name == 'learning' else 'auc_gain'
    stats = rep.get(key)
    if not stats:
        return 'not evaluated over repeated splits (version 1 predictions or too little data)'
    lo, mean = stats['mean'] - stats['sd'], stats['mean']
    unit = '% MAE improvement' if name == 'learning' else ' AUC over the stronger baseline'
    d = 2 if name == 'learning' else 3
    if lo > 0:
        return f"beats the baseline consistently: {mean:+.{d}f}{unit} on average over {rep['repeats']} splits (sd {stats['sd']:.{d}f})"
    if mean > 0:
        return f"slightly better than the baseline on average ({mean:+.{d}f}{unit}) but not consistently (sd {stats['sd']:.{d}f})"
    return f"does not beat the baseline ({mean:+.{d}f}{unit} over {rep['repeats']} splits); use the baseline rule"


def main():
    missing = [n for n in ('learning_test.pkl', 'attendance_test.pkl') if not (REPORTS / n).exists()]
    if missing:
        raise SystemExit(f"No test predictions in {REPORTS} ({', '.join(missing)}). "
                         'Run train_learning_analysis.py and train_attendance_risk.py first.')
    learning = joblib.load(REPORTS / 'learning_test.pkl')
    attendance = joblib.load(REPORTS / 'attendance_test.pkl')
    v1_note = ('version 1 predictions: features leak the target and the split is random; '
               'retrain with the current scripts (see ml/README.md)')

    learning_report = {'model': 'XGBoost Regressor', **regression(learning['y_test'], learning['predictions'])}
    if 'baseline' in learning:
        learning_report['baseline'] = {'model': 'mean of earlier scores', **regression(learning['y_test'], learning['baseline'])}
        learning_report['protocol'] = learning.get('protocol')
    else:
        learning_report['protocol'] = v1_note

    attendance_report = {'model': 'XGBoost Classifier',
                         **classification(attendance['y_test'], attendance['predictions'], attendance['probabilities'])}
    if 'threshold' in attendance:
        attendance_report['threshold'] = float(attendance['threshold'])
    if 'baseline_scores' in attendance:
        attendance_report['baseline'] = {'model': 'absence rate alone', **({'threshold': float(attendance['baseline_threshold'])} if 'baseline_threshold' in attendance else {}),
                                         **classification(attendance['y_test'], attendance['baseline_predictions'],
                                                          attendance['baseline_scores'])}
        attendance_report['protocol'] = attendance.get('protocol')
        if 'score_baseline_auc' in attendance:
            attendance_report['baseline']['score_baseline_auc'] = float(attendance['score_baseline_auc'])
    else:
        attendance_report['protocol'] = v1_note.replace('features leak the target', 'attendance is a click/score formula')

    if 'target_type' in learning:
        # The app predicts quizzes and assignments only (no exams): report per type as well as overall.
        from per_type_results import per_type
        test = pd.DataFrame({'target': learning['y_test'], 'baseline': learning['baseline'], 'target_type': learning['target_type']})
        learning_report['by_assessment_type'] = {'source': 'saved test predictions', **per_type(test, learning['predictions'])}

    for name, section in (('learning', learning_report), ('attendance', attendance_report)):
        extras_file = REPORTS / f'{name}_extras.json'
        if extras_file.exists() and isinstance(section.get('protocol'), dict):
            section.update(json.loads(extras_file.read_text(encoding='utf-8')))
        section['verdict'] = verdict(name, section)

    report = {
        'learning_analysis': learning_report,
        'attendance_risk': attendance_report,
        'combined_risk': (json.loads((REPORTS / 'risk_score.json').read_text(encoding='utf-8'))
                          if (REPORTS / 'risk_score.json').exists() else 'not run: python calibrate_risk_score.py'),
        'knowledge_gap': {'method': 'Prerequisite graph traversal + mastery rules', 'coverage': None,
                          'note': 'rule-based; not evaluated (OULAD has no concept data)'},
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS / 'evaluation_report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    from make_model_cards import write_model_cards
    print('Model cards:', ', '.join(write_model_cards(report)))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
