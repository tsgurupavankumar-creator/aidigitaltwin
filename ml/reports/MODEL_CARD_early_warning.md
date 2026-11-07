# Model card: early-warning (at-risk) model

**What it does.** Estimates the chance that a student will fail or withdraw, from online presence (in the app: lecture attendance) and the assessed work known so far, and flags students at or above a threshold. Used by the attendance-risk agent; a flag should lead to support, never to a penalty.

**Training data.** Open University Learning Analytics Dataset (OULAD), one row per student per module presentation, observed at a cut-off week (4–12). Students who had already left before the cut-off are excluded. OULAD has no attendance records: "attendance" is the share of weeks with any online activity.

**Model.** XGBoost classifier, settings {'max_depth': 3, 'learning_rate': 0.05, 'n_estimators': 300}, isotonic calibration and threshold 0.405 chosen on validation presentations (never on test). Gender is never an input.

## Results on unseen presentations
| Metric | Main test | 5 repeated splits | Future cohort (2013→2014) |
|---|---|---|---|
| AUC | 0.799 | 0.782 ± 0.027 | 0.785 |
| Recall (struggling students caught) | 72.3% | 70.2% ± 5.0% | 68.6% |
| Precision (flags that were right) | 64.5% | 63.4% ± 3.8% | 66.2% |
| F1 | 0.682 | 0.665 ± 0.032 | 0.674 |

Main test confusion matrix: TP 1166, FN 447, FP 642, TN 1538; specificity 70.6%, false-alarm rate 29.4%, missed 27.7%.

**Against simple rules.** Best baseline AUC 0.686 ± 0.033; gain 0.095 ± 0.021 (beats the baseline consistently: +0.095 AUC over the stronger baseline on average over 5 splits (sd 0.021)).

**Calibration.** Brier 0.176 vs 0.244 for a constant guess.

**Accuracy vs prediction week.**
| Week | AUC | Recall | Precision |
|---|---|---|---|
| 4 | 0.748 | 85.4% | 53.6% |
| 6 | 0.759 | 71.0% | 61.8% |
| 8 | 0.796 | 68.5% | 66.8% |
| 10 | 0.820 | 73.0% | 66.1% |
| 12 | 0.819 | 74.7% | 63.4% |

## Fairness
| Group | Value | n | recall | false_positive_rate | auc |
|---|---|---|---|---|---|
| gender | F | 1043 | 73.9% | 35.4% | 0.77 |
| gender | M | 2750 | 71.7% | 27.1% | 0.81 |
| age_band | 0-35 | 2549 | 72.5% | 27.6% | 0.81 |
| age_band | 35-55 | 1182 | 70.9% | 32.2% | 0.77 |
| age_band | 55<= | 62 | 92.9% | 39.6% | 0.89 |
| disability | N | 3490 | 71.6% | 29.7% | 0.80 |
| disability | Y | 303 | 78.1% | 25.2% | 0.84 |
| imd_band | 0-10% | 302 | 70.8% | 25.2% | 0.82 |
| imd_band | 10-20 | 328 | 78.5% | 31.4% | 0.81 |
| imd_band | 20-30% | 401 | 75.8% | 30.5% | 0.81 |
| imd_band | 30-40% | 383 | 70.7% | 30.5% | 0.79 |
| imd_band | 40-50% | 357 | 72.4% | 26.9% | 0.82 |
| imd_band | 50-60% | 368 | 75.3% | 32.0% | 0.82 |
| imd_band | 60-70% | 346 | 67.9% | 30.2% | 0.75 |
| imd_band | 70-80% | 384 | 70.5% | 30.6% | 0.76 |
| imd_band | 80-90% | 347 | 77.0% | 29.8% | 0.80 |
| imd_band | 90-100% | 393 | 66.9% | 28.0% | 0.79 |
| imd_band | missing | 184 | 55.3% | 27.0% | 0.72 |

Reweighing by gender (training only): not used (reweighing kept only if validation false-alarm gap falls by >= 25% and validation AUC drops by <= 0.01).

## Per course
| Course | n | At-risk rate | AUC | Recall | False alarms |
|---|---|---|---|---|---|
| AAA | 707 | 24.9% | 0.763 | 90.3% | 61.8% |
| DDD | 1092 | 53.3% | 0.855 | 78.5% | 23.5% |
| EEE | 587 | 39.2% | 0.838 | 65.2% | 13.4% |
| FFF | 1407 | 44.4% | 0.812 | 64.0% | 18.7% |

## Limitations
- Trained on an online university; the app feeds it lecture attendance. Not yet validated on the app's own students.
- Earlier warnings are less accurate (see the week table).
- Differences between groups and between courses are reported above; check them again on the app's own data.
