"""Writes one model card per model (Mitchell et al., 2019, "Model Cards for Model Reporting") from
reports/evaluation_report.json, so the cards always show the latest measured numbers.

    python make_model_cards.py      (evaluate.py also runs it)

Output: reports/MODEL_CARD_early_warning.md, MODEL_CARD_marks.md, MODEL_CARD_risk_levels.md
"""
import json

from _paths import REPORTS


def pct(x):
    return '—' if x is None else f'{100 * x:.1f}%'


def num(x, d=3):
    return '—' if x is None else f'{x:.{d}f}'


def stat(rep, key, d=3, as_pct=False):
    v = (rep or {}).get(key)
    if not v:
        return '—'
    f = (lambda x: f'{100 * x:.1f}%') if as_pct else (lambda x: f'{x:.{d}f}')
    return f"{f(v['mean'])} ± {f(v['sd'])}"


def table(rows):
    head, *body = rows
    lines = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    lines += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in body]
    return '\n'.join(lines)


def fairness_rows(fair, cols):
    rows = [['Group', 'Value', 'n', *cols]]
    for group, values in (fair or {}).items():
        for value, m in values.items():
            rows.append([group, value, m.get('n', '—'), *[m.get('note') if 'note' in m and c != 'n' else
                         (pct(m.get(c)) if c in ('recall', 'false_positive_rate', 'at_risk_rate') else num(m.get(c), 2)) for c in cols]])
    return table(rows)


def early_warning(A):
    cm = A.get('confusion_matrix', [[0, 0], [0, 0]])
    (tn, fp), (fn, tp) = cm
    rep, tmp, cal = A.get('repeated_splits', {}), A.get('temporal_split') or {}, A.get('calibration', {})
    curve = A.get('cutoff_curve', [])
    fair_t = A.get('fairness_training', {})
    return f"""# Model card: early-warning (at-risk) model

**What it does.** Estimates the chance that a student will fail or withdraw, from online presence (in the app: lecture attendance) and the assessed work known so far, and flags students at or above a threshold. Used by the attendance-risk agent; a flag should lead to support, never to a penalty.

**Training data.** Open University Learning Analytics Dataset (OULAD), one row per student per module presentation, observed at a cut-off week (4–12). Students who had already left before the cut-off are excluded. OULAD has no attendance records: "attendance" is the share of weeks with any online activity.

**Model.** XGBoost classifier, settings {A.get('params')}, isotonic calibration and threshold {num(A.get('threshold'))} chosen on validation presentations (never on test). Gender is never an input.

## Results on unseen presentations
| Metric | Main test | 5 repeated splits | Future cohort (2013→2014) |
|---|---|---|---|
| AUC | {num(A.get('auc'))} | {stat(rep, 'model_auc')} | {num(tmp.get('model_auc'))} |
| Recall (struggling students caught) | {pct(A.get('recall'))} | {stat(rep, 'model_recall', as_pct=True)} | {pct(tmp.get('model_recall'))} |
| Precision (flags that were right) | {pct(A.get('precision'))} | {stat(rep, 'model_precision', as_pct=True)} | {pct(tmp.get('model_precision'))} |
| F1 | {num(A.get('f1'))} | {stat(rep, 'model_f1')} | {num(tmp.get('model_f1'))} |

Main test confusion matrix: TP {tp}, FN {fn}, FP {fp}, TN {tn}; specificity {pct(tn / (tn + fp) if tn + fp else None)}, false-alarm rate {pct(fp / (tn + fp) if tn + fp else None)}, missed {pct(fn / (fn + tp) if fn + tp else None)}.

**Against simple rules.** Best baseline AUC {stat(rep, 'best_baseline_auc')}; gain {stat(rep, 'auc_gain')} ({A.get('verdict', '')}).

**Calibration.** Brier {num(cal.get('brier'))} vs {num(cal.get('base_rate_brier'))} for a constant guess.

**Accuracy vs prediction week.**
{table([['Week', 'AUC', 'Recall', 'Precision'], *[[c['week'], num(c.get('model_auc')), pct(c.get('model_recall')), pct(c.get('model_precision'))] for c in curve if 'model_auc' in c]])}

## Fairness
{fairness_rows(A.get('fairness'), ['recall', 'false_positive_rate', 'auc'])}

Reweighing by gender (training only): {'used' if fair_t.get('reweighing_used') else 'not used'} ({fair_t.get('rule', '')}).

## Per course
{table([['Course', 'n', 'At-risk rate', 'AUC', 'Recall', 'False alarms'], *[[k, v['n'], pct(v['at_risk_rate']), num(v['auc']), pct(v['recall']), pct(v['false_positive_rate'])] for k, v in (A.get('by_course') or {}).items()]])}

## Limitations
- Trained on an online university; the app feeds it lecture attendance. Not yet validated on the app's own students.
- Earlier warnings are less accurate (see the week table).
- Differences between groups and between courses are reported above; check them again on the app's own data.
"""


def marks(L):
    rep, tmp = L.get('repeated_splits', {}), L.get('temporal_split') or {}
    ranges = L.get('range_80') or {}
    cov = L.get('range_coverage_test') or {}
    return f"""# Model card: marks-prediction model

**What it does.** Predicts a student's next assessment mark (0–100) with an 80% range, from their earlier marks, late and missed work, marks relative to the class, activity before the assessment, and what kind of assessment comes next. Used by the learning-analysis agent.

**Training data.** OULAD, one row per scored assessment (from each student's second onward), using only work dated before it.

**Model.** XGBoost regressor, settings {L.get('params')}, chosen by validation MAE (never on test).

## Results on unseen presentations
| Metric | Main test | 5 repeated splits | Future cohort | Simple rule (average so far) |
|---|---|---|---|---|
| MAE (marks) | {num(L.get('mae'), 2)} | {stat(rep, 'model_mae', 2)} | {num(tmp.get('model_mae'), 2)} | {stat(rep, 'baseline_mae', 2)} |
| R² | {num(L.get('r2'))} | {stat(rep, 'model_r2')} | {num(tmp.get('model_r2'))} | {stat(rep, 'baseline_r2')} |
| Improvement over the rule | — | {stat(rep, 'mae_improvement_pct', 1)}% | {num(tmp.get('mae_improvement_pct'), 1)}% | — |
| 80% range coverage | {pct(cov.get('all'))} | {stat(rep, 'range_coverage', as_pct=True)} | {pct(tmp.get('range_coverage'))} | — |

Range per assessment type on the main test: {', '.join(f'{k} {pct(v)}' for k, v in cov.items() if k != 'all')}. Widen factor applied: {(ranges.get('all') or {}).get('widen_factor', '—')}.

{L.get('verdict', '')}

## Per assessment type
The app predicts quizzes and assignments only (it has no exams), so the coursework row is the one that matches the deployed use; the overall row includes OULAD's exams.

{table([['Type', 'n', 'MAE', 'R²', 'Simple rule MAE', 'Improvement'], *[[v.get('label', k), v['n'], num(v['mae'], 2), num(v['r2']), num(v['baseline_mae'], 2), f"{v['improvement_pct']:.1f}%" if v.get('improvement_pct') is not None else '—'] for k, v in (L.get('by_assessment_type') or {}).items() if isinstance(v, dict) and 'mae' in v]]) if L.get('by_assessment_type') else 'Not computed yet: run `python per_type_results.py` (or retrain).'}

## Fairness (MAE per group)
{fairness_rows(L.get('fairness'), ['mae'])}

## Per course
{table([['Course', 'n', 'Mean mark', 'MAE'], *[[k, v['n'], num(v['mean_target'], 1), num(v['mae'], 2)] for k, v in (L.get('by_course') or {}).items()]])}

## Limitations
- Exact marks are hard to predict (marking noise, exam-day factors); the targets MAE ≤ 8 and R² ≥ 0.50 should be read against the averages above.
- Trained on OULAD; not yet validated on the app's own students.
"""


def risk_levels(C):
    if not isinstance(C, dict):
        return '# Model card: combined risk levels\n\nNot run yet: `python calibrate_risk_score.py`.\n'
    d, h = C['data_driven'], C['hand_set']
    rows = [['Level', 'Target rate', 'Hand-set: n / observed', 'Data-driven: n / observed']]
    targets = {'LOW': '< 25%', 'MEDIUM': '25–50%', 'HIGH': '50–75%', 'CRITICAL': '> 75%'}
    for lvl in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'):
        rows.append([lvl, targets[lvl], f"{h['levels'][lvl]['n']} / {pct(h['levels'][lvl]['observed_fail_or_withdraw_rate'])}",
                     f"{d['levels'][lvl]['n']} / {pct(d['levels'][lvl]['observed_fail_or_withdraw_rate'])}"])
    return f"""# Model card: combined risk levels (LOW / MEDIUM / HIGH / CRITICAL)

**What it does.** Combines the early-warning probability, a learning risk from the predicted mark, and a knowledge-gap risk into one 0–100 score and a level shown to faculty.

**How it was set.** On OULAD validation presentations: learning risk learned from the predicted mark, attendance/learning weight {d['attendance_vs_learning_weight']}, level cut-offs {d['cutoffs']}. The knowledge-gap weight is hand-set and untested ({C.get('knowledge_part', '')}).

## Results on unseen presentations
AUC: data-driven {num(d['auc'])} vs hand-set {num(h['auc'])} (early-warning model alone {num(C.get('early_warning_alone_auc'))}).

{table(rows)}

{C.get('verdict', '')}
"""


def upper_bound(U):
    if not isinstance(U, dict):
        return ''
    lm, ew = U['marks']['average'], U['early_warning']['average']
    return f"""
## Upper bound (research only)
Same rows, splits and settings, adding OULAD-only data the app does not collect ({', '.join(U['extra_inputs'])}); demographics excluded on purpose. Not used by the app.

| | Deployed inputs | With richer data |
|---|---|---|
| Marks MAE | {num(lm['deployed_inputs']['mae'], 2)} | {num(lm['with_richer_data']['mae'], 2)} |
| Marks R² | {num(lm['deployed_inputs']['r2'])} | {num(lm['with_richer_data']['r2'])} |
| Early-warning AUC | {num(ew['deployed_inputs']['auc'])} | {num(ew['with_richer_data']['auc'])} |
"""


def write_model_cards(report: dict) -> list[str]:
    files = {
        'MODEL_CARD_early_warning.md': early_warning(report.get('attendance_risk', {})),
        'MODEL_CARD_marks.md': marks(report.get('learning_analysis', {})) + upper_bound(report.get('upper_bound')),
        'MODEL_CARD_risk_levels.md': risk_levels(report.get('combined_risk')),
    }
    for name, text in files.items():
        (REPORTS / name).write_text(text, encoding='utf-8')
    return list(files)


if __name__ == '__main__':
    written = write_model_cards(json.loads((REPORTS / 'evaluation_report.json').read_text(encoding='utf-8')))
    print('Wrote', ', '.join(written))
