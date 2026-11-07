"""Input/output locations. Overridable so tests never touch the shipped models."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('OULAD_DIR', ROOT / 'data'))
MODELS = Path(os.environ.get('ML_MODELS_DIR', ROOT / 'models'))
REPORTS = Path(os.environ.get('ML_REPORTS_DIR', ROOT / 'reports'))


def require(*names: str) -> None:
    missing = [str(DATA / n) for n in names if not (DATA / n).exists()]
    if missing:
        raise FileNotFoundError(
            'Missing OULAD files (download from the Open University / UCI page and extract into ml/data): '
            + ', '.join(missing)
        )
    MODELS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
