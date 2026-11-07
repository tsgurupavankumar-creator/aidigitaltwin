"""Leakage-free feature construction from the Open University Learning Analytics
Dataset (OULAD), shared by both training scripts and their tests.

Every row is one student on one module presentation, i.e. the key
(id_student, code_module, code_presentation). The previous scripts keyed on
id_student alone, which merged a student's different modules into one row.

The rule that removes the leakage found in the October audit: a feature may
only use information dated strictly before the thing being predicted.

Learning model (target = the student's LAST scored assessment):
    avgQuizScore        mean of EARLIER computer-marked assessments (CMA)
    avgSubmissionScore  mean of EARLIER tutor-marked assessments (TMA)
    avgMastery          mean of ALL earlier assessments. OULAD has no concept
                        mastery, so this is a stand-in; the live system fills
                        it with concept mastery. Documented, not hidden.
    quizCount           number of earlier CMAs, capped at 10 (the live agent
                        reads at most the latest 10 quiz attempts)
    submissionCount     number of earlier TMAs, capped at 20 (live agent: 20)
    quizTrend           newest earlier CMA minus oldest of the latest 10,
                        matching the live agent's definition
  Students need at least one earlier assessment; the target never appears in
  any feature.

Learning model, extra history features (all from EARLIER assessments):
    lastScore, scoreTrend (newest minus oldest), scoreStd; lateCount and
    missedCount over tutor-marked assignments (the app's quizzes have no due
    date) due before the predicted assessment.

Attendance / early-warning model (target = final_result is Fail or Withdrawn):
  OULAD has no attendance records. The stand-in is ONLINE PRESENCE: a week
  counts as "attended" if the student used the virtual learning environment
  (VLE) at all that week. Unlike the old proxy, it contains no assessment
  scores and no click-volume formula.
    For each row a cut-off week c (4..12, fixed per row by a seeded draw) is
    chosen and only weeks 0..c-1 are used:
    currentAttendance   % of those weeks with any VLE activity
    recentAttendance    % for the second half of those weeks (the live agent
                        uses the second half of its records)
    attendanceCount     number of weeks observed (= c)
    absenceRate         1 - currentAttendance / 100
  Students who had already unregistered before the cut-off are excluded: their
  outcome is known at prediction time, so including them would leak it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

KEY = ['id_student', 'code_module', 'code_presentation']
LEARNING_FEATURES = ['avgMastery', 'avgQuizScore', 'avgSubmissionScore', 'quizCount', 'submissionCount', 'quizTrend',
                     'lastScore', 'scoreTrend', 'scoreStd', 'lateCount', 'missedCount',
                     'nextIsAssignment', 'nextIsExam', 'relativeToClass', 'classAvgPrior', 'presenceRate', 'recentPresenceRate',
                     'daysSincePrevious']
RECENT_WEEKS = 4
ATTENDANCE_FEATURES = ['currentAttendance', 'recentAttendance', 'attendanceCount', 'absenceRate',
                       'earlyAvgScore', 'earlyAssessedCount', 'earlyMissedCount', 'earlyLateCount',
                       'presenceVsClass', 'scoreVsClass']
QUIZ_CAP, SUBMISSION_CAP = 10, 20
MIN_WEEKS, MAX_WEEKS = 4, 12


def _mean(values) -> float:
    return float(np.mean(values)) if len(values) else np.nan


def context_features(earlier: pd.DataFrame, target_type: str | None, target_date: float,
                     class_mean: dict | None, active_weeks: set | None) -> dict:
    """Version 6 context, all known before the predicted assessment:
      nextIsAssignment / nextIsExam  what is being predicted (quiz = both 0); the
                                     app knows whether the next item is a quiz or an assignment
      relativeToClass                mean of (student score - class mean) over earlier assessments
      classAvgPrior                  mean class score on those earlier assessments (how hard they were)
      presenceRate, recentPresenceRate  share of weeks with any activity before the assessment,
                                     overall and in the last 4 weeks (the app: lecture attendance)
    Unknown values are NaN, never 0."""
    means = [class_mean.get(a) for a in earlier['id_assessment']] if class_mean else []
    pairs = [(sc, m) for sc, m in zip(earlier['score'].astype(float), means) if m is not None and pd.notna(m)]
    week = int(target_date // 7) if pd.notna(target_date) else 0
    if active_weeks is not None and week > 0:
        presence = sum(1 for w in range(week) if w in active_weeks) / week
        recent_span = range(max(0, week - RECENT_WEEKS), week)
        recent = sum(1 for w in recent_span if w in active_weeks) / len(recent_span)
    else:
        presence = recent = np.nan
    last_date = pd.to_numeric(earlier['order_date'], errors='coerce').max() if 'order_date' in earlier and len(earlier) else np.nan
    return {
        # days between the student's previous scored assessment and this one (app: since last scored work)
        'daysSincePrevious': float(target_date - last_date) if pd.notna(last_date) and pd.notna(target_date) else np.nan,
        'nextIsAssignment': 1 if target_type == 'TMA' else 0,
        'nextIsExam': 1 if target_type == 'Exam' else 0,
        'relativeToClass': float(np.mean([sc - m for sc, m in pairs])) if pairs else np.nan,
        'classAvgPrior': float(np.mean([m for _, m in pairs])) if pairs else np.nan,
        'presenceRate': presence,
        'recentPresenceRate': recent,
    }


def history_features(earlier: pd.DataFrame, tma_due: list[tuple[int, float]], target_date: float, handed_in: set) -> dict:
    """The 11 learning features from assessments dated before the prediction
    (`earlier`: scored rows sorted by date). Also the naive baseline."""
    cma = earlier.loc[earlier['assessment_type'] == 'CMA', 'score'].astype(float).tolist()
    tma = earlier.loc[earlier['assessment_type'] == 'TMA', 'score'].astype(float).tolist()
    latest_cma = cma[-QUIZ_CAP:]
    scores = earlier['score'].astype(float).tolist()
    # Lateness and missed work: tutor-marked assignments only (the app's quizzes
    # have no due date, its assignments do), due before the predicted assessment.
    tma_rows = earlier[earlier['assessment_type'] == 'TMA']
    due = pd.to_numeric(tma_rows['date'], errors='coerce') if 'date' in tma_rows else pd.Series(dtype=float)
    submitted = pd.to_numeric(tma_rows['date_submitted'], errors='coerce') if 'date_submitted' in tma_rows else pd.Series(dtype=float)
    late = int(((submitted > due) & due.notna() & submitted.notna()).sum())
    missed = sum(1 for aid, d in tma_due if d < target_date and aid not in handed_in)
    mean_all = _mean(scores)
    return {
        'avgMastery': mean_all,
        'avgQuizScore': _mean(latest_cma),
        'avgSubmissionScore': _mean(tma[-SUBMISSION_CAP:]),
        'quizCount': len(latest_cma),
        'submissionCount': min(len(tma), SUBMISSION_CAP),
        'quizTrend': float(latest_cma[-1] - latest_cma[0]) if len(latest_cma) > 1 else 0.0,
        'lastScore': float(scores[-1]),
        'scoreTrend': float(scores[-1] - scores[0]) if len(scores) > 1 else 0.0,
        'scoreStd': float(np.std(scores)),
        'lateCount': late,
        'missedCount': missed,
        'baseline': mean_all,
    }


def _sorted_scored(history: pd.DataFrame) -> pd.DataFrame:
    return history.dropna(subset=['score']).sort_values(['order_date', 'id_assessment'])


def learning_row(history: pd.DataFrame, tma_due: list[tuple[int, float]] | None = None) -> dict | None:
    """Features and target for predicting the student's LAST scored assessment
    (version 1-4 target). None with fewer than two scored assessments."""
    scored = _sorted_scored(history)
    if len(scored) < 2:
        return None
    target_row = scored.iloc[-1]
    handed_in = set(history['id_assessment'].tolist())
    earlier = scored.iloc[:-1]
    row = history_features(earlier, tma_due or [], float(target_row['order_date']), handed_in)
    row.update(context_features(earlier, target_row['assessment_type'], float(target_row['order_date']), None, None))
    return {**row, 'target': float(target_row['score'])}


def learning_rows(history: pd.DataFrame, tma_due: list[tuple[int, float]] | None = None,
                  class_mean: dict | None = None, active_weeks: set | None = None) -> list[dict]:
    """One row per scored assessment from the second onward, each predicted
    from the assessments dated before it: the "next assessment" task the app
    performs. A submission only counts as handed in if it was submitted
    before the assessment being predicted."""
    scored = _sorted_scored(history)
    rows = []
    for k in range(1, len(scored)):
        target_row = scored.iloc[k]
        target_date = float(target_row['order_date'])
        submitted = pd.to_numeric(history['date_submitted'], errors='coerce') if 'date_submitted' in history else None
        handed_in = set(history.loc[submitted < target_date, 'id_assessment'].tolist()) if submitted is not None else set()
        earlier = scored.iloc[:k]
        feats = history_features(earlier, tma_due or [], target_date, handed_in)
        feats.update(context_features(earlier, target_row['assessment_type'], target_date, class_mean, active_weeks))
        rows.append({**feats, 'target': float(target_row['score']), 'step': k, 'target_type': target_row['assessment_type']})
    return rows


def class_means(student_assessment: pd.DataFrame) -> dict:
    """Mean score per assessment across all students who sat it."""
    return pd.to_numeric(student_assessment['score'], errors='coerce').groupby(student_assessment['id_assessment']).mean().to_dict()


def build_learning_frame(student_assessment: pd.DataFrame, assessments: pd.DataFrame, target: str = 'next',
                         weeks_by_key: dict | None = None) -> pd.DataFrame:
    """target='next': one row per assessment (version 5+); 'last': one row per student-presentation.
    weeks_by_key (from vle_weeks) enables the presence features; without it they are NaN."""
    merged = student_assessment.merge(
        assessments[['id_assessment', 'code_module', 'code_presentation', 'assessment_type', 'date']],
        on='id_assessment', how='inner',
    )
    # Order by the assessment's scheduled date; fall back to the submission day
    # when OULAD has no scheduled date (common for exams).
    merged['order_date'] = pd.to_numeric(merged['date'], errors='coerce').fillna(
        pd.to_numeric(merged['date_submitted'], errors='coerce')
    )
    tma = assessments[assessments['assessment_type'] == 'TMA'].copy()
    tma['date'] = pd.to_numeric(tma['date'], errors='coerce')
    tma_due = {k: list(zip(g['id_assessment'], g['date'])) for k, g in tma.dropna(subset=['date']).groupby(['code_module', 'code_presentation'])}
    means = class_means(student_assessment)
    rows = []
    for key, group in merged.groupby(KEY, sort=False):
        due = tma_due.get((key[1], key[2]), [])
        weeks = weeks_by_key.get(key, set()) if weeks_by_key is not None else None
        if target == 'last':
            row = learning_row(group, due)
            if row is not None:
                rows.append(dict(zip(KEY, key), **row))
        else:
            rows.extend(dict(zip(KEY, key), **r) for r in learning_rows(group, due, means, weeks))
    frame = pd.DataFrame(rows)
    if frame.empty:
        return frame
    # A student with no earlier CMA (or TMA) has no value for that average.
    # Use the mean of everything earlier, never 0 (which would read as "scored zero").
    for column in ('avgQuizScore', 'avgSubmissionScore'):
        frame[column] = frame[column].fillna(frame['avgMastery'])
    return frame


def cutoff_week(id_student: int, code_module: str, code_presentation: str, seed: int = 42) -> int:
    """Deterministic per-row cut-off week in [MIN_WEEKS, MAX_WEEKS]."""
    token = f'{seed}:{id_student}:{code_module}:{code_presentation}'
    value = sum((i + 1) * ord(ch) for i, ch in enumerate(token))
    return MIN_WEEKS + value % (MAX_WEEKS - MIN_WEEKS + 1)


def attendance_row(active_weeks: set[int], weeks: int) -> dict:
    observed = list(range(weeks))
    attended = [1 if w in active_weeks else 0 for w in observed]
    current = 100.0 * sum(attended) / weeks
    recent_half = attended[weeks // 2:]
    recent = 100.0 * sum(recent_half) / len(recent_half)
    return {
        'currentAttendance': current,
        'recentAttendance': recent,
        'attendanceCount': weeks,
        'absenceRate': 1.0 - current / 100.0,
    }


def vle_weeks(vle: pd.DataFrame) -> dict:
    """Weeks with any VLE activity per student-presentation (computed once; the file is large).
    Duplicate (student, week) pairs are dropped first, so memory stays small on 10M+ rows."""
    date = pd.to_numeric(vle['date'], errors='coerce')
    keep = date >= 0
    weeks = pd.DataFrame({k: vle.loc[keep, k] for k in KEY}).assign(week=(date[keep] // 7).astype('int16'))
    weeks = weeks.drop_duplicates()
    out: dict = {}
    for key, w in zip(weeks[KEY].itertuples(index=False, name=None), weeks['week']):
        out.setdefault(key, set()).add(int(w))
    return out


def assessment_history(student_assessment: pd.DataFrame | None, assessments: pd.DataFrame | None):
    """Per student-presentation submissions, and per presentation the TMA due dates."""
    if student_assessment is None or assessments is None:
        return {}, {}
    a = assessments[['id_assessment', 'code_module', 'code_presentation', 'assessment_type', 'date']].copy()
    a['date'] = pd.to_numeric(a['date'], errors='coerce')
    merged = student_assessment.merge(a, on='id_assessment', how='inner')
    merged['date_submitted'] = pd.to_numeric(merged['date_submitted'], errors='coerce')
    merged['score'] = pd.to_numeric(merged['score'], errors='coerce')
    cols = ['id_assessment', 'assessment_type', 'date', 'date_submitted', 'score']
    by_key = {k: g[cols].to_dict('records') for k, g in merged.groupby(KEY)}
    tma = a[(a['assessment_type'] == 'TMA') & a['date'].notna()]
    tma_due = {k: list(zip(g['id_assessment'], g['date'])) for k, g in tma.groupby(['code_module', 'code_presentation'])}
    return by_key, tma_due


def early_row(submissions: list[dict], tma_due: list[tuple[int, float]], cutoff_day: float, class_mean: dict | None = None) -> dict:
    """What is known about a student's assessed work at the cut-off day. A
    submission made on or after the cut-off is not known yet, so it cannot be
    used, and a TMA due before the cut-off without a known submission counts
    as missed (so far). earlyAvgScore is NaN when nothing has been scored yet
    (unknown, not zero)."""
    known = [r for r in submissions if pd.notna(r['date_submitted']) and r['date_submitted'] < cutoff_day]
    scored = [r['score'] for r in known if pd.notna(r['score'])]
    known_ids = {r['id_assessment'] for r in known}
    late = sum(1 for r in known if r['assessment_type'] == 'TMA' and pd.notna(r['date']) and r['date_submitted'] > r['date'])
    missed = sum(1 for aid, due in tma_due if due < cutoff_day and aid not in known_ids)
    diffs = [r['score'] - class_mean[r['id_assessment']] for r in known
             if pd.notna(r['score']) and class_mean and pd.notna(class_mean.get(r['id_assessment'], np.nan))]
    return {
        # scoreVsClass: mean of (student score - class mean) on the same known work; NaN when none
        'scoreVsClass': float(np.mean(diffs)) if diffs else np.nan,
        'earlyAvgScore': float(np.mean(scored)) if scored else np.nan,
        'earlyAssessedCount': len(scored),
        'earlyMissedCount': missed,
        'earlyLateCount': late,
    }


def build_attendance_frame(info: pd.DataFrame, vle: pd.DataFrame | dict, registration: pd.DataFrame, seed: int = 42,
                           student_assessment: pd.DataFrame | None = None, assessments: pd.DataFrame | None = None,
                           fixed_weeks: int | None = None, history=None) -> pd.DataFrame:
    """One row per student-presentation, observed up to a cut-off week: online
    presence (attendance stand-in) plus, when the assessment files are given,
    what is known about their assessed work by then. `fixed_weeks` uses the
    same cut-off for everyone (for the accuracy-vs-timing curve); otherwise
    each row gets a seeded cut-off in 4..12 weeks. `vle` may be the dict from
    vle_weeks() and `history` the tuple from assessment_history(), to avoid
    recomputing them."""
    weeks_by_key = vle if isinstance(vle, dict) else vle_weeks(vle)
    by_key, tma_due = history if history is not None else assessment_history(student_assessment, assessments)
    scores_by_item: dict = {}
    for rows_ in by_key.values():
        for r in rows_:
            if pd.notna(r['score']):
                scores_by_item.setdefault(r['id_assessment'], []).append(r['score'])
    item_means = {k: float(np.mean(v)) for k, v in scores_by_item.items()}
    # Class presence: % of weeks 0..w-1 active, averaged over everyone in the presentation (activity only, no outcomes).
    members: dict = {}
    for k in info[KEY].itertuples(index=False):
        members.setdefault((k[1], k[2]), []).append(tuple(k))
    presence_cache: dict = {}

    def class_presence(pres, w):
        if (pres, w) not in presence_cache:
            vals = [100 * sum(1 for x in weeks_by_key.get(m, set()) if x < w) / w for m in members.get(pres, [])]
            presence_cache[(pres, w)] = float(np.mean(vals)) if vals else np.nan
        return presence_cache[(pres, w)]
    with_assessments = history is not None or (student_assessment is not None and assessments is not None)
    unregistered = pd.to_numeric(registration.set_index(KEY)['date_unregistration'], errors='coerce')
    rows = []
    for record in info[KEY + ['final_result']].itertuples(index=False):
        key = (record.id_student, record.code_module, record.code_presentation)
        weeks = fixed_weeks or cutoff_week(*key, seed=seed)
        left_on = unregistered.get(key, np.nan)
        if pd.notna(left_on) and left_on < weeks * 7:
            continue  # outcome already known at the cut-off: would leak the label
        active = {w for w in weeks_by_key.get(key, set()) if w < weeks}
        row = dict(zip(KEY, key), **attendance_row(active, weeks))
        # presenceVsClass: this student's presence minus the class average over the same weeks
        row['presenceVsClass'] = row['currentAttendance'] - class_presence((key[1], key[2]), weeks)
        if with_assessments:
            row.update(early_row(by_key.get(key, []), tma_due.get((key[1], key[2]), []), weeks * 7, item_means))
        else:
            row['scoreVsClass'] = np.nan
        row['target'] = int(record.final_result in ('Fail', 'Withdrawn'))
        rows.append(row)
    return pd.DataFrame(rows)


def presentation_groups(frame: pd.DataFrame) -> pd.Series:
    """Group label for splitting: no module presentation is in both sets."""
    return frame['code_module'].astype(str) + '_' + frame['code_presentation'].astype(str)
