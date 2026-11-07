import sys
from pathlib import Path
import pytest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import server

client = TestClient(server.app)
FIXTURE = Path(__file__).parent / 'fixtures' / 'sample-syllabus.pdf'
TEST_TOKEN = 'test-only-service-token-' + 'x' * 40

@pytest.fixture(autouse=True)
def service_auth(monkeypatch):
    monkeypatch.setenv('INTERNAL_SERVICE_SECRET', TEST_TOKEN)



def test_parse_rejects_wrong_content_type():
    response = client.post('/syllabus/parse', content=b'hello', headers={'content-type': 'text/plain', 'x-internal-service-token': TEST_TOKEN})
    assert response.status_code == 415


def test_parse_rejects_large_body():
    response = client.post('/syllabus/parse', content=b'%PDF-...',
                           headers={'content-type': 'application/pdf', 'content-length': str(11 * 1024 * 1024), 'x-internal-service-token': TEST_TOKEN})
    assert response.status_code == 413


def test_parse_degraded_contract():
    with patch('server.parse_syllabus', side_effect=server.SyllabusParseError('scanned')):
        response = client.post('/syllabus/parse', content=FIXTURE.read_bytes(),
                               headers={'content-type': 'application/pdf', 'x-internal-service-token': TEST_TOKEN})
    assert response.status_code == 200
    assert response.json() == {'degraded': True, 'error': 'scanned'}


def test_parse_success_contract():
    tree = {'modules': [{'name': 'Module', 'orderIndex': 0, 'topics': [{'name': 'Topic', 'orderIndex': 0}]}]}
    with patch('server.parse_syllabus', return_value=tree):
        response = client.post('/syllabus/parse', content=FIXTURE.read_bytes(),
                               headers={'content-type': 'application/pdf', 'x-internal-service-token': TEST_TOKEN})
    assert response.status_code == 200
    result = response.json()
    assert result['degraded'] is False
    assert result['parsed'] == tree
    assert isinstance(result['sourceText'], str)
    assert len(result['sourceText'].strip()) > 0


def test_parser_rejects_missing_service_token():
    response = client.post('/syllabus/parse', content=b'%PDF-test', headers={'content-type': 'application/pdf'})
    assert response.status_code == 401


def test_orchestrator_requires_service_token():
    response = client.post('/orchestrator/run', json={'student_id': 'student123456', 'course_id': 'course123456'})
    assert response.status_code == 401
