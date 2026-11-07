# Model card: marks-prediction model

**What it does.** Predicts a student's next assessment mark (0–100) with an 80% range, from their earlier marks, late and missed work, marks relative to the class, activity before the assessment, and what kind of assessment comes next. Used by the learning-analysis agent.

**Training data.** OULAD, one row per scored assessment (from each student's second onward), using only work dated before it.

**Model.** XGBoost regressor, settings {'max_depth': 6, 'learning_rate': 0.05, 'n_estimators': 400, 'objective': 'reg:absoluteerror'}, chosen by validation MAE (never on test).

## Results on unseen presentations
| Metric | Main test | 5 repeated splits | Future cohort | Simple rule (average so far) |
|---|---|---|---|---|
| MAE (marks) | 9.10 | 10.04 ± 1.26 | 10.25 | 12.51 ± 1.74 |
| R² | 0.474 | 0.404 ± 0.065 | 0.380 | 0.116 ± 0.175 |
| Improvement over the rule | — | 19.5 ± 4.6% | 18.5% | — |
| 80% range coverage | 85.6% | 81.5% ± 4.7% | 81.5% | — |

Range per assessment type on the main test: CMA 88.0%, TMA 83.7%, Exam 82.7%. Widen factor applied: 1.02.

beats the baseline consistently: +19.54% MAE improvement on average over 5 splits (sd 4.61)

## Per assessment type
The app predicts quizzes and assignments only (it has no exams), so the coursework row is the one that matches the deployed use; the overall row includes OULAD's exams.

| Type | n | MAE | R² | Simple rule MAE | Improvement |
|---|---|---|---|---|---|
| all | 23789 | 9.10 | 0.474 | 10.24 | 11.2% |
| quizzes (computer-marked) | 10912 | 8.07 | 0.534 | 9.53 | 15.3% |
| assignments (tutor-marked) | 12275 | 9.81 | 0.399 | 10.48 | 6.4% |
| exams | 602 | 13.19 | 0.099 | 18.32 | 28.0% |
| quizzes + assignments (what the app predicts) | 23187 | 8.99 | 0.469 | 10.03 | 10.4% |

## Fairness (MAE per group)
| Group | Value | n | mae |
|---|---|---|---|
| gender | F | 7080 | 9.63 |
| gender | M | 16709 | 8.87 |
| age_band | 0-35 | 16118 | 9.30 |
| age_band | 35-55 | 7375 | 8.72 |
| age_band | 55<= | 296 | 7.62 |
| disability | N | 21917 | 9.00 |
| disability | Y | 1872 | 10.25 |
| imd_band | 0-10% | 1731 | 10.09 |
| imd_band | 10-20 | 1948 | 9.45 |
| imd_band | 20-30% | 2281 | 9.14 |
| imd_band | 30-40% | 2580 | 8.95 |
| imd_band | 40-50% | 2275 | 9.18 |
| imd_band | 50-60% | 2316 | 8.91 |
| imd_band | 60-70% | 2217 | 9.13 |
| imd_band | 70-80% | 2390 | 8.77 |
| imd_band | 80-90% | 2074 | 9.25 |
| imd_band | 90-100% | 2439 | 8.67 |
| imd_band | missing | 1538 | 8.81 |

## Per course
| Course | n | Mean mark | MAE |
|---|---|---|---|
| AAA | 2442 | 68.9 | 6.98 |
| DDD | 9291 | 70.2 | 11.14 |
| EEE | 1242 | 77.2 | 8.70 |
| FFF | 10814 | 77.7 | 7.87 |

## Limitations
- Exact marks are hard to predict (marking noise, exam-day factors); the targets MAE ≤ 8 and R² ≥ 0.50 should be read against the averages above.
- Trained on OULAD; not yet validated on the app's own students.

## Upper bound (research only)
Same rows, splits and settings, adding OULAD-only data the app does not collect (prevAttempts, studiedCredits, registeredDaysBefore, clicksBefore, activeDaysBefore, clicks_oucontent, clicks_forumng, clicks_quiz, clicks_resource, clicks_subpage, clicks_homepage, clicks_url); demographics excluded on purpose. Not used by the app.

| | Deployed inputs | With richer data |
|---|---|---|
| Marks MAE | 9.10 | 9.05 |
| Marks R² | 0.474 | 0.472 |
| Early-warning AUC | 0.801 | 0.806 |
