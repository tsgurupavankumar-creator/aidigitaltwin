from pathlib import Path
from typing import Dict
import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
app = FastAPI(title='Academic Digital Twin ML Service', version='1.0.0')


def load_artifact(name: str):
    path = ROOT / 'models' / name
    return joblib.load(path) if path.exists() else None

learning_artifact = load_artifact('learning_analysis_v1.pkl')
attendance_artifact = load_artifact('attendance_risk_v1.pkl')

class PredictRequest(BaseModel):
    studentId: str
    features: Dict[str, float] = Field(default_factory=dict)


def vector(features: Dict[str, float], names):
    return np.array([[float(features.get(name, 0.0)) for name in names]], dtype=float)


def learning_fallback(features: Dict[str, float]):
    score = (features.get('avgMastery', 0) * 0.45 + features.get('avgQuizScore', 0) * 0.35 + features.get('avgSubmissionScore', 0) * 0.20)
    confidence = min(0.75, 0.35 + features.get('quizCount', 0) / 30)
    return max(0.0, min(100.0, score)), confidence


def attendance_fallback(features: Dict[str, float]):
    risk = max(0.0, min(1.0, 1.0 - features.get('currentAttendance', 100) / 100.0))
    confidence = min(0.75, 0.4 + features.get('attendanceCount', 0) / 60)
    return risk, confidence

@app.get('/health')
def health():
    return {'status': 'ok', 'learning_model_loaded': learning_artifact is not None, 'attendance_model_loaded': attendance_artifact is not None}

@app.post('/predict/learning')
def predict_learning(req: PredictRequest):
    if learning_artifact:
        value = float(learning_artifact['model'].predict(vector(req.features, learning_artifact['features']))[0])
        confidence = min(1.0, max(0.0, 0.65 + req.features.get('quizCount', 0) / 50))
    else:
        value, confidence = learning_fallback(req.features)
    return {'studentId': req.studentId, 'nextExamScore': max(0.0, min(100.0, value)), 'confidence': confidence}

@app.post('/predict/attendance')
def predict_attendance(req: PredictRequest):
    if attendance_artifact:
        probability = float(attendance_artifact['model'].predict_proba(vector(req.features, attendance_artifact['features']))[0][1])
        confidence = min(1.0, max(0.0, 0.65 + req.features.get('attendanceCount', 0) / 50))
    else:
        probability, confidence = attendance_fallback(req.features)
    return {'studentId': req.studentId, 'riskScore': probability, 'confidence': confidence}
