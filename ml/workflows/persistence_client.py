import os
import time
import uuid
import logging
import httpx

logger = logging.getLogger('workflow-persistence')


def persist_state(state, *, transport=None):
    secret = os.getenv('INTERNAL_SERVICE_SECRET', '')
    url = os.getenv('NEXT_INTERNAL_API_URL', '')
    if len(secret) < 32 or not url.startswith(('http://', 'https://')):
        return {'degraded': True, 'persisted': False, 'errors': state['errors'] + ['Internal persistence not configured']}
    operations = state['operations']
    if not operations:
        return {'degraded': True, 'persisted': False, 'errors': state['errors'] + ['No persistence operations']}
    payload = {'studentId': state['student_id'], 'runId': str(uuid.uuid4()),
               'degraded': state['degraded'], 'operations': operations}
    try:
        with httpx.Client(timeout=8.0, transport=transport) as client:
            for attempt in range(2):
                try:
                    response = client.post(url, json=payload, headers={'x-internal-service-token': secret})
                    if response.status_code == 200:
                        return {'persisted': True}
                    if response.status_code < 500:
                        break
                except httpx.RequestError:
                    pass
                if attempt == 0:
                    time.sleep(1)
    except Exception:
        pass
    logger.warning('Internal persistence failed (credentials redacted)')
    return {'degraded': True, 'persisted': False, 'errors': state['errors'] + ['Internal persistence unavailable']}
