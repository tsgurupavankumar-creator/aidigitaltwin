from pathlib import Path
from typing import Dict, Optional
import logging
import joblib
import numpy as np
from fastapi import FastAPI
import pandas as pd
from pydantic import BaseModel, Field

from evaluation_extras import top_reasons

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ml-service')

ROOT = Path(__file__).resolve().parent
from _paths import MODELS
MODEL_DIRS = (MODELS,)
app = FastAPI(title='Academic Digital Twin ML Service', version='1.0.0')


def load_artifact(name: str):
    for directory in MODEL_DIRS:
        path = directory / name
        if path.exists():
            return joblib.load(path)
    return None

learning_artifact = load_artifact('learning_analysis_v1.pkl')
attendance_artifact = load_artifact('attendance_risk_v1.pkl')

if learning_artifact is None:
    logger.warning('learning_analysis_v1.pkl not found — /predict/learning will use the untrained fallback formula until train_learning_analysis.py is run.')
if attendance_artifact is None:
    logger.warning('attendance_risk_v1.pkl not found — /predict/attendance will use the untrained fallback formula until train_attendance_risk.py is run.')

class PredictRequest(BaseModel):
    studentId: str
    # null = not known yet (e.g. no assessed work so far); passed to XGBoost as missing, never as 0
    features: Dict[str, Optional[float]] = Field(default_factory=dict)


def model_version(artifact) -> str | None:
    """e.g. "v8 trained 2026-10-18T12:00:00+00:00", saved with every prediction for traceability."""
    if not artifact:
        return None
    version = (artifact.get('protocol') or {}).get('version', 1)
    return f"v{version} trained {artifact.get('trained_at', 'unknown')}"


def reasons(artifact, features, risk_up_only):
    """Top 3 features behind this one prediction (exact XGBoost contributions)."""
    try:
        row = pd.DataFrame(vector(features, artifact['features']), columns=artifact['features'])
        return top_reasons(artifact['model'], row, artifact['features'], top=3, risk_up_only=risk_up_only)[0]
    except Exception as error:  # explanations must never break a prediction
        logger.warning('could not compute reasons: %s', error)
        return []


def vector(features: Dict[str, Optional[float]], names):
    return np.array([[np.nan if features.get(name) is None else float(features[name]) for name in names]], dtype=float)


def learning_fallback(features: Dict[str, float]):
    # NOTE: this is a hand-written heuristic, not a trained model. It exists
    # only so the API has something to return during smoke-testing before a
    # real model has been trained — see modelUsed in the response, which
    # callers should check rather than assume a trained model ran.
    score = (features.get('avgMastery', 0) * 0.45 + features.get('avgQuizScore', 0) * 0.35 + features.get('avgSubmissionScore', 0) * 0.20)
    confidence = min(0.75, 0.35 + features.get('quizCount', 0) / 30)
    return max(0.0, min(100.0, score)), confidence


def attendance_fallback(features: Dict[str, float]):
    # See note on learning_fallback above — same caveat applies here.
    risk = max(0.0, min(1.0, 1.0 - features.get('currentAttendance', 100) / 100.0))
    confidence = min(0.75, 0.4 + features.get('attendanceCount', 0) / 60)
    return risk, confidence

@app.get('/health')
def health():
    return {
        'status': 'ok',
        'learning_model_loaded': learning_artifact is not None,
        'attendance_model_loaded': attendance_artifact is not None,
        'learning_model_version': model_version(learning_artifact),
        'attendance_model_version': model_version(attendance_artifact),
    }

@app.post('/predict/learning')
def predict_learning(req: PredictRequest):
    if learning_artifact:
        value = float(learning_artifact['model'].predict(vector(req.features, learning_artifact['features']))[0])
        confidence = min(1.0, max(0.0, 0.65 + (req.features.get('quizCount') or 0) / 50))
        model_used = 'trained'
        ranges = learning_artifact.get('range_80')
        # Version 6: one 80% range per assessment type; version 5: one range.
        if ranges and 'all' in ranges:
            kind = 'Exam' if req.features.get('nextIsExam') else 'TMA' if req.features.get('nextIsAssignment') else 'CMA'
            interval = ranges.get(kind, ranges['all'])
        else:
            interval = ranges
        why = reasons(learning_artifact, req.features, risk_up_only=False)
    else:
        logger.warning('predict_learning called with no trained model for studentId=%s — returning fallback heuristic, not a real prediction.', req.studentId)
        value, confidence = learning_fallback(req.features)
        model_used = 'fallback'
        interval, why = None, []
    return {
        'studentId': req.studentId,
        'nextExamScore': max(0.0, min(100.0, value)),
        # 80% range from validation errors (version 5+): the true mark fell
        # inside it about 80% of the time on held-out data.
        'low': max(0.0, min(100.0, value + interval['low_offset'])) if interval else None,
        'high': max(0.0, min(100.0, value + interval['high_offset'])) if interval else None,
        'reasons': why,
        'confidence': confidence,
        'modelUsed': model_used,
        'modelVersion': model_version(learning_artifact),
    }

@app.post('/predict/attendance')
def predict_attendance(req: PredictRequest):
    if attendance_artifact:
        probability = float(attendance_artifact['model'].predict_proba(vector(req.features, attendance_artifact['features']))[0][1])
        if attendance_artifact.get('calibrator') is not None:
            # Version 4+: map the raw score to an observed at-risk rate (fitted on validation data).
            probability = float(attendance_artifact['calibrator'].predict([probability])[0])
        threshold = float(attendance_artifact.get('threshold', 0.5))
        confidence = min(1.0, max(0.0, 0.65 + (req.features.get('attendanceCount') or 0) / 50))
        model_used = 'trained'
        why = reasons(attendance_artifact, req.features, risk_up_only=True)
    else:
        logger.warning('predict_attendance called with no trained model for studentId=%s — returning fallback heuristic, not a real prediction.', req.studentId)
        probability, confidence = attendance_fallback(req.features)
        threshold = 0.5
        model_used = 'fallback'
        why = []
    return {
        'studentId': req.studentId,
        'riskScore': probability,
        # Alert threshold chosen during training on validation data (version 3
        # models); students at or above it are flagged at risk.
        'threshold': threshold,
        # What pushed this student's risk up most (empty for the fallback).
        'reasons': why,
        'confidence': confidence,
        'modelUsed': model_used,
        'modelVersion': model_version(attendance_artifact),
    }
