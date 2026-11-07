from workflows.state import TwinState

def knowledge_gap_node(state: TwinState) -> dict:
    """Consume supplied concept edges/mastery and syllabus topics; never fabricate mastery."""
    context = state.get('syllabus_context') or {}
    mastery = {str(x['conceptId']): x for x in context.get('masteries', []) if 'conceptId' in x}
    edges = context.get('conceptEdges', [])
    topics = context.get('topics', [])
    gaps = []
    for topic in topics:
        concept_id = topic.get('conceptId')
        evidence = mastery.get(str(concept_id)) if concept_id else None
        if evidence and float(evidence.get('masteryScore', 100)) >= 70:
            continue
        # A topic without a concept is a gap candidate only when there is weak-quiz evidence.
        wrong = int(topic.get('incorrectCount', 0))
        if not evidence and wrong <= 0:
            continue
        prerequisite = [edge.get('prerequisiteId') for edge in edges if edge.get('dependentId') == concept_id]
        gaps.append({'syllabusTopicId': topic.get('id'), 'conceptId': concept_id,
                     'name': topic.get('name', 'Topic'), 'mastery': evidence.get('masteryScore') if evidence else None,
                     'incorrectCount': wrong, 'prerequisites': prerequisite})
    gaps.sort(key=lambda item: (item['mastery'] if item['mastery'] is not None else 100, -item['incorrectCount']))
    operations = state['operations'] + [{
        'type': 'agent_log', 'data': {'agentName': 'knowledge_gap',
          'input': {'courseId': state['course_id'], 'topicCount': len(topics)},
          'output': {'gapCount': len(gaps)}, 'durationMs': 0}}]
    learning = state['learning_prediction']
    attendance = state['attendance_prediction']
    # No fabricated scores: only persist trained predictions and observed attendance.
    dimensions = {}
    if learning.get('modelUsed') == 'trained' and isinstance(learning.get('nextExamScore'), (int, float)):
        dimensions['performanceScore'] = max(0.0, min(100.0, float(learning['nextExamScore'])))
    # Use the application's calibrated OULAD risk mapping rather than
    # provisional 0.5/0.75 attendance-only bands.
    if attendance.get('modelUsed') == 'trained' and isinstance(attendance.get('currentAttendance'), (int, float)):
        dimensions['attendanceScore'] = max(0.0, min(100.0, float(attendance['currentAttendance'])))
    try:
        import json
        from pathlib import Path
        config = json.loads((Path(__file__).resolve().parents[2] / 'models' / 'risk_config.json').read_text())
        if (learning.get('modelUsed') == 'trained' and attendance.get('modelUsed') == 'trained'
                and isinstance(learning.get('nextExamScore'), (int, float))
                and isinstance(attendance.get('riskScore'), (int, float))):
            x, y = config['learningRiskMap']['x'], config['learningRiskMap']['y']
            value = float(learning['nextExamScore'])
            if value <= x[0]:
                learning_risk = y[0]
            elif value >= x[-1]:
                learning_risk = y[-1]
            else:
                i = next(i for i in range(1, len(x)) if x[i] >= value)
                learning_risk = y[i - 1] + (y[i] - y[i - 1]) * ((value - x[i - 1]) / (x[i] - x[i - 1] or 1))
            attendance_risk = max(0.0, min(1.0, float(attendance['riskScore'])))
            # No knowledge mastery -> omit knowledge component (never invent a score).
            measured = [float(g['mastery']) for g in gaps if isinstance(g['mastery'], (int, float))]
            parts = [('attendance', attendance_risk), ('learning', learning_risk)]
            if measured:
                parts.append(('knowledge', 1 - min(measured) / 100))
            total = sum(config['weights'][name] for name, _ in parts)
            score = round(100 * sum(config['weights'][name] * risk for name, risk in parts) / total)
            cutoffs = config['levelCutoffs']
            level = ('CRITICAL' if score >= cutoffs['CRITICAL'] else 'HIGH' if score >= cutoffs['HIGH']
                     else 'MEDIUM' if score >= cutoffs['MEDIUM'] else 'LOW')
            operations.append({'type': 'risk_assessment', 'data': {
                'riskLevel': level, 'probability': score / 100,
                'rationale': 'Calibrated OULAD composite risk; knowledge omitted without measured mastery.'}})
    except (OSError, ValueError, KeyError, TypeError, StopIteration, ZeroDivisionError):
        # Do not write a fabricated risk if the calibration file/signals are missing.
        pass
    if dimensions:
        operations += [{'type': 'twin_update', 'data': dimensions}]
        from datetime import datetime, timezone
        operations += [{'type': 'snapshot', 'data': {'capturedAt': datetime.now(timezone.utc).isoformat()}}]
    return {'knowledge_gaps': gaps[:10], 'operations': operations}
