from datetime import datetime, timezone
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
REPORTS = ROOT / 'reports'
REPORTS.mkdir(exist_ok=True)

comparison = {
    'generated_at': datetime.now(timezone.utc).isoformat(),
    'metric': ['Early detection (weeks ahead)', 'Precision of alerts', 'Recall of at-risk students', 'False positive rate', 'Personalization depth', 'Intervention usefulness score'],
    'traditional': [0, 0.45, 0.52, 0.55, 'Low', 2.8],
    'ai_twin': [3.2, 0.82, 0.79, 0.18, 'High', 4.4],
    'methodology': 'Traditional values are baseline reference values; AI Twin values should be replaced with measured evaluation and survey results after deployment.',
}

(REPORTS / 'comparison.json').write_text(json.dumps(comparison, indent=2), encoding='utf-8')
print(json.dumps(comparison, indent=2))
