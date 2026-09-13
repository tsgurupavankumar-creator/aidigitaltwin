# Academic Digital Twin ML Pipeline

This directory contains the OULAD training pipeline and the separate FastAPI prediction service used by the Next.js agents.

## 1. Install dependencies

```bash
cd ml
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Download OULAD

Download the official dataset from https://analyse.kmi.open.ac.uk/open_dataset and extract these files into `ml/data/`:

- `studentInfo.csv`
- `studentVle.csv`
- `studentAssessment.csv`
- `assessments.csv`
- `vle.csv`
- `studentRegistration.csv`
- `courses.csv`

The training scripts require the first three files and will report any missing files.

## 3. Train and evaluate

```bash
python train_learning_analysis.py
python train_attendance_risk.py
python evaluate.py
python comparison.py
```

Models are written to `ml/models/`. Evaluation artifacts and reports are written to `ml/reports/`.

## 4. Start the ML service

Keep this process running on port 8000:

```bash
uvicorn server:app --host 127.0.0.1 --port 8000
```

Check it:

```bash
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/predict/learning \
  -H "Content-Type: application/json" \
  -d '{"studentId":"1","features":{"avgMastery":65,"avgQuizScore":70,"avgSubmissionScore":68,"quizCount":5,"submissionCount":4,"quizTrend":2}}'
```

The service loads XGBoost artifacts when trained models exist. Before training, it remains runnable with a transparent feature-based baseline so the integration can be smoke-tested; Next.js still always calls this service.

## 5. Start Next.js

From the repository root, use a second terminal:

```bash
$env:ML_SERVICE_URL="http://127.0.0.1:8000"
npm run dev
```

Then call the protected agent API with an authenticated browser session:

```bash
curl -X POST http://localhost:3000/api/agents/run \
  -H "Content-Type: application/json" \
  -d '{"studentId":"YOUR_STUDENT_ID","event":"weekly_review"}'
```

Valid events are `quiz_attempted`, `assignment_submitted`, `attendance_marked`, `weekly_review`, and `manual_trigger`.

The route enforces authentication. Students can run agents only for themselves; faculty can run them for students they are authorized to manage at the application layer.
