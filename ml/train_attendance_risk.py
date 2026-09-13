from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
MODELS = ROOT / 'models'
REPORTS = ROOT / 'reports'
MODELS.mkdir(exist_ok=True)
REPORTS.mkdir(exist_ok=True)
FEATURES = ['currentAttendance', 'recentAttendance', 'attendanceCount', 'absenceRate']


def main():
    required = [DATA / 'studentInfo.csv', DATA / 'studentVle.csv', DATA / 'studentAssessment.csv']
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError('Missing OULAD files: ' + ', '.join(missing))

    info = pd.read_csv(DATA / 'studentInfo.csv')
    vle = pd.read_csv(DATA / 'studentVle.csv')
    assessment = pd.read_csv(DATA / 'studentAssessment.csv')
    vle_by_student = vle.groupby('id_student')['sum_click'].sum()
    assessment_by_student = assessment.groupby('id_student')['score'].mean()
    rows = []
    for _, student in info.iterrows():
        student_id = student['id_student']
        engagement = float(vle_by_student.get(student_id, 0))
        assessment_score = float(assessment_by_student.get(student_id, 0))
        attendance = min(100.0, 45.0 + min(45.0, engagement / 100.0) + assessment_score / 10.0)
        rows.append({
            'studentId': student_id,
            'currentAttendance': attendance,
            'recentAttendance': attendance,
            'attendanceCount': max(1, int(engagement / 20)),
            'absenceRate': 1.0 - attendance / 100.0,
            'target': int(student['final_result'] in ['Fail', 'Withdrawn']),
        })

    frame = pd.DataFrame(rows).fillna(0)
    if frame['target'].nunique() < 2:
        raise ValueError('OULAD attendance target must contain both risk classes.')
    X = frame[FEATURES]
    y = frame['target']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = XGBClassifier(n_estimators=200, max_depth=5, learning_rate=0.05, eval_metric='logloss', random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]
    metrics = {
        'model': 'XGBoost Classifier',
        'accuracy': float(accuracy_score(y_test, predictions)),
        'precision': float(precision_score(y_test, predictions, zero_division=0)),
        'recall': float(recall_score(y_test, predictions, zero_division=0)),
        'f1': float(f1_score(y_test, predictions, zero_division=0)),
        'auc': float(roc_auc_score(y_test, probabilities)),
    }
    joblib.dump({'model': model, 'features': FEATURES, 'metrics': metrics}, MODELS / 'attendance_risk_v1.pkl')
    joblib.dump({'y_test': y_test.to_numpy(), 'predictions': predictions, 'probabilities': probabilities}, REPORTS / 'attendance_test.pkl')
    print(metrics)


if __name__ == '__main__':
    main()
