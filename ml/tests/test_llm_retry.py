import sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from llm_retry import call_with_backoff

class Throttle(Exception):
    status_code = 429
    response = SimpleNamespace(headers={'retry-after': '0'})

def test_retries_two_rate_limits_then_succeeds():
    calls = []
    def request():
        calls.append(1)
        if len(calls) < 3:
            raise Throttle()
        return 'ok'
    assert call_with_backoff(request, sleep=lambda _: None) == 'ok'
    assert len(calls) == 3

def test_permanent_error_not_retried():
    calls = []
    def request():
        calls.append(1)
        raise ValueError('invalid')
    try:
        call_with_backoff(request, sleep=lambda _: None)
    except ValueError:
        pass
    assert len(calls) == 1
