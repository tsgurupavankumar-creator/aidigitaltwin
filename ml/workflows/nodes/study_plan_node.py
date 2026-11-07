import json
import os
from workflows.state import TwinState


def validate_plan(plan: dict, allowed_ids: set[str]) -> dict:
    if not isinstance(plan, dict) or set(plan) - {'steps', 'horizon'} or plan.get('horizon', 'this_week') not in ('today', 'this_week', 'this_month'):
        raise ValueError('Invalid study plan')
    steps = plan.get('steps')
    if not isinstance(steps, list) or not 3 <= len(steps) <= 5:
        raise ValueError('Study plan must have 3-5 steps')
    for step in steps:
        if not isinstance(step, dict) or set(step) != {'title', 'reason', 'estimatedMinutes', 'syllabusTopicId', 'conceptId', 'orderIndex'}:
            raise ValueError('Invalid study plan step shape')
        if not isinstance(step['title'], str) or not 1 <= len(step['title'].strip()) <= 200 or not isinstance(step['reason'], str) or not 1 <= len(step['reason'].strip()) <= 500:
            raise ValueError('Invalid study step text')
        if type(step['estimatedMinutes']) is not int or not 5 <= step['estimatedMinutes'] <= 240 or type(step['orderIndex']) is not int or step['orderIndex'] < 0:
            raise ValueError('Invalid study step duration/order')
        if step['syllabusTopicId'] not in allowed_ids or not isinstance(step['syllabusTopicId'], str) or not 10 <= len(step['syllabusTopicId']) <= 64:
            raise ValueError('Unknown syllabus topic')
        if step['conceptId'] is not None and (not isinstance(step['conceptId'], str) or not 10 <= len(step['conceptId']) <= 64):
            raise ValueError('Invalid concept ID')
    return plan


def study_plan_node(state: TwinState) -> dict:
    gaps = [g for g in state['knowledge_gaps'] if g.get('syllabusTopicId')]
    allowed = {g['syllabusTopicId'] for g in gaps}
    if not gaps:
        return {'degraded': True, 'errors': state['errors'] + ['No topic-linked evidence for study plan']}
    try:
        from openai import OpenAI
        from llm_retry import call_with_backoff
        provider = os.getenv('AI_PROVIDER', 'groq').strip().lower()
        if provider == 'groq':
            key = os.getenv('GROQ_API_KEY')
            if not key:
                raise RuntimeError('Groq not configured')
            client = OpenAI(api_key=key, base_url='https://api.groq.com/openai/v1', timeout=12, max_retries=0)
            model = os.getenv('GROQ_MODEL', 'openai/gpt-oss-20b')
        elif provider == 'openai':
            key = os.getenv('OPENAI_API_KEY')
            if not key:
                raise RuntimeError('OpenAI not configured')
            client = OpenAI(api_key=key, timeout=12, max_retries=0)
            model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
        else:
            raise RuntimeError('Unsupported AI provider')
        output = call_with_backoff(lambda: client.chat.completions.create(
            model=model, temperature=0.2, response_format={'type': 'json_object'},
            messages=[{'role': 'system', 'content': 'Create JSON study plan following StudyPlanOutputSchema. Only use supplied syllabusTopicIds; 3-5 steps, each title, reason, estimatedMinutes (5-240), syllabusTopicId, conceptId (null if unavailable), orderIndex (0 based). horizon=this_week. No extra fields.'},
                      {'role': 'user', 'content': json.dumps({'gaps': gaps})}]))
        plan = validate_plan(json.loads(output.choices[0].message.content), allowed)
        return {'study_plan': plan, 'operations': state['operations'] + [{'type': 'study_plan', 'data': plan}]}
    except Exception:
        return {'degraded': True, 'errors': state['errors'] + ['Study plan generation unavailable']}
