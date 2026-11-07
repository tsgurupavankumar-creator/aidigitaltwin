from typing import Any, TypedDict

class TwinState(TypedDict):
    student_id: str
    course_id: str
    syllabus_id: str | None
    syllabus_context: dict | None
    learning_prediction: dict
    attendance_prediction: dict
    knowledge_gaps: list[dict]
    study_plan: dict | None
    degraded: bool
    errors: list[str]
    operations: list[dict]
    persisted: bool
