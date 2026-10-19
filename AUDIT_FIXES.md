# Audit fixes

## Round 11 (2026-10-18): team update merged and checked; per-type results and upper bound

**Team update (D3–D11, see `UPGRADE_NOTES_D3_D11.md`):** optional LLM-written study recommendations (off by default, privacy-minimised, rule-based fallback), orchestrator writes in one database transaction, Zod validation on agent and student write routes, faculty "Mark complete" for interventions. Its notes say tests and build were not run; they were run here: build passed, **3 orchestrator tests failed**.
1. **Fixed: an LLM fallback marked the whole run "degraded".** Everywhere else "degraded" means *an agent failed and nothing was saved* (student-page warning, sync engine, weekly-review exit code). With the LLM on but unavailable, everything was saved with rule-based recommendations, yet the run was reported degraded, so students would have seen "nothing was saved" and the weekly review would have reported failures. Now `degraded` keeps its meaning and the fallback is reported in `llm`; the student page shows the two messages separately. Test added.

**ML**
2. **Per-assessment-type results** (`python per_type_results.py`, from the saved model; the rebuilt test set reproduces the saved predictions exactly). The app predicts quizzes and assignments only. Main test: quizzes MAE 8.07, R² 0.534; assignments 9.81, 0.399; exams 13.19, 0.099; quizzes + assignments 8.99, 0.469; all 9.10, 0.474. Training now saves each prediction's type, so `evaluate.py` reports this (and future retrains give per-type averages); the marks model card has a per-type section.
3. **Upper-bound experiment** (`python upper_bound_experiment.py`, research only): the same models, rows, splits and settings, with OULAD-only data the app does not collect (prior attempts, study load, registration timing, online activity by type). Demographics excluded on purpose; nothing is saved for the app. Shows what richer data would add.
4. `vle_weeks` rewritten to drop duplicate (student, week) pairs first: identical output, far less memory and faster on the 10M-row activity file.

Checks: `tsc` 0 errors · `npm test` 149/149 · Python 36/36 · build passes.

---

## Round 10 (2026-10-18): remaining ML audit items

9. **80% range made to hold on unseen course runs.** It averaged 77% across test sets. Ranges are now cross-conformal over held-out training presentations (GroupKFold) and widened by the smallest factor that reaches 80% there (`range_80.all.widen_factor`, `held_out_coverage`). Marks model version 8.
10. **Per-course results** (`by_course`) for both models: MAE per course; AUC, recall, precision and false alarms per course (the gender gap was traced to course mix, e.g. one course over-flagged for everyone).
13. **Traceability.** Models record their training time; the ML service returns `modelVersion` with each prediction and on `/health`; each risk assessment stores the model versions and risk-settings date (`explanation.models`), shown on the faculty *Why* panel.
15. **Model cards** (Mitchell et al., 2019) generated from the evaluation report on every `evaluate.py` run: `ml/reports/MODEL_CARD_early_warning.md`, `MODEL_CARD_marks.md`, `MODEL_CARD_risk_levels.md`.
11. **Knowledge-gap evaluation** (`npm run eval:knowledge-gap`): on real app data, error rates on flagged vs unflagged concepts after each run, risk ratio and a z-test; says "not enough data yet" below 50 answers.
12. **Export for retraining on the app's own students** (`npm run ml:export -- outcomes.csv`): writes the app's data in OULAD format so the same training scripts run unchanged; a test exports fake app data and reads it back with the Python pipeline.
6, 24. README test counts and `RISK_CONFIG_PATH` documented.

Checks: `tsc` 0 errors · `npm test` 145/145 · Python 34/34 · build passes. **Retrain (learning, attendance, calibrate, evaluate).** Items 11 and 12 run on real app data later.

---

## Round 9 (2026-10-18): fairness work and a last honest push on the marks targets

Version 6/5 results: early warning recall 72%, but false alarms 31% for women vs 21% for men (the model never sees gender; similar gaps are reported for OULAD by Riazy & Simbeck 2019 and Riazy, Simbeck & Schreck 2020). Marks model: MAE 10.3, R² 0.42 on average (targets 8 and 0.50).

**Fairness (early-warning model, version 6)**
1. *Diagnosis* in the report (`fairness_diagnosis`): per gender, mean predicted risk vs observed rate, false-alarm rate, the average inputs of false alarms vs correctly cleared students, and false-alarm rates per course.
2. *Class-relative inputs*: presence and marks compared with the student's own class (`presenceVsClass`, `scoreVsClass`), so course norms (some courses need less online activity) are not read as risk. Live: attendance vs the class on the same lectures; marks vs the class on the same work.
3. *Reweighing* (Kamiran & Calders) by gender in TRAINING only (the app never uses gender), kept only if, on validation data, it cuts the false-alarm gap by ≥ 25% while losing ≤ 0.01 AUC. Both versions' validation numbers and the decision are in `fairness_training`.

**Marks model (version 7)**
4. The tuning grid now also chooses the *training objective* (squared, absolute or Huber error) by validation MAE, since MAE is the target, plus depth and learning rate.
5. New input known in advance: *days since the previous assessment*.

Checks: `tsc` 0 errors · `npm test` 141/141 · Python 32/32 · build passes. **Retrain; training takes longer (bigger grid).** Targets are not guaranteed; report the averages over the repeated splits.

---

## Round 8 (2026-10-18): Route 1, the marks model gets the context it was missing (learning model version 6)

Version 5 marks model: ~10% better than the baseline (MAE 11.2, R² 0.30 over 5 splits), 80% range covering 77%. Targets MAE ≤ 8 and R² ≥ 0.50 not met. Six inputs added, all known before the predicted assessment and all available in the app:

1. **What is being predicted**: assignment or exam (quiz = neither). Exams behave very differently from coursework.
2. **Marks relative to the class** on the same earlier work, and the class average on it (how hard it was). OULAD assessment ids are per presentation, so no information crosses between train and test.
3. **Activity before the assessment**: share of weeks active, overall and in the last 4 weeks (app: lecture attendance, overall and last 4 lectures).
4. **80% range per assessment type**, so exams get a wider range than quizzes and the stated 80% holds per type; the report shows coverage per type.

Live: `assessed-work.ts` computes class means per quiz and assignment and whether an assignment is due next; `learning-features.ts` adds the six inputs (null when unknown). `calibrate_risk_score.py` uses them too. Checks: `tsc` 0 errors · `npm test` 140/140 · Python 28/28 · build passes. **Retrain (learning, attendance, calibrate, evaluate).**

---

## Round 7 (2026-10-18): Stage 1, agents made as strong as the data allows

1. **Why behind every prediction.** The ML service returns the top 3 reasons per prediction (XGBoost's exact per-feature contributions, the same idea as SHAP); they are saved with each risk assessment and shown in plain words on the faculty student page (*Why* panel).
2. **Honest ranges.** The marks prediction comes with an 80% range from validation errors ("likely 55-79%"); the training report shows how often the true mark fell inside it on test data.
3. **Tuning on validation.** Both models choose their settings from a small grid on a validation split of the training presentations, never the test set.
4. **Marks model predicts each next assessment** (one row per assessment, each seeing only earlier work), which is what the app does and gives far more training data.
5. **Combined risk score tested and set from data** (`ml/calibrate_risk_score.py`): learning risk from the predicted mark instead of a coarse trend, the attendance/learning weighting learned, and level cut-offs set so LOW/MEDIUM/HIGH/CRITICAL match observed fail-or-withdraw rates of <25/25-50/50-75/>75% on unseen presentations. Written to `ml/models/risk_config.json`, read automatically by the app (hand-set values without it); the knowledge weight stays hand-set (untestable on OULAD). Each assessment records which settings were used.
6. **Seeded quizzes repaired.** A 30-question bank replaces the placeholders (no wording, answer always "A"); the seed uses it, `npm run quizzes:fix-seeded -- --apply` fixes an existing database in place, and answer positions vary.

Checks: `tsc` 0 errors · `npm test` 138/138 · Python 25/25 · build passes. **Retrain, then run `python calibrate_risk_score.py`.**

---

## Round 6 (2026-10-18): models given more real information (version 4)

Version 3 results: learning MAE 13.09 vs baseline 13.77 over 5 splits (+4.7%, sd 2.8; R² 0.33); attendance AUC 0.693 vs 0.679 (+0.015), recall 0.73 on average but 0.54 on the main split; probabilities too low (predicted 0.45 → observed 0.57). O2 targets not met.

1. **Learning model:** + latest score, score trend and spread, late and missed assignments (earlier work only).
2. **Attendance → early-warning model:** + average score so far, number assessed, assignments missed or late, all only as known before the cut-off; nothing scored yet = unknown, not 0.
3. **Isotonic calibration** fitted on validation and applied by the server, so the probability matches the observed rate.
4. **Second baseline** (early average score alone); the model is now compared with the stronger baseline.
5. **Accuracy vs prediction week** (weeks 4-12).
6. **Live features match:** both agents use one shared loader (`assessed-work.ts`); missing values are sent as null (unknown) and the server passes them to XGBoost as missing; EXCUSED lectures no longer count as absences.

Checks: `tsc` 0 errors · `npm test` 130/130 · Python 22/22. **Retrain on OULAD for the numbers.**

---

## Round 5 (2026-10-17): ML evaluation fixed after the first honest run

The first leakage-free run (version 2) gave learning R² 0.362 vs baseline 0.274 (MAE 11.35 vs 11.83) and attendance AUC 0.718 vs 0.693, but attendance recall 0.30 vs the baseline's 0.52: a fixed 0.5 threshold flagged only 629 of 3,793 students when 1,613 were at risk.

1. **Alert threshold chosen on a validation split of the training presentations** (highest threshold with recall ≥ 0.70), never on test; saved in the model, returned by `/predict/attendance`, used by the live attendance agent (0.5 only for older models).
2. **Repeated presentation splits** (mean and spread) and a **verdict** per model against its baseline.
3. **2013 → 2014 time split**, **calibration** (Brier, reliability table) and **subgroup fairness** (gender, age band, disability, IMD band).
4. **Live learning features now match training** (`src/lib/agents/learning-features.ts`): `avgMastery` is the mean of the student's scores (it was concept mastery, which the model never saw), missing averages are filled from it instead of 0, and only graded assignments are counted. Students with no scored work skip the learning model instead of being fed zeros.
5. `httpx` added to `ml/requirements.txt` (the server test needed it).
6. **Course management was missing from the app.** The courses page could list courses but not create one, enroll students or delete a course: the components that did it (`CreateCourseModal`, `AddStudentsModal`, `CourseCard`) were never rendered, and used an older dark design. Rebuilt in the current design (`src/components/twin/CourseManagement.tsx`): *New course* on the courses page; *Enroll students* (roll numbers or exact names, each result reported) and *Delete course* (shows the server's reason when the course holds data) on the course page.
7. **Clean-up.** Removed 27 source files that nothing imports (confirmed with the TypeScript import graph: old components, unused API clients, mock data, hooks), 6 unused npm packages (Radix UI, class-variance-authority; 42 packages fewer in the lockfile, no other version changed), `aios.md` (the original scaffold guide, outdated), `DATABASE_SETUP.md` (merged into SETUP.md), the TypeScript build cache, and the **version-1 models and reports** (target leakage; they also predate the feature and threshold fixes). The project now ships without trained models: train first (`ml/README.md`).

Checks: `tsc` 0 errors · `npm test` 129/129 · Python 17/17 · build passes · no unreachable source files. **Needs your run on the real OULAD** for the numbers.

---

## Round 4 (2026-10-17): the twin is now driven by the data

**Checks on the finished tree:** `tsc` 0 errors · `npm test` **125/125** · Python 14/14 · `next build` passes (Next.js 15.5.27) · production server: every new page redirects to login without a session, every new API returns 401 without a session, every new write returns 403 without a CSRF token and 401 with a valid token but no session.
**Not run:** against the real database, the ML service or a browser (see the checklist below).

1. **Data comes in through the app.** Faculty: lectures and attendance marking, assignments (with the concepts they assess) and grade entry, a quiz builder, and CSV import of attendance or grades (validated row by row; any error saves nothing; one transaction). Students: take quizzes (server-side grading, answers never sent first) and submit assignments. The quiz "Launch" button previously did nothing.
2. **Concept mastery updates itself** from quiz answers (per concept) and grades (per tagged concept).
3. **Agents run automatically** for exactly the students whose data changed, after the response is sent (`after()`), four at a time. The orchestrator's duplicate guard is keyed to the change when one is given (it was keyed to the hour, which would have replayed the first of two lectures marked in one hour). `npm run twin:weekly-review` is the scheduled run.
4. **Class insights are computed** per course after every change (they were read by the app but never written) and shown on the course page. Missing data is null or "not assessed", never invented.
5. **Found while testing:** the student quiz API looked the quiz up before checking the session, so an anonymous caller could tell real quiz ids from fake ones. Auth now comes first (test added). No other new route touches the database before auth.

All within the existing schema: `prisma/schema.prisma` is unchanged. New code: `src/lib/twin/*`, 12 API routes, 6 pages, `src/components/twin/*`, `scripts/weekly-review.ts`, 28 tests.

### Manual checklist (needs your database, ML service and a browser; about 15 minutes)

1. `npm ci`, `npx prisma generate`, start the ML service (`cd ml && uvicorn server:app --port 8000`) and `npm run dev`.
2. Log in as faculty, open a course. The *Class insight* panel shows "No insight yet"; press *Refresh*: numbers appear.
3. *Mark attendance* → *Add lecture* → mark one student ABSENT, others PRESENT → *Save*. The notice says twins are updating.
4. After a few seconds, open that student (*Inspect*): attendance and academic health have changed; *At-risk* / alerts reflect it. The course's class insight attendance rate has changed.
5. Mark a second lecture in the same hour for the same student: it updates again (not a replay).
6. *Assignments & grades* → create an assignment, tag a concept, enter marks → the student's knowledge-gap view and mastery change.
7. *Quizzes* → publish a 2-question quiz. Log in as an enrolled student → *Quizzes & Drills* → *Launch* → answer → score shown; dashboard updates within seconds.
8. *Import CSV* with one deliberately bad row: every problem is listed by row and nothing is saved. Fix it and import again: rows saved.
9. Stop the ML service and save attendance: the data is saved, the run is degraded (server log `[TWIN_SYNC] ... degraded`), and nothing invented appears. Restart it and run `npm run twin:weekly-review`.
10. As a faculty member who does not teach the course, open `/faculty/courses/<that id>/attendance`: the API returns 404.

---

## Round 3 (2026-10-17): third audit, all code-level items done

**Checks on the finished tree:** `tsc` 0 errors · `npm test` **97/97** · `python -m unittest discover -s tests` (in `ml/`) **14/14** · `next build` passes on **Next.js 15.5.27** with no Edge warning · production server exercised: pages render, protected pages redirect, missing or forged CSRF token → 403, valid signed token passes, unauthenticated API → 401, `/api/auth/login` → 404, `/_next/image` → 404.
**Not run (needs your machine or accounts):** anything against the real database, real OULAD training, real SMTP delivery, a real browser.

1. **Guru's patches 01-07 applied** (unthrottled login removed, session revocation, Edge warning, limiter eviction, signup rules and rate limit, signed CSRF tokens, placeholder-secret rejection). `guru-patches/` is kept as the record of exactly what changed in his areas. Guru: please review, and do the manual revocation check in `FOR_GURU.md`.
2. **The example `JWT_SECRET` worked as a real one** (found in this audit). It was 43 characters, passed the length check, and `cp .env.example .env` is the documented setup, so a token forged with it was accepted as a FACULTY session. Placeholders are now refused at startup and `.env.example` ships empty secrets (patch 07).
3. **Next.js 14.2.35 → 15.5.27** (pinned). Clears all 23 Next advisories, including the 2 critical RCEs. The official codemod made `cookies()` and route `params` async in 5 files. React stays 18.3 (supported by Next 15). PostCSS pinned to 8.5.28 for Next's bundled copy too (`overrides`). `npm audit`: 10 (1 critical) → 8 (0 critical); the 8 are Tailwind 3's build-time file-watcher chain, cleared only by a Tailwind 4 migration.
4. **`package-lock.json` committed** (was git-ignored) and resolved with `npm install --before=2026-10-03`, so no package newer than two weeks is locked. Use `npm ci`. `engines.node` is `>=20`.
5. **Password-reset email** (`src/lib/email/password-reset.ts`, nodemailer 10.0.13 over any SMTP). Not configured → dev prints the link, production logs a warning. Sending runs in the background so registered emails don't answer measurably slower (an enumeration signal); failures are logged, never shown.
6. **Reset-link poisoning closed** (found in this audit). The link used the request's Host header; once emails go out, a forged Host would put an attacker's domain in the victim's email. It now uses `APP_URL` (required in production).
7. **Seed hardened.** Refuses to run without `SEED_CONFIRM_WIPE=yes` (it erases the tables) and without two strong passwords; `Student@123` / `Faculty@123` are rejected.
8. **`npm run passwords:rotate-defaults`** fixes an existing database in place: finds accounts still on the published defaults, gives each its own random strong password, ends their sessions, writes the new passwords to a git-ignored CSV. Dry run unless `--apply`.
9. **Training scripts rewritten without leakage** (`ml/oulad_features.py`): one row per student-presentation (the old scripts merged a student's modules), learning features from *earlier* assessments only, attendance stand-in = weeks with any VLE activity before an early cut-off (no scores in it; early leavers excluded), split by module presentation, every result next to a naive baseline. Same feature names and model files, so the agents and server are unchanged. **The shipped models are still the old ones until you retrain.**
10. **`python evaluate.py` crashed** (found in this audit): it reads `ml/reports/*_test.pkl`, which existed only in the top-level `reports/`. Top-level `models/` and `reports/` merged into `ml/`; the server loads only `ml/models`.
11. **One "at risk" rule** everywhere (`src/lib/risk/at-risk.ts`): latest assessment HIGH or CRITICAL. Course detail and `/api/faculty/at-risk` also counted MEDIUM and "score ≥ 40"; they now match the dashboards, the intervention trigger and the comparison report.
12. **`CSRF_ENABLED=false` is ignored in production.**
13. **`.gitignore`** now covers `.env.*`, `ml/data/`, `*.local.csv` and the TypeScript build cache (untracked).
14. **Docs** rewritten where they were wrong: setup now covers secrets, seed rules and CSRF in curl examples; student login needs a password as well as the date of birth; (`DATABASE_SETUP.md`, since merged into SETUP.md, had a wrong date of birth).

**Still needs you:** check `JWT_SECRET` in every real environment and rotate secrets if the first zip was shared; run `passwords:rotate-defaults -- --apply`; retrain on OULAD and report the new numbers with their baselines; run the agents then `npm run report:comparison`; set `APP_URL` and SMTP; commit and push; decide signup identity checks and enrollment policy (both need schema work from Guru); the report's Section 9 brackets.

---

## Round 1 (2026-10-08)

Applied to `aidigitaltwin-updated_3__1.zip`. `prisma/schema.prisma` was **not** changed. The repo's `.git` is included, so `git diff` shows every change.

**Checks run on the finished tree:** `tsc` 0 errors (against the real generated Prisma types) · `next build` passes · `npm test` 60/60 · live-server checks of CSRF and rate limiting.
**Not run:** anything against a real database, the ML service, or a real browser. Those need your machine (see "How to verify").

## Round 2 (2026-10-08)

**Fixed in this zip (your folders):**

10. **Any faculty member could read any student's agent logs.** `GET /api/agents/logs/[studentId]` had no enrollment check for faculty. It now applies the same rule as `/api/agents/run` and `/api/faculty/student/[id]`. Removing the fix makes the new tests fail (checked).
11. **Image optimizer switched off** in `next.config.mjs` (the app never uses `next/image`). `npm audit` lists critical advisories against that endpoint in Next 14.2.x. Measured on the dev server: `/_next/image` went from 500 to 404. This does not fix the other critical advisory (see `FOR_GURU.md`: upgrade Next before any public hosting).
12. **15 more tests** (route handlers executed against a stubbed database): the forgot/reset-password flow (hashed single-use token, no account enumeration, password really changes), the course delete guard (each kind of data blocks deletion), duplicate-name enrolment, null-not-invented course data, and who may read agent logs.

13. **The Learning Velocity card on the main student dashboard showed about 1% instead of about 65%.** `DigitalTwin.learningVelocity` is stored on a 0 to 1 scale and that card did not multiply it by 100 (my bug; every other screen did). Fixed, and the scale is now recorded in the data dictionary.

**Found in Guru Pavan's areas.** Ready-made, tested patches are in `guru-patches/` (not applied; see `FOR_GURU.md`):

- `01` the generic `/api/auth/login` had no rate limit, no DOB check and no CSRF check, and nothing uses it. Measured: the role-specific route throttles from the 6th attempt, this one never did.
- `02` sessions were never revoked server-side; `03` the Edge-runtime `crypto` warning; `04` the rate limiter never evicted entries; `05` signup accepted 6-character passwords and had no rate limit; `06` the CSRF token was not verified as server-issued (measured: a made-up matching cookie and header passed).

**Open, no patch can fix it:** Next.js 14.2.35 critical advisories (upgrade to 15.5.24 or later), default seed passwords, password-reset email delivery, identity checks at signup, ML retraining, and generating the real comparison report.

## Fixed

1. **Every write action was blocked by CSRF (HTTP 403).** The middleware requires an `x-csrf-token` header; no page sent it, so signup, logout, forgot/reset password, course create/delete/enroll, intervention updates, agent runs, alerts, recommendations and study plan all failed. `src/lib/api/csrf-client.ts` + `<CsrfProvider/>` (mounted in `layout.tsx`) now add the token to every same-origin mutating `/api/*` request, fetch a fresh one if the cookie is missing/expired, never send it cross-origin, and retry once on a CSRF rejection. The server-side check is unchanged and still rejects requests without the header (verified live).
2. **`npm run build` failed** (3 type errors in `store.ts`). Fixed with proper type annotations. `next build` now passes.
3. **Fake comparison numbers removed.** `ml/comparison.py` hardcoded 3.2 weeks / 0.82 precision / 4.4 usefulness and the README told everyone to run it. Deleted it and `ml/reports/comparison.json`. `npm run report:comparison` now computes a real comparison from the database into `ml/reports/comparison.json`; unmeasurable metrics are `null` with a reason. Logic is in `scripts/lib/comparison-metrics.ts` (16 tests). Methodology fixes: AI flag = *latest* assessment (docs and code disagreed), students without ground truth are excluded instead of silently counted as fine, and the report states the circularity limit. **The file does not exist until you run the command** (it needs your database).
4. **Orchestrator swallowed agent errors and saved invented values.** Removed the made-up `predictedGPA 3.65`, `confidenceScore 0.85`, `knowledgeGapScore 35`, `predictedExamScore 75` and the 0.7 recommendation-confidence floor. If any agent that should run fails, the response says `degraded: true` with `agentErrors`, the error is logged, and **nothing is saved** (no alerts, recommendations, intervention, risk row, health update or idempotency marker), so a retry runs cleanly instead of being served a stale cached result. Scoring moved to `src/lib/agents/risk-scoring.ts`; with all three agents present it gives results **identical to the original formula** (2,000-case regression test). Missing inputs fall back to the digital twin's stored scores (labelled in `factors.signalSources`) or are excluded and the weights renormalised. The student page shows a notice on a degraded run.
5. **Deleting a course erased students' history.** The schema cascades into attendance, grades, quiz results, concept mastery and graph edges. `DELETE /api/faculty/courses/:id` now returns 409 unless the course holds none of that, and the card shows the reason.
6. **Enrolling by name could enrol the wrong student** (names aren't unique). Roll number is tried first (unique); several students with one name now give a 409 asking for the roll number.
7. **Invented values shown as facts.** The API returned `section: '01'`, a made-up schedule `MWF 10:00 AM`, and for students with no data 75% health / 85% attendance / LOW risk / score 25. They are now `null` and the pages show "—" / "No schedule set". The create-course form turned the default "Fall 2026" into **semester 12** and discarded its Section and Schedule fields; it now has a Semester dropdown and only fields the server stores.
8. **No rate limiting on forgot/reset password.** Now 5 requests / 15 min, keyed on email and client IP (forgot) or IP (reset), checked before any database work.
9. Broken indentation from added comments repaired; comments that overstated behaviour corrected (including my own claim that reset "invalidates sessions", see below); READMEs corrected.

## Not fixed (and why)

- **Live credentials were inside the uploaded zip** (Neon URL + password, JWT and NextAuth secrets in `.env`). Not in this zip. Never zip the whole folder; use:
  `zip -r project.zip aidigitaltwin-updated -x "*/node_modules/*" "*/.env" "*/.next/*" "*.DS_Store"`
  If the earlier zip went beyond people who already have DB access, Guru Pavan should rotate the Neon password, `JWT_SECRET` and `NEXTAUTH_SECRET`.
- **The model metrics are real but not meaningful** (needs retraining on your Mac with OULAD). Learning model: `avgMastery`, `avgQuizScore`, `avgSubmissionScore` are the same number (mean of all scores *including the one predicted*), `quizCount` = `submissionCount`, and `quizTrend` = last − first, so R² 0.968 measures reconstruction, not prediction, and the live system feeds those slots different quantities. Attendance model: OULAD has no attendance; "attendance" is a formula of VLE clicks and mean score, so AUC 0.874 reflects engagement/scores. Fix: build the target from the final assessment and compute every feature only from *earlier* ones, give each feature its own source, and don't call the proxy "attendance". Until then present these as prototype numbers with that caveat.
- **[Fixed in round 3: patch 02 applied]** **Sessions are never revoked server-side** (patch `guru-patches/02`). `getAuthSession()` checks only the JWT (7-day expiry) and never reads the `Session` table, so logout and password reset don't cut off an already-issued cookie (reset still deletes the rows so revocation works once enforced). Fix in `src/lib/auth/session.ts`: after `verifyToken`, require a `Session` row with `tokenHash(token)` and `expiresAt > now`. `tokenHash` and `hashToken` are the same SHA-256, but there are two session mechanisms (`createSession` stores a random token), so confirm each login route stores the cookie's JWT hash first. Not changed because it is auth core and a mistake locks everyone out; test: login → API call OK → logout → same cookie → 401.
- **[Fixed in round 3: patch 03 applied]** **Edge-runtime warning** (patch `guru-patches/03`) (`crypto` imported via `middleware.ts` → `session.ts`). Needs a small change in `middleware.ts`, which is Guru Pavan's: move `SESSION_COOKIE_NAME` into a tiny `constants.ts` with no `crypto` import.
- **Enrollment is an access grant.** Any faculty member can enrol any student by name or roll number and then sees that student's data; the "enrolled students only" checks rely on it. Needs a product decision (student join-by-code or admin approval).
- **[Fixed in round 3: patch 05 applied]** Signup routes have no rate limiting, and accept 6-character passwords server-side (patch `guru-patches/05`; they live in Guru Pavan's directory).
- **[Code fixed in round 3; run `npm run passwords:rotate-defaults -- --apply` on your database]** `.env` uses the published default seed passwords (`Student@123` / `Faculty@123`); change before any deployment.
- **[Fixed in round 3]** `models/` and `reports/` exist at the top level **and** under `ml/` (identical copies). `evaluate.py` writes to `ml/`, so the top-level copies go stale after retraining.
- **[Fixed in round 3]** "At risk" differs by screen: course detail also counts MEDIUM; the dashboards count HIGH/CRITICAL only.
- The rate limiter is in-memory and per process; `x-forwarded-for` can be spoofed (hence the email key too). Idempotency is an app-level check, not a database constraint, so two truly simultaneous calls can both run.

## Things you will notice

- Running the same review twice in an hour returns the earlier result with `replayed: true` and writes nothing new (by design). Use a different event, e.g. `manual_trigger`, to force a fresh run when testing AgentLog writes.
- Models missing / ML service down → the review reports `degraded: true` and saves nothing.
- A course that has data can't be deleted (there is no archive feature; that needs a schema change).
- After 5 reset requests you get 429 for 15 minutes; restarting the dev server clears it.

## How to verify on your machine

1. `npm ci`, `npx prisma generate`, `npm test` (97 pass), `cd ml && python -m unittest discover -s tests` (14 pass), `npm run build` (needs a real `JWT_SECRET`; no warnings).
2. `npm run dev`, log in, create a course. In the browser Network tab the request carries `x-csrf-token` and returns 201, not 403.
3. Run a weekly review twice; the second response has `replayed: true`.
4. Stop the ML service and run a review; expect `degraded: true` and no new Alert/RiskAssessment rows.
5. After agents have created risk assessments: `npm run report:comparison` creates `ml/reports/comparison.json`.

## Files changed

- **modified** `README.md`
- **modified** `ml/README.md`
- **removed** `ml/comparison.py`
- **removed** `ml/reports/comparison.json`
- **modified** `next.config.mjs`
- **modified** `package.json`
- **modified** `scripts/generate-comparison-report.ts`
- **added** `scripts/lib/comparison-metrics.ts`
- **modified** `src/app/api/agents/logs/[studentId]/route.ts`
- **modified** `src/app/api/auth/forgot-password/route.ts`
- **modified** `src/app/api/auth/reset-password/route.ts`
- **modified** `src/app/api/faculty/courses/[courseId]/route.ts`
- **modified** `src/app/api/faculty/courses/route.ts`
- **modified** `src/app/faculty/courses/[courseId]/page.tsx`
- **modified** `src/app/faculty/courses/page.tsx`
- **modified** `src/app/layout.tsx`
- **modified** `src/app/student/page.tsx`
- **modified** `src/components/faculty/AddStudentsModal.tsx`
- **modified** `src/components/faculty/CourseCard.tsx`
- **modified** `src/components/faculty/CreateCourseModal.tsx`
- **added** `src/components/layout/CsrfProvider.tsx`
- **modified** `src/lib/agents/attendance-risk.ts`
- **modified** `src/lib/agents/knowledge-gap.ts`
- **modified** `src/lib/agents/learning-analysis.ts`
- **modified** `src/lib/agents/orchestrator.ts`
- **added** `src/lib/agents/risk-scoring.ts`
- **modified** `src/lib/agents/types.ts`
- **added** `src/lib/api/csrf-client.ts`
- **modified** `src/lib/api/fetch.ts`
- **added** `src/lib/auth/client-ip.ts`
- **modified** `src/lib/store.ts`
- **added** `tests/agent-logs.test.ts`
- **added** `tests/comparison-metrics.test.ts`
- **added** `tests/csrf-client.test.ts`
- **added** `tests/orchestrator.test.ts`
- **added** `tests/risk-scoring.test.ts`
- **added** `tests/routes.test.ts`
- **added** `FOR_GURU.md`
- **added** `guru-patches/` (6 patches)
