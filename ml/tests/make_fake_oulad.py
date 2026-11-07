"""Write a small synthetic dataset in OULAD's exact file format, for testing the
training pipeline end to end. The numbers are invented; never report them."""
from pathlib import Path
import numpy as np
import pandas as pd

PRESENTATIONS = [('AAA', '2013J'), ('AAA', '2014J'), ('BBB', '2013B'), ('BBB', '2014B'),
                 ('CCC', '2014J'), ('DDD', '2013J'), ('DDD', '2014B'), ('EEE', '2014J')]


def write(out: Path, students_per_presentation: int = 120, seed: int = 0) -> Path:
    rng = np.random.default_rng(seed)
    out.mkdir(parents=True, exist_ok=True)
    assessments, info, reg, sa, vle = [], [], [], [], []
    next_assessment, next_student = 1000, 1
    for module, pres in PRESENTATIONS:
        ids = []
        for kind, day in [('TMA', 20), ('CMA', 30), ('TMA', 55), ('CMA', 70), ('TMA', 100), ('CMA', 120), ('Exam', None)]:
            assessments.append({'code_module': module, 'code_presentation': pres, 'id_assessment': next_assessment,
                                'assessment_type': kind, 'date': '?' if day is None else day,
                                'weight': 100 if kind == 'Exam' else 10})
            ids.append((next_assessment, kind, day if day is not None else 240)); next_assessment += 1
        for _ in range(students_per_presentation):
            sid = next_student; next_student += 1
            ability, engagement = rng.normal(), rng.normal()
            p_fail = 1 / (1 + np.exp(-(-0.3 - 1.2 * ability - 1.0 * engagement)))
            failed = rng.random() < p_fail
            withdrawn_day = int(rng.integers(5, 200)) if failed and rng.random() < 0.5 else None
            result = 'Withdrawn' if withdrawn_day else ('Fail' if failed else ('Distinction' if ability > 1.2 else 'Pass'))
            info.append({'code_module': module, 'code_presentation': pres, 'id_student': sid,
                         'gender': 'M' if rng.random() < 0.55 else 'F',
                         'age_band': ['0-35', '35-55', '55<='][int(rng.choice(3, p=[0.7, 0.28, 0.02]))],
                         'disability': 'Y' if rng.random() < 0.1 else 'N',
                         'num_of_prev_attempts': int(rng.random() < 0.15), 'studied_credits': int(rng.choice([30, 60, 90, 120])),
                         'imd_band': '?' if rng.random() < 0.03 else f'{10 * int(rng.integers(0, 10))}-{10 * int(rng.integers(0, 10)) + 10}%',
                         'final_result': result})
            reg.append({'code_module': module, 'code_presentation': pres, 'id_student': sid,
                        'date_registration': -10, 'date_unregistration': withdrawn_day if withdrawn_day else '?'})
            last_day = withdrawn_day or 260
            p_skip = 1 / (1 + np.exp(-(-2.5 - 1.2 * engagement)))       # disengaged students skip work
            p_late = 1 / (1 + np.exp(-(-1.0 - 1.0 * engagement)))       # ... and hand it in late
            for aid, kind, day in ids:
                if day >= last_day or (kind != 'Exam' and rng.random() < p_skip):
                    continue
                score = float(np.clip(65 + 15 * ability + rng.normal(0, 10), 0, 100))
                delay = int(rng.integers(1, 10)) if rng.random() < p_late else -int(rng.integers(0, 3))
                sa.append({'id_assessment': aid, 'id_student': sid, 'date_submitted': day + delay,
                           'is_banked': 0, 'score': '?' if rng.random() < 0.02 else round(score)})
            p_active = 1 / (1 + np.exp(-(0.8 + 1.0 * engagement)))
            for week in range(0, min(last_day, 260) // 7):
                if rng.random() < p_active:
                    vle.append({'code_module': module, 'code_presentation': pres, 'id_student': sid,
                                'id_site': int(rng.integers(1, 9)), 'date': week * 7 + int(rng.integers(0, 7)), 'sum_click': int(rng.integers(1, 30))})
    sites = [{'id_site': i, 'code_module': 'AAA', 'code_presentation': '2013J', 'activity_type': t}
             for i, t in enumerate(['oucontent', 'forumng', 'quiz', 'resource', 'subpage', 'homepage', 'url', 'glossary'], start=1)]
    pd.DataFrame(sites).to_csv(out / 'vle.csv', index=False)
    for name, rows in [('assessments', assessments), ('studentInfo', info), ('studentRegistration', reg),
                       ('studentAssessment', sa), ('studentVle', vle)]:
        pd.DataFrame(rows).to_csv(out / f'{name}.csv', index=False)
    return out
