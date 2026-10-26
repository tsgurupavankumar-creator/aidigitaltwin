interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil: number | null;
  windowMs: number;
}

export interface RateLimitOptions {
  /** Maximum attempts per window. Defaults to RATE_LIMIT_MAX_ATTEMPTS (5). */
  max?: number;
  /** Window and block length in ms. Defaults to RATE_LIMIT_WINDOW_MS (15 minutes). */
  windowMs?: number;
}

const attempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = Number.parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10);
const WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);

// Entries used to live forever unless the same key came back, so a stream of
// distinct keys (any email address, or a spoofed x-forwarded-for) grew this map
// without bound. Expired entries are now swept at most once a minute.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, record] of attempts) {
    const stillBlocked = record.blockedUntil !== null && now < record.blockedUntil;
    const windowOpen = now - record.firstAttempt <= record.windowMs;
    if (!stillBlocked && !windowOpen) attempts.delete(key);
  }
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
} {
  const max = options.max ?? MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? WINDOW_MS;
  const now = Date.now();
  sweepExpired(now);
  const record = attempts.get(identifier);

  if (!record) {
    attempts.set(identifier, { count: 1, firstAttempt: now, blockedUntil: null, windowMs });
    return { allowed: true, remainingAttempts: Math.max(0, max - 1), retryAfterMs: 0 };
  }

  if (record.blockedUntil && now < record.blockedUntil) {
    return { allowed: false, remainingAttempts: 0, retryAfterMs: record.blockedUntil - now };
  }

  if (now - record.firstAttempt > windowMs) {
    attempts.set(identifier, { count: 1, firstAttempt: now, blockedUntil: null, windowMs });
    return { allowed: true, remainingAttempts: Math.max(0, max - 1), retryAfterMs: 0 };
  }

  record.count += 1;
  if (record.count > max) {
    record.blockedUntil = now + windowMs;
    return { allowed: false, remainingAttempts: 0, retryAfterMs: windowMs };
  }

  return { allowed: true, remainingAttempts: max - record.count, retryAfterMs: 0 };
}

export function resetRateLimit(identifier: string): void {
  attempts.delete(identifier);
}

/** Number of tracked keys. Exported for tests only. */
export function _rateLimitStoreSize(): number {
  return attempts.size;
}
