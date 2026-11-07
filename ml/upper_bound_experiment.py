"""UPPER-BOUND experiment (research only): how much better could the models get with data
the app does not collect? Nothing trained here is saved for the app.

Both models are trained twice on the SAME rows, splits and settings (the deployed models'
saved settings): once with the deployed inputs, once adding OULAD-only data:
  prevAttempts, studiedCredits          (studentInfo: earlier attempts at the module, study load)
  registeredDaysBefore                  (studentRegistration: how early they registered)
  clicksBefore, activeDaysBefore        (all online activity before the prediction time)
  clicks_<type>                         (clicks by activity type: content, forum, quiz, resource...)
Demographics (gender, age, disability, region, deprivation) are deliberately NOT used.

The gap between the two shows what richer data would buy, i.e. which data the app should
start collecting. Writes reports/upper_bound.json and adds it to evaluation_report.json.

    python upper_bound_experiment.py
"""
import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier, XGBRegressor

from _paths import DATA, MODELS, REPORTS, require
from oulad_features import (ATTENDANCE_FEATURES, KEY, LEARNING_FEATURES, assessment_history, build_attendance_frame,
                            build_learning_frame, presentation_groups, vle_weeks)

SEED = 42
REPEATS = int(os.environ.get('ML_UPPER_REPEATS', '3'))
ACTIVITY_TYPES = ('oucontent', 'forumng', 'quiz', 'resource', 'subpage', 'homepage', 'url')


class ActivityIndex:
    """Fast 'clicks before day d' lookups per student-presentation and activity type."""

    def __init__(self, student_vle: pd.DataFrame, vle: pd.DataFrame):
        site_type = vle.set_index('id_site')['activity_type']
        site_type = site_type.where(site_type.isin(ACTIVITY_TYPES), 'other').astype('category')
        sv = student_vle[KEY + ['date', 'sum_click']].copy()
        sv['activity_type'] = student_vle['id_site'].map(site_type).astype(site_type.dtype)
        daily = sv.groupby(KEY + ['date', 'activity_type'], sort=True, observed=True)['sum_click'].sum().reset_index()
        del sv
        daily['code_module'] = daily['code_module'].astype(str)
        daily['code_presentation'] = daily['code_presentation'].astype(str)
        daily['activity_type'] = daily['activity_type'].astype(str)
        self.total, self.by_type, self.days = {}, {}, {}
        for key, g in daily.groupby(KEY, sort=False):
            per_day = g.groupby('date')['sum_click'].sum()
            self.total[key] = (per_day.index.to_numpy(), np.cumsum(per_day.to_numpy()))
            self.days[key] = per_day.index.to_numpy()
            self.by_type[key] = {t: (gt['date'].to_numpy(), np.cumsum(gt['sum_click'].to_numpy()))
                                 for t, gt in g.groupby('activity_type')}

    @staticmethod
    def _before(series, day):
        if series is None:
            return 0.0
        dates, cum = series
        i = np.searchsorted(dates, day, side='left')
        return float(cum[i - 1]) if i > 0 else 0.0

    def features(self, key, day) -> dict:
        out = {'clicksBefore': self._before(self.total.get(key), day),
               'activeDaysBefore': float(np.searchsorted(self.days[key], day)) if key in self.days else 0.0}
        types = self.by_type.get(key, {})
        for t in ACTIVITY_TYPES:
            out[f'clicks_{t}'] = self._before(types.get(t), day)
        return out


EXTRA = ['prevAttempts', 'studiedCredits', 'registeredDaysBefore', 'clicksBefore', 'activeDaysBefore',
         *[f'clicks_{t}' for t in ACTIVITY_TYPES]]


def add_extras(frame: pd.DataFrame, day_col: str, info: pd.DataFrame, registration: pd.DataFrame, index: ActivityIndex) -> pd.DataFrame:
    static = info[KEY + ['num_of_prev_attempts', 'studied_credits']].merge(
        registration[KEY + ['date_registration']], on=KEY, how='left')
    static = static.rename(columns={'num_of_prev_attempts': 'prevAttempts', 'studied_credits': 'studiedCredits'})
    static['registeredDaysBefore'] = -pd.to_numeric(static.pop('date_registration'), errors='coerce')
    frame = frame.merge(static, on=KEY, how='left')
    acts = [index.features(tuple(k), d) for k, d in zip(frame[KEY].itertuples(index=False), frame[day_col])]
    return pd.concat([frame.reset_index(drop=True), pd.DataFrame(acts)], axis=1)


def splits(frame: pd.DataFrame):
    groups = presentation_groups(frame)
    yield next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
    yield from GroupShuffleSplit(n_splits=REPEATS, test_size=0.2, random_state=SEED + 1).split(frame, groups=groups)


def compare(frame, base_cols, extra_cols, make, score, name):
    rows = []
    for i, (tr, te) in enumerate(splits(frame)):
        train, test = frame.iloc[tr], frame.iloc[te]
        if name == 'early_warning' and test['target'].nunique() < 2:
            continue
        r = {'split': 'main' if i == 0 else f'repeat {i}'}
        for label, cols in (('deployed_inputs', base_cols), ('with_richer_data', base_cols + extra_cols)):
            model = make().fit(train[cols], train['target'])
            r[label] = score(test, model, cols)
        rows.append(r)
    keys = rows[0]['deployed_inputs'].keys()
    mean = lambda lab, k: float(np.mean([r[lab][k] for r in rows]))
    return {'splits': rows,
            'average': {lab: {k: mean(lab, k) for k in keys} for lab in ('deployed_inputs', 'with_richer_data')}}


def main():
    require('studentInfo.csv', 'studentVle.csv', 'studentRegistration.csv', 'studentAssessment.csv', 'assessments.csv', 'vle.csv')
    learn_params = joblib.load(MODELS / 'learning_analysis_v1.pkl').get('params', {})
    att_params = joblib.load(MODELS / 'attendance_risk_v1.pkl').get('params', {})
    info = pd.read_csv(DATA / 'studentInfo.csv', na_values=['?'])
    registration = pd.read_csv(DATA / 'studentRegistration.csv', na_values=['?'])
    sa = pd.read_csv(DATA / 'studentAssessment.csv', na_values=['?'])
    a = pd.read_csv(DATA / 'assessments.csv', na_values=['?'])
    student_vle = pd.read_csv(DATA / 'studentVle.csv', dtype={'id_student': 'int32', 'id_site': 'int32', 'date': 'int16', 'sum_click': 'int32',
                                                               'code_module': 'category', 'code_presentation': 'category'})
    vle = pd.read_csv(DATA / 'vle.csv')
    print('Indexing online activity by type...')
    index = ActivityIndex(student_vle, vle)
    weeks = vle_weeks(student_vle[KEY + ['date']].astype({'code_module': str, 'code_presentation': str}))
    del student_vle

    print('Marks model: deployed inputs vs richer data...')
    lf = build_learning_frame(sa, a, target='next', weeks_by_key=weeks)
    # Each row predicts a student's (step+1)-th scored assessment (sorted as in oulad_features.learning_rows);
    # its date is the prediction time, so only activity BEFORE it is counted.
    merged = sa.merge(a[['id_assessment', 'code_module', 'code_presentation', 'date']], on='id_assessment')
    merged['order_date'] = pd.to_numeric(merged['date'], errors='coerce').fillna(pd.to_numeric(merged['date_submitted'], errors='coerce'))
    scored = merged.dropna(subset=['score']).sort_values(KEY + ['order_date', 'id_assessment'])
    dates = scored.groupby(KEY)['order_date'].apply(list).to_dict()
    lf['predict_day'] = [dates.get(tuple(k), [np.nan])[s] if s < len(dates.get(tuple(k), [])) else np.nan
                         for k, s in zip(lf[KEY].itertuples(index=False), lf['step'])]
    lf = add_extras(lf, 'predict_day', info, registration, index)
    learn = compare(
        lf, LEARNING_FEATURES, EXTRA,
        lambda: XGBRegressor(random_state=SEED, **{'objective': 'reg:squarederror', **learn_params}),
        lambda test, m, cols: {'mae': float(mean_absolute_error(test['target'], m.predict(test[cols]))),
                               'r2': float(r2_score(test['target'], m.predict(test[cols])))},
        'marks')

    print('Early-warning model: deployed inputs vs richer data...')
    af = build_attendance_frame(info, weeks, registration, seed=SEED, history=assessment_history(sa, a))
    af['predict_day'] = af['attendanceCount'] * 7
    af = add_extras(af, 'predict_day', info, registration, index)
    early = compare(
        af, ATTENDANCE_FEATURES, EXTRA,
        lambda: XGBClassifier(eval_metric='logloss', random_state=SEED, **att_params),
        lambda test, m, cols: {'auc': float(roc_auc_score(test['target'], m.predict_proba(test[cols])[:, 1]))},
        'early_warning')

    la, ea = learn['average'], early['average']
    result = {
        'purpose': 'research only: what richer data (not collected by the app) would add; no model here is used by the app',
        'extra_inputs': EXTRA,
        'excluded_on_purpose': ['gender', 'age_band', 'disability', 'region', 'imd_band', 'highest_education'],
        'same_settings_as_deployed': {'marks': learn_params, 'early_warning': att_params},
        'marks': learn,
        'early_warning': early,
        'summary': (f"Marks MAE {la['deployed_inputs']['mae']:.2f} -> {la['with_richer_data']['mae']:.2f}, "
                    f"R² {la['deployed_inputs']['r2']:.3f} -> {la['with_richer_data']['r2']:.3f}; "
                    f"early-warning AUC {ea['deployed_inputs']['auc']:.3f} -> {ea['with_richer_data']['auc']:.3f} "
                    f"(average over {len(learn['splits'])} splits)"),
    }
    (REPORTS / 'upper_bound.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    report_path = REPORTS / 'evaluation_report.json'
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding='utf-8'))
        report['upper_bound'] = result
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(result['summary'])


if __name__ == '__main__':
    main()
