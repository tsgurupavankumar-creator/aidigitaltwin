const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

async function callModel<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${ML_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Unknown ML service error');
    throw new Error(`ML service ${path} failed (${response.status}): ${message}`);
  }

  return response.json() as Promise<T>;
}

export interface LearningModelPrediction {
  nextExamScore: number;
  confidence: number;
}

export interface AttendanceModelPrediction {
  riskScore: number;
  confidence: number;
}

export function predictLearning(studentId: string, features: Record<string, number>) {
  return callModel<LearningModelPrediction>('/predict/learning', { studentId, features });
}

export function predictAttendance(studentId: string, features: Record<string, number>) {
  return callModel<AttendanceModelPrediction>('/predict/attendance', { studentId, features });
}
