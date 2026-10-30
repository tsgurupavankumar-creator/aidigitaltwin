const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const TIMEOUT_MS = Number.parseInt(process.env.ML_TIMEOUT_MS || '2000', 10);
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 1000;

export async function callML<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${ML_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text().catch(() => 'Unknown ML service error');
        throw new Error(`ML service ${path} failed (${response.status}): ${message}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`ML service ${path} failed`);
}

export interface LearningModelPrediction {
  modelVersion?: string | null;
  low?: number | null;
  high?: number | null;
  reasons?: ModelReason[];
  nextExamScore: number;
  confidence: number;
  modelUsed: 'trained' | 'fallback';
}

export interface ModelReason { feature: string; value: number | null; effect: number }

export interface AttendanceModelPrediction {
  riskScore: number;
  /** e.g. "v7 trained 2026-10-18T12:00:00+00:00" */
  modelVersion?: string | null;
  reasons?: ModelReason[];
  /** Alert threshold chosen in training (version 3 models). Absent for older models. */
  threshold?: number;
  confidence: number;
  modelUsed: 'trained' | 'fallback';
}

export async function predictLearning(
  studentId: string,
  features: Record<string, number | null>
): Promise<LearningModelPrediction> {
  return callML<LearningModelPrediction>('/predict/learning', { studentId, features });
}

export async function predictAttendance(
  studentId: string,
  features: Record<string, number | null>
): Promise<AttendanceModelPrediction> {
  return callML<AttendanceModelPrediction>('/predict/attendance', { studentId, features });
}
