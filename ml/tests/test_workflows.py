import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def initial():
    return {'student_id': 'student123456', 'course_id': 'course123456',
            'syllabus_id': 'syllabus123456', 'syllabus_context': {},
            'learning_prediction': {}, 'attendance_prediction': {},
            'knowledge_gaps': [], 'study_plan': None, 'degraded': False,
            'errors': [], 'operations': [], 'persisted': False}


def test_graph_happy_path():
    pytest.importorskip('langgraph')
    from workflows.graph import build_graph
    calls = []
    def node(name):
        def run(state):
            calls.append(name)
            return {'study_plan': {'steps': [1, 2, 3]}} if name == 'study_plan' else {'persisted': True} if name == 'persistence' else {}
        return run
    with patch('workflows.graph.learning_node', node('learning')), patch('workflows.graph.attendance_node', node('attendance')), patch('workflows.graph.knowledge_gap_node', node('knowledge_gap')), patch('workflows.graph.study_plan_node', node('study_plan')), patch('workflows.graph.persistence_node', node('persistence')):
        result = build_graph().invoke(initial())
    assert calls == ['learning', 'attendance', 'knowledge_gap', 'study_plan', 'persistence']
    assert result['persisted'] and result['study_plan']


def test_graph_degraded_skips_plan():
    pytest.importorskip('langgraph')
    from workflows.graph import build_graph
    calls = []
    def node(name):
        def run(state):
            calls.append(name)
            return {'degraded': True, 'errors': ['failed']} if name == 'knowledge_gap' else {}
        return run
    with patch('workflows.graph.learning_node', node('learning')), patch('workflows.graph.attendance_node', node('attendance')), patch('workflows.graph.knowledge_gap_node', node('knowledge_gap')), patch('workflows.graph.study_plan_node', node('study_plan')), patch('workflows.graph.persistence_node', node('persistence')):
        result = build_graph().invoke(initial())
    assert result['degraded'] and 'study_plan' not in calls and calls[-1] == 'persistence'


def test_study_plan_missing_key_degrades(monkeypatch):
    from workflows.nodes.study_plan_node import study_plan_node
    monkeypatch.setenv('AI_PROVIDER', 'openai')
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    state = initial()
    state['knowledge_gaps'] = [{'syllabusTopicId': 'topic1234567', 'name': 'Algorithms'}]
    result = study_plan_node(state)
    assert result['degraded'] and result['errors']


def test_persistence_retry_5xx(monkeypatch):
    from workflows.persistence_client import persist_state
    monkeypatch.setenv('INTERNAL_SERVICE_SECRET', 'a' * 40)
    monkeypatch.setenv('NEXT_INTERNAL_API_URL', 'http://localhost:3000/api/internal/persistence')
    monkeypatch.setattr('workflows.persistence_client.time.sleep', lambda _: None)
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(500)
    state = initial()
    state['operations'] = [{'type': 'agent_log', 'data': {'agentName': 'test', 'input': {}, 'output': {}, 'durationMs': 0}}]
    result = persist_state(state, transport=httpx.MockTransport(handler))
    assert len(calls) == 2
    assert result['degraded'] and not result['persisted']
    assert 'a' * 40 not in str(result)
