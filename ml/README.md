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

Download the dataset from the UCI repository (https://archive.ics.uci.edu/dataset/349/open+university+learning+analytics+dataset) or the Open University page (https://analyse.kmi.open.ac.uk/open_dataset) and extract it into `ml/data/` (git-ignored). The scripts need:

- `studentAssessment.csv` and `assessments.csv` (learning model)
- `studentInfo.csv`, `studentVle.csv` and `studentRegistration.csv` (attendance model)

## 3. Train and evaluate

The project ships **without trained models** (the old version-1 models had target leakage and were removed). Train before starting the ML service; until then it answers with a fallback that the agents refuse, so runs are reported as degraded and nothing invented is saved.

```bash
python train_learning_analysis.py
python train_attendance_risk.py
python calibrate_risk_score.py     # tests and sets the app's combined risk score
python evaluate.py                 # report + model cards
python upper_bound_experiment.py   # optional, research only: value of richer data
```

`python per_type_results.py` recomputes the per-assessment-type results from the saved model without retraining.

Models go to `ml/models/`, test predictions and `evaluation_report.json` to `ml/reports/` (plus `*_extras.json`, merged into the report). Training takes a few minutes: each script also runs 5 repeated splits (`ML_REPEATS=10 python train_attendance_risk.py` for more).

How the models are built and judged (feature rules in `oulad_features.py`, evaluation in `evaluation_extras.py`):

- **No leakage.** One row per student per module presentation. The learning model predicts the last scored assessment from *earlier* assessments only; the attendance model sees only weeks before an early cut-off, and students who had already left are excluded.
- **Honest stand-ins.** OULAD has no concept mastery and no attendance. `avgMastery` is the mean of earlier scores (the live agent now computes it the same way, `src/lib/agents/learning-features.ts`); "attendance" is the share of weeks with any VLE activity, so the attendance model is really an *online engagement* model.
- **More of what a teacher would look at (version 4).** The learning model also sees the latest score, the trend and spread of scores, and late or missed assignments. The attendance model became an **early-warning model**: online presence plus what is known about the student's assessed work by the cut-off (average score so far, number assessed, assignments missed or handed in late). Work handed in after the cut-off counts as not known yet; nothing scored yet is passed as unknown, not 0. Lateness and missed work come from tutor-marked assessments only, because the app's quizzes have no due date. The live agents compute exactly the same features (`src/lib/agents/assessed-work.ts`, `learning-features.ts`, `early-warning-features.ts`).
- **Split by module presentation**, and every number is next to a naive **baseline** (learning: mean of earlier scores; early warning: absence rate alone and early average score alone, compared with the stronger of the two).
- **Calibrated probabilities**: an isotonic map fitted on the validation split turns the model's raw score into an observed at-risk rate; the server applies it.
- **Accuracy vs prediction week** (`cutoff_curve`): AUC when everyone is predicted at week 4, 6, 8, 10 and 12. Later predictions are more accurate but leave less time to help; this shows where a target such as AUC 0.80 is reached.
- **Alert threshold chosen on validation, never on test.** Inside the training presentations, 25% are held out; the threshold is the highest one that still catches 70% of at-risk students there (objective O2's recall target). The test set is only used to report. The threshold is saved in the model, returned by the ML service, and used by the live attendance agent.
- **Repeated splits** (mean, sd, min, max), so one lucky or unlucky test set cannot decide the comparison.
- **Time split**: train on 2013 presentations, test on 2014, the way the model is actually used (on a later cohort).
- **Calibration** (attendance): Brier score against the base-rate Brier, and a reliability table (predicted probability vs observed rate per bin), because the app treats the output as a probability.
- **Fairness**: recall, false-positive rate and AUC (attendance) or MAE (learning) per gender, age band, disability and deprivation (IMD) band; groups under 50 students are marked too small.

**Version 6** (marks model) adds what is being predicted (quiz, assignment or exam), the student's marks relative to the class, and weekly activity before the assessment, and sets the 80% range per assessment type. **Version 5** also tunes both models on validation, predicts each next assessment, gives the marks prediction an 80% range, returns the top reasons per prediction, and `calibrate_risk_score.py` checks the app's combined LOW-CRITICAL score on unseen presentations and writes `models/risk_config.json` for the app.

**Fairness (version 6 early warning):** the report's `fairness_diagnosis` shows, per gender, calibration, false-alarm rates, what false alarms look like, and per-course rates; inputs are compared with the student's class; gender reweighing is used in training only and only when validation shows it narrows the false-alarm gap (`fairness_training`). The model and the app never use gender as an input. **Version 7 marks model** also chooses its training objective by validation MAE and uses days since the previous assessment.

Reading `evaluation_report.json`: each model has a `verdict` line. "Beats the baseline consistently" means the improvement minus one standard deviation over the repeated splits is still above zero. If the verdict says it does not beat the baseline, the defensible choice is to run that agent on the baseline rule and report it that way.

Tests (synthetic data, never touch `ml/models/`):

```bash
python -m unittest discover -s tests -v
```

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

The service loads XGBoost artifacts when trained models exist. Before training it stays runnable with a feature-based fallback heuristic for smoke-testing only; responses are marked `"modelUsed": "fallback"`. The Next.js agents refuse fallback predictions (they log a `FAILED` AgentLog row and the orchestrator reports a degraded run and saves nothing), so train the models before running agents.

## 5. Start Next.js

From the repository root, use a second terminal:

```bash
# macOS/Linux: export ML_SERVICE_URL="http://127.0.0.1:8000"
# Windows PowerShell: $env:ML_SERVICE_URL="http://127.0.0.1:8000"
npm run dev
```

Then call the protected agent API with an authenticated browser session:

```bash
# cookies.txt and $TOKEN as in SETUP.md (login session + CSRF token)
curl -X POST http://localhost:3000/api/agents/run -b cookies.txt \
  -H "Content-Type: application/json" -H "x-csrf-token: $TOKEN" \
  -d '{"studentId":"YOUR_STUDENT_ID","event":"weekly_review"}'
```

Valid events are `quiz_attempted`, `assignment_submitted`, `attendance_marked`, `weekly_review`, and `manual_trigger`.

The route enforces authentication. Students can run agents only for themselves; faculty can run them for students they are authorized to manage at the application layer.

## 6. Comparison report

The AI-twin vs. rule-based comparison is computed from the database, not from this folder. From the repository root run `npm run report:comparison`; it writes `ml/reports/comparison.json`. It needs existing risk assessments (run the agents first). Unmeasurable metrics are `null` with a reason. There is no static comparison file.
