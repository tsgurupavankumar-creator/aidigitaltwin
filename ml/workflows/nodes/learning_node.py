from workflows.state import TwinState

def learning_node(state: TwinState) -> dict:
    try:
        from server import PredictRequest, predict_learning
        result = predict_learning(PredictRequest(studentId=state['student_id'], features=state.get('syllabus_context', {}).get('learning_features', {}) if state.get('syllabus_context') else {}))
        if result.get('modelUsed') != 'trained':
            return {'learning_prediction': result, 'degraded': True, 'errors': state['errors'] + ['Learning model untrained; predictions not reliable']}
        return {'learning_prediction': result}
    except Exception:
        return {'degraded': True, 'errors': state['errors'] + ['Learning prediction unavailable']}
