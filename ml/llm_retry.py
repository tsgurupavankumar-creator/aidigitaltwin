"""Bounded retries for transient LLM provider failures (without credential logging)."""
import time


def call_with_backoff(call, *, attempts=3, sleep=time.sleep):
    for attempt in range(attempts):
        try:
            return call()
        except Exception as exc:
            status = getattr(exc, 'status_code', None)
            if status not in (408, 429, 500, 502, 503, 504) or attempt == attempts - 1:
                raise
            headers = getattr(getattr(exc, 'response', None), 'headers', {}) or {}
            hint = headers.get('retry-after', '')
            delay = float(hint) if str(hint).isdigit() else 0.5 * (2 ** attempt)
            sleep(min(5.0, delay))
