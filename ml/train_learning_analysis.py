"""Train the learning model: predict each student's NEXT scored assessment from
the assessments dated before it (version 5; versions 1-4 predicted only the
last one). One row per assessment from the second onward.

Protocol (nothing is tuned on the test set):
  1. Split by module presentation into train / test.
  2. Inside train, hold out 25% of presentations as validation; choose the
     model settings there (small grid) and measure the validation errors,
     which give the 80% prediction range shown in the app.
  3. Refit on all of train with the chosen settings; report on test, including
     how often the true mark fell inside the 80% range.
Also: repeated presentation splits, a 2013 -> 2014 time split, subgroup error.
"""
import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from xgboost import XGBRegressor

from _paths import DATA, MODELS, REPORTS, require
from evaluation_extras import (FAIRNESS_COLUMNS, LEARNING_GRID, fairness_regression, per_course_regression, repeated_splits, stamp,
                               residual_interval, temporal_split, tune, validation_split)
from oulad_features import KEY, LEARNING_FEATURES, build_learning_frame, presentation_groups, vle_weeks

SEED = 42
REPEATS = int(os.environ.get('ML_REPEATS', '5'))


def regression_metrics(y_true, y_pred) -> dict:
    return {
        'mae': float(mean_absolute_error(y_true, y_pred)),
        'rmse': float(np.sqrt(mean_squared_error(y_true, y_pred))),
        'r2': float(r2_score(y_true, y_pred)),
    }


def new_model(**params):
    params = {'objective': 'reg:squarederror', **params}
    return XGBRegressor(random_state=SEED, **params)


TYPES = ('CMA', 'TMA', 'Exam')     # quiz, assignment, exam


def intervals_by_type(frame: pd.DataFrame, pred) -> dict:
    """80% range per assessment type from VALIDATION errors (exams are less predictable than quizzes)."""
    out = {'all': residual_interval(frame['target'], pred)}
    for t in TYPES:
        mask = (frame['target_type'] == t).to_numpy()
        if mask.sum() >= 30:
            out[t] = residual_interval(frame['target'][mask], np.asarray(pred)[mask])
    return out


def coverage(frame: pd.DataFrame, pred, intervals: dict) -> dict:
    """Share of rows whose true mark fell inside its type's 80% range, overall and per type."""
    pred = np.asarray(pred)
    inside = np.zeros(len(frame), dtype=bool)
    out = {}
    for t in (*TYPES, None):
        mask = (frame['target_type'] == t).to_numpy() if t else ~frame['target_type'].isin(TYPES).to_numpy()
        if not mask.any():
            continue
        iv = intervals.get(t, intervals['all']) if t else intervals['all']
        low = np.clip(pred[mask] + iv['low_offset'], 0, 100)
        high = np.clip(pred[mask] + iv['high_offset'], 0, 100)
        hit = (frame['target'].to_numpy()[mask] >= low) & (frame['target'].to_numpy()[mask] <= high)
        inside[mask] = hit
        if t:
            out[t] = float(hit.mean())
    out['all'] = float(inside.mean())
    return out


RANGE_FOLDS = int(os.environ.get('ML_RANGE_FOLDS', '4'))
TARGET_COVERAGE = 0.80


def held_out_ranges(train: pd.DataFrame, params: dict) -> dict:
    """80% ranges that hold on UNSEEN course runs (cross-conformal by presentation).

    1. Out-of-fold predictions over GroupKFold of the training presentations.
    2. For each fold, ranges are taken from the OTHER folds' errors and checked on that fold.
    3. If the average held-out coverage is below 80%, all ranges are widened by the smallest
       factor that reaches 80%. Nothing here touches the test presentations."""
    groups = presentation_groups(train)
    k = min(RANGE_FOLDS, groups.nunique())
    if k < 2:
        return {**intervals_by_type(train, np.full(len(train), train['target'].mean())), 'widen_factor': 1.0, 'held_out_coverage': None}
    oof = np.zeros(len(train))
    folds = list(GroupKFold(n_splits=k).split(train, groups=groups))
    for fit_idx, out_idx in folds:
        m = new_model(**params).fit(train.iloc[fit_idx][LEARNING_FEATURES], train.iloc[fit_idx]['target'])
        oof[out_idx] = m.predict(train.iloc[out_idx][LEARNING_FEATURES])

    def scaled(iv, f):
        return {t: {**v, 'low_offset': v['low_offset'] * f, 'high_offset': v['high_offset'] * f} for t, v in iv.items()}

    def mean_fold_coverage(f):
        cov = []
        for fit_idx, out_idx in folds:
            others = intervals_by_type(train.iloc[fit_idx], oof[fit_idx])
            cov.append(coverage(train.iloc[out_idx], oof[out_idx], scaled(others, f))['all'])
        return float(np.mean(cov))

    factor = 1.0
    covered = mean_fold_coverage(factor)
    while covered < TARGET_COVERAGE and factor < 2.0:
        factor = round(factor + 0.02, 2)
        covered = mean_fold_coverage(factor)
    final = scaled(intervals_by_type(train, oof), factor)
    final['all']['widen_factor'] = factor
    final['all']['held_out_coverage'] = covered
    return final


def fit_tuned(train: pd.DataFrame):
    """Settings and the 80% ranges chosen on a validation split of TRAIN; final model refit on all of TRAIN."""
    fit, val = validation_split(train, presentation_groups(train), SEED)
    neg_mae = lambda y, m, X: -mean_absolute_error(y, m.predict(X))
    params, table = tune(new_model, fit[LEARNING_FEATURES], fit['target'], val[LEARNING_FEATURES], val['target'], neg_mae,
                         grid_options=LEARNING_GRID)
    intervals = held_out_ranges(train, params)
    model = new_model(**params).fit(train[LEARNING_FEATURES], train['target'])
    return model, params, intervals, table


def evaluate_split(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    model, _, intervals, _ = fit_tuned(train)
    pred = model.predict(test[LEARNING_FEATURES])
    m = regression_metrics(test['target'], pred)
    b = regression_metrics(test['target'], test['baseline'])
    return {'model_mae': m['mae'], 'model_r2': m['r2'], 'baseline_mae': b['mae'], 'baseline_r2': b['r2'],
            'mae_improvement_pct': 100 * (b['mae'] - m['mae']) / b['mae'],
            'range_coverage': coverage(test, pred, intervals)['all']}


def main():
    require('studentAssessment.csv', 'assessments.csv', 'studentInfo.csv', 'studentVle.csv')
    # OULAD writes missing values as the literal '?'.
    student_assessment = pd.read_csv(DATA / 'studentAssessment.csv', na_values=['?'])
    assessments = pd.read_csv(DATA / 'assessments.csv', na_values=['?'])
    info = pd.read_csv(DATA / 'studentInfo.csv', na_values=['?'])
    print('Preparing weekly activity...')
    vle = pd.read_csv(DATA / 'studentVle.csv', usecols=['id_student', 'code_module', 'code_presentation', 'date'])
    weeks_by_key = vle_weeks(vle)
    del vle
    print('Building one row per assessment...')
    frame = build_learning_frame(student_assessment, assessments, target='next', weeks_by_key=weeks_by_key)
    if len(frame) < 20:
        raise ValueError(f'Only {len(frame)} usable rows; need at least 20.')
    demographics = [c for c in FAIRNESS_COLUMNS if c in info.columns]
    frame = frame.merge(info[KEY + demographics], on=KEY, how='left')

    groups = presentation_groups(frame)
    if groups.nunique() < 2:
        raise ValueError('Need at least two module presentations to split by presentation.')
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(frame, groups=groups))
    train, test = frame.iloc[train_idx], frame.iloc[test_idx]

    print('Tuning on validation...')
    model, params, intervals, table = fit_tuned(train)
    predictions = model.predict(test[LEARNING_FEATURES])
    test_coverage = coverage(test, predictions, intervals)

    metrics = {'model': 'XGBoost Regressor', 'params': params, **regression_metrics(test['target'], predictions),
               'range_80': intervals, 'range_coverage_test': test_coverage}
    baseline = {'model': 'Baseline: mean of earlier scores', **regression_metrics(test['target'], test['baseline'])}
    protocol = {
        'version': 8,
        'target': 'each next scored assessment (one row per assessment from the second onward)',
        'features': 'assessments dated before the predicted one only, incl. last score, trend, spread, late and missed '
                    'assignments, what is being predicted (quiz/assignment/exam), marks relative to the class, and '
                    'weekly activity before it (see ml/oulad_features.py)',
        'split': 'GroupShuffleSplit by module presentation, test_size=0.2, seed 42',
        'tuning': 'grid incl. training objective (squared / absolute / Huber) chosen by validation MAE on a split of the training presentations, never on test',
        'range': '80% range per assessment type, cross-conformal over held-out training presentations and widened until it covers 80% there; coverage on test reported per type',
        'rows': {'train': int(len(train)), 'test': int(len(test))},
        'test_presentations': sorted(groups.iloc[test_idx].unique().tolist()),
    }

    print(f'Repeated presentation splits ({REPEATS})...')
    repeated = repeated_splits(frame, groups, REPEATS, SEED + 1, evaluate_split)
    split = temporal_split(frame)
    temporal = {'train': '2013 presentations', 'test': '2014 presentations', **evaluate_split(*split)} if split else None
    extras = {
        'fairness': fairness_regression(test, 'target', predictions),
        'by_course': per_course_regression(test, predictions),
        'repeated_splits': repeated,
        'temporal_split': temporal,
        'tuning': table,
    }

    joblib.dump({'model': model, 'features': LEARNING_FEATURES, 'params': params, 'range_80': intervals, 'trained_at': stamp(),
                 'metrics': metrics, 'baseline': baseline, 'protocol': protocol}, MODELS / 'learning_analysis_v1.pkl')
    joblib.dump({'y_test': test['target'].to_numpy(), 'predictions': predictions, 'target_type': test['target_type'].to_numpy(),
                 'baseline': test['baseline'].to_numpy(), 'protocol': protocol}, REPORTS / 'learning_test.pkl')
    (REPORTS / 'learning_extras.json').write_text(json.dumps({**extras, 'params': params, 'range_80': intervals,
                                                              'range_coverage_test': metrics['range_coverage_test']}, indent=2), encoding='utf-8')
    print(json.dumps({'model': metrics, 'baseline': baseline, 'protocol': protocol,
                      'repeated_splits': repeated, 'temporal_split': temporal}, indent=2))


if __name__ == '__main__':
    main()
