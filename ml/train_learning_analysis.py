from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
MODELS = ROOT / 'models'
REPORTS = ROOT / 'reports'
MODELS.mkdir(exist_ok=True)
REPORTS.mkdir(exist_ok=True)
FEATURES = ['avgMastery', 'avgQuizScore', 'avgSubmissionScore', 'quizCount', 'submissionCount', 'quizTrend']


def main():
    required = [DATA / 'studentInfo.csv', DATA / 'studentVle.csv', DATA / 'studentAssessment.csv']
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError('Missing OULAD files: ' + ', '.join(missing))

    info = pd.read_csv(DATA / 'studentInfo.csv')
    vle = pd.read_csv(DATA / 'studentVle.csv')
    assessment = pd.read_csv(DATA / 'studentAssessment.csv')
    vle_clicks = vle.groupby('id_student')['sum_click'].sum().rename('vleClicks')
    rows = []
    for student_id in info['id_student'].unique():
        scores = assessment.loc[assessment['id_student'] == student_id, 'score'].dropna().astype(float).tolist()
        ordered = assessment[assessment['id_student'] == student_id].sort_values('date_submitted')
        ordered_scores = ordered['score'].dropna().astype(float).tolist()
        rows.append({
            'studentId': student_id,
            'avgMastery': float(np.mean(scores)) if scores else 0.0,
            'avgQuizScore': float(np.mean(scores)) if scores else 0.0,
            'avgSubmissionScore': float(np.mean(scores)) if scores else 0.0,
            'quizCount': len(scores),
            'submissionCount': len(scores),
            'quizTrend': float(ordered_scores[-1] - ordered_scores[0]) if len(ordered_scores) > 1 else 0.0,
            'vleClicks': float(vle_clicks.get(student_id, 0)),
            'target': float(ordered_scores[-1]) if ordered_scores else 0.0,
        })

    frame = pd.DataFrame(rows).fillna(0)
    if len(frame) < 5:
        raise ValueError('At least five OULAD students are required for training.')
    X = frame[FEATURES]
    y = frame['target']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.05, objective='reg:squarederror', random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    metrics = {
        'model': 'XGBoost Regressor',
        'mae': float(mean_absolute_error(y_test, predictions)),
        'rmse': float(np.sqrt(mean_squared_error(y_test, predictions))),
        'r2': float(r2_score(y_test, predictions)),
    }
    joblib.dump({'model': model, 'features': FEATURES, 'metrics': metrics}, MODELS / 'learning_analysis_v1.pkl')
    joblib.dump({'y_test': y_test.to_numpy(), 'predictions': predictions}, REPORTS / 'learning_test.pkl')
    print(metrics)


if __name__ == '__main__':
    main()
