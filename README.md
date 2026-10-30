# AI Academic Digital Twin

A multi-agent predictive learning intelligence platform for personalized and proactive education.

## Overview

The platform maintains a continuously updated representation of each learner by combining attendance, assessments, assignments, quizzes, and study behavior. Specialized agents detect academic risk, identify knowledge gaps through prerequisite relationships, and recommend interventions before failure occurs.

## Tech Stack

- Next.js 15 App Router and TypeScript
- Prisma and PostgreSQL, including Neon deployments
- FastAPI and XGBoost model service
- Tailwind CSS and Framer Motion
- Zustand for client state
- JWT authentication with httpOnly cookies

## Architecture

```text
Student event
    -> Prisma database
    -> Agent orchestrator
    -> TypeScript agents
    -> FastAPI ML service
    -> Trained XGBoost models
    -> Predictions, alerts, recommendations, and interventions
    -> Student and faculty dashboards
```

## Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL database, local or Neon

### Application

```bash
npm ci                      # exact versions from package-lock.json
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET (generate: openssl rand -base64 48), APP_URL
npm run env:backup          # saves a durable copy under your user profile
npx prisma generate
npm run dev                 # this is all you need to RUN the app on an existing database
```

CRITICAL: If you pull a new version of the project, run `npm run env:restore` to restore your local `.env` file. Never commit `.env` to Git.

> **⚠️ Never run the seed against the team's shared database.** `npx prisma db seed` **erases** all users, students, faculty, attendance, grades and agent data before creating demo data. It is only for a brand-new database of your own. It refuses to run unless `SEED_CONFIRM_WIPE=yes`, and it refuses any non-local database (such as Neon) unless `SEED_TARGET_HOST` is set to that exact host name.
>
> Only for a **new, empty, local** database: `npx prisma migrate dev --name init`, then
> `SEED_CONFIRM_WIPE=yes SEED_STUDENT_PASSWORD='<strong>' SEED_FACULTY_PASSWORD='<strong>' npx prisma db seed`

The app refuses to start if `JWT_SECRET` is missing, shorter than 32 characters or still an example value. The seed **erases** the application tables and refuses to run without `SEED_CONFIRM_WIPE=yes` and two strong passwords; the old published defaults (`Student@123`, `Faculty@123`) are rejected. A database that was seeded with those defaults should be fixed in place with `npm run passwords:rotate-defaults -- --apply` (see [SETUP.md](SETUP.md)), not re-seeded.

### Student roster enrollment

Student signup requires an institution-provided roster configured in `STUDENT_ROSTER_JSON`. Prepare a CSV with the exact header `rollNumber,dob` and ISO dates (`YYYY-MM-DD`), then run:

```bash
npx tsx scripts/prepare-student-roster.ts roster.csv
```

Set the validated JSON output as `STUDENT_ROSTER_JSON` in the server environment. The roster contains personal data; keep it out of source control and logs. Each roll number can only be registered once.

### End-to-end tests

Install the browser runner and Chromium, then configure `E2E_STUDENT_ROLL`, `E2E_STUDENT_DOB`, and `E2E_STUDENT_PASSWORD` for a seeded test account before running:

```bash
npm i -D @playwright/test
npx playwright install chromium
npx playwright test
```

The Playwright test starts the app and signs in with the configured account. It is skipped when the E2E credentials are not set.

### Password-reset email

Set `APP_URL` and the `SMTP_*` variables in `.env` (any SMTP provider works). Reset links are built from `APP_URL`, never from the request's Host header. Without SMTP, development prints the link to the server console and production sends nothing and logs a warning.

### ML service

In a second terminal:

```bash
cd ml
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
# Put the OULAD csv files in ml/data first (see ml/README.md)
python train_learning_analysis.py
python train_attendance_risk.py
python evaluate.py
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Verify the service:

```bash
curl http://127.0.0.1:8000/health
```

The expected health response reports both model flags as `true` after training artifacts are available.

If a model file is missing, the service answers with `"modelUsed": "fallback"` (a hand-written heuristic, for smoke tests only). The Next.js agents **refuse** fallback predictions: they log a `FAILED` AgentLog row and the orchestrator reports a degraded run and saves nothing. Train the models before running agents.

## Demo accounts

The development seed creates:

- Students: `24BCE0480`, `24BCE2038`, and `24BCE2032`, using their seeded dates of birth.
- Faculty: `FAC001` and `FAC002`.

Student login needs roll number, date of birth and the password from `SEED_STUDENT_PASSWORD`; faculty use `SEED_FACULTY_PASSWORD`. There are no default passwords.

## Features

- Student and faculty authentication with role separation
- JWT sessions using httpOnly cookies
- Rate limiting on login, signup and password reset; signed CSRF tokens on every mutating API request
- Server-side session revocation on logout and password reset
- Parallel learning, attendance-risk, and knowledge-gap agents
- XGBoost predictions for learning performance and attendance risk
- Prerequisite knowledge-graph analysis
- Faculty at-risk monitoring and intervention workflows ("at risk" = latest assessment HIGH or CRITICAL, everywhere; `src/lib/risk/at-risk.ts`)
- Early-warning alerts and personalized recommendations

## Project structure

```text
src/
├── app/                Next.js pages and API routes
├── components/         Shared UI and feature components
├── lib/
│   ├── agents/         Agent implementations and orchestration
│   ├── auth/           JWT, session, CSRF, and rate-limit utilities
│   ├── ml/             ML service client
│   └── prisma.ts       Prisma client singleton
├── store/              Zustand stores
└── middleware.ts       Route protection and CSRF enforcement

ml/
├── models/             Trained model artifacts
├── train_*.py          Training scripts
├── evaluate.py         Metrics generation
├── server.py           FastAPI prediction service
└── reports/            Evaluation and comparison reports

prisma/
├── schema.prisma       Database schema
└── seed.ts             Development data seeder
```

## Team

- Mandalapu Umesh Kumar (`24BCE0480`)
- T. S. Guru Pavan Kumar (`24BCE2038`)
- Veerepalli Veda Karthikeya (`24BCE2032`)

Academic project submission, 2026.

## How the twin stays in sync

The twin is driven by the data, not by a button:

```text
Faculty marks attendance / enters grades / imports a CSV      Student takes a quiz / submits an assignment
                          \                                            /
                     saved (only real changes) + concept mastery updated
                                          |
              agents run for exactly the students who changed (in the background)
                                          |
           twin scores, risk assessment, alerts, recommendations, interventions
                                          |
                    class insight of each affected course recomputed
```

- **Faculty, per course** (`/faculty/courses/<id>`): *Mark attendance*, *Assignments & grades* (tag the concepts an assignment assesses), *Quizzes* (builder: multiple choice, true/false, short answer), *Import CSV* (attendance or grades; every row is validated and any bad row means nothing is saved). The course page shows the live **class insight**: attendance rate, average health/knowledge/performance, risk spread and the weakest concepts.
- **Students**: *Quizzes & Drills* (graded on the server; answers are never sent before submission) and *Assignments* (submit; faculty grade).
- **Mastery** moves toward each new result: the first counts fully, later ones with weight 1/n down to 0.25 (`src/lib/twin/mastery.ts`). Transparent rules, not a trained knowledge-tracing model.
- **Duplicate guard**: a data-triggered run is keyed to the change (`attendance:<id>:<updatedAt>`), so two lectures marked in one hour both run, while re-saving identical data runs nothing.
- **Scheduled review**: `npm run twin:weekly-review` runs every agent for every student and refreshes all class insights. Schedule it, e.g. `0 6 * * 1  cd /path/to/project && npm run twin:weekly-review >> weekly-review.log 2>&1`. It exits non-zero if any review failed or was degraded.
- If the ML service is down, the affected runs are reported as degraded and nothing invented is saved; the data itself is still stored, and the next change or the weekly review brings the twin up to date.

Question wording is stored in `Question.options` as `{ prompt, choices }` because the schema has no text column; older seeded questions (a bare array) are shown as "Question N (concept)". Grades update every concept tagged on the assignment with the overall percentage (no per-question marks in the schema). Assignment submission records hand-in only; there is no file storage.

## ML evaluation and retraining tools

- `cd ml && python calibrate_risk_score.py`: tests the combined LOW–CRITICAL score on unseen OULAD presentations and writes `ml/models/risk_config.json` (read by the app).
- `cd ml && python evaluate.py`: writes `ml/reports/evaluation_report.json` and the model cards `ml/reports/MODEL_CARD_*.md`.
- `cd ml && python per_type_results.py`: marks-model results per assessment type (quizzes, assignments, exams, and quizzes + assignments, which is what the app predicts) from the saved model, without retraining.
- `cd ml && python upper_bound_experiment.py`: research only; how much richer OULAD-only data (not collected by the app; no demographics) would improve both models under identical settings.
- `cd ml && python compare_ai_vs_traditional.py`: the AI vs the app's traditional-dashboard rules on 3,793 unseen OULAD students with real fail/withdraw outcomes (precision, recall, F1 by week, and how early each catches students).
- `npm run eval:knowledge-gap`: on the app's real data, checks whether concepts the knowledge-gap agent flags are answered wrongly more often afterwards (`ml/reports/knowledge_gap_eval.json`).
- `npm run ml:export -- outcomes.csv`: exports the app's data in OULAD format to `ml/app_data/` for retraining on your own students (`outcomes.csv`: rollNumber, courseCode, result). Then `cd ml && OULAD_DIR=app_data python train_learning_analysis.py` and the other scripts. Only meaningful after a full course run with enough students.
- Every saved risk assessment records which model versions and risk settings produced it (`explanation.models`); `GET /health` on the ML service shows the loaded versions.

## The twin in depth

- **8 dimensions, all from data**: academic health, performance, attendance and knowledge from the models and agents; engagement, behaviour, skills and learning velocity from the student's own records (rules in `src/lib/twin/dimensions.ts`).
- **History**: every update is saved as a snapshot; faculty and students see the trajectory.
- **What if…**: on the student page (faculty and student), change attendance, quiz average, missed or late work and see what the trained models predict. Nothing is saved.
- Needs the `twin_snapshots` table: `npx prisma migrate deploy` once.

## Tests

```bash
npm test                                         # 207 TypeScript tests
cd ml && python -m unittest discover -s tests    # 38 Python tests (training pipeline)
npx playwright install chromium && npx playwright test   # 7 browser tests (see tests/e2e/app.spec.ts for the E2E_* settings)
```

The TypeScript tests cover the CSRF client and server, risk scoring, orchestrator control flow, comparison metrics, route handlers, agent-log access, session revocation, rate limiting, signup rules, secret validation, password-reset email, password rotation, and the dynamic twin: mastery rules, class insights, CSV import, quiz grading, the sync engine, route ownership checks, and end-to-end tests where recording attendance or a quiz attempt changes the twin, risk, alerts and class insight with no button press. They use stubs, so no database, ML service or network is needed. The Python tests check the leakage rules of the training features and run train, evaluate and serve end to end on synthetic OULAD-format data (never on the shipped models).

## Comparison report (AI twin vs. rule-based baseline)

This report is computed from the live database, so it needs `DATABASE_URL` and existing risk assessments (run the agents first):

```bash
npm run report:comparison   # writes ml/reports/comparison.json
```

Metrics that cannot be measured (personalization depth, intervention usefulness) are `null` with a reason, and the report lists its own caveats, including that the ground-truth proxy shares its source data with part of the AI's score. There is deliberately no static comparison file: an earlier `ml/comparison.py` hardcoded placeholder numbers and was removed.
