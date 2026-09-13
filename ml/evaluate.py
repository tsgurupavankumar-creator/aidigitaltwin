from datetime import datetime, timezone
from pathlib import Path
import json
import joblib
import numpy as np
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, mean_absolute_error, mean_squared_error, precision_score, r2_score, recall_score, roc_auc_score

ROOT = Path(__file__).resolve().parent
REPORTS = ROOT / 'reports'
REPORTS.mkdir(exist_ok=True)


def main():
    learning = joblib.load(REPORTS / 'learning_test.pkl')
    attendance = joblib.load(REPORTS / 'attendance_test.pkl')
    report = {
        'learning_analysis': {
            'model': 'XGBoost Regressor',
            'mae': float(mean_absolute_error(learning['y_test'], learning['predictions'])),
            'rmse': float(np.sqrt(mean_squared_error(learning['y_test'], learning['predictions']))),
            'r2': float(r2_score(learning['y_test'], learning['predictions'])),
        },
        'attendance_risk': {
            'model': 'XGBoost Classifier',
            'accuracy': float(accuracy_score(attendance['y_test'], attendance['predictions'])),
            'precision': float(precision_score(attendance['y_test'], attendance['predictions'], zero_division=0)),
            'recall': float(recall_score(attendance['y_test'], attendance['predictions'], zero_division=0)),
            'f1': float(f1_score(attendance['y_test'], attendance['predictions'], zero_division=0)),
            'auc': float(roc_auc_score(attendance['y_test'], attendance['probabilities'])),
            'confusion_matrix': confusion_matrix(attendance['y_test'], attendance['predictions']).tolist(),
        },
        'knowledge_gap': {'method': 'Prerequisite graph traversal + mastery rules', 'coverage': None},
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS / 'evaluation_report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
