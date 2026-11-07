from workflows.state import TwinState

def attendance_node(state: TwinState) -> dict:
    try:
        from server import PredictRequest, predict_attendance
        result = predict_attendance(PredictRequest(studentId=state['student_id'], features=state.get('syllabus_context', {}).get('attendance_features', {}) if state.get('syllabus_context') else {}))
        if result.get('modelUsed') != 'trained':
            return {'attendance_prediction': result, 'degraded': True, 'errors': state['errors'] + ['Attendance model untrained; predictions not reliable']}
        return {'attendance_prediction': result}
    except Exception:
        return {'degraded': True, 'errors': state['errors'] + ['Attendance prediction unavailable']}
