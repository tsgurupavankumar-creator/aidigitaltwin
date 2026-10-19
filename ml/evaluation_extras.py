"""Evaluation helpers shared by both training scripts.

Everything here follows one rule: nothing is tuned on the test set. The
attendance threshold is chosen on a validation split carved out of the
training presentations; the test presentations are only used to report.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, mean_absolute_error, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit

TARGET_RECALL = 0.70          # objective O2: catch at least 70% of at-risk students
MIN_GROUP = 50                # subgroups smaller than this are reported as too small
FAIRNESS_COLUMNS = ['gender', 'age_band', 'disability', 'imd_band']


def choose_threshold(y_true, scores, target_recall: float = TARGET_RECALL) -> dict:
    """Highest threshold whose recall on these (validation) rows reaches the
    target, i.e. the most precise one that still catches enough at-risk
    students. If no threshold reaches it, the one with the best F1."""
    y = np.asarray(y_true).astype(int)
    s = np.asarray(scores, dtype=float)
    candidates = np.unique(np.round(s, 4))[::-1]
    best_f1, best_f1_t = -1.0, 0.5
    for t in candidates:
        pred = (s >= t).astype(int)
        tp = int(((pred == 1) & (y == 1)).sum())
        fp = int(((pred == 1) & (y == 0)).sum())
        fn = int(((pred == 0) & (y == 1)).sum())
        recall = tp / (tp + fn) if tp + fn else 0.0
        precision = tp / (tp + fp) if tp + fp else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        if f1 > best_f1:
            best_f1, best_f1_t = f1, float(t)
        if recall >= target_recall:
            return {'threshold': float(t), 'rule': f'highest threshold with validation recall >= {target_recall}',
                    'validation_recall': recall, 'validation_precision': precision}
    return {'threshold': best_f1_t, 'rule': f'no threshold reached recall {target_recall}; best validation F1',
            'validation_f1': best_f1}


def validation_split(train: pd.DataFrame, groups: pd.Series, seed: int):
    """Inner split of the TRAINING presentations into fit / validation."""
    idx_fit, idx_val = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=seed).split(train, groups=groups))
    return train.iloc[idx_fit], train.iloc[idx_val]


def summarize(values: list[float]) -> dict:
    arr = np.asarray(values, dtype=float)
    return {'mean': float(arr.mean()), 'sd': float(arr.std(ddof=1)) if len(arr) > 1 else 0.0,
            'min': float(arr.min()), 'max': float(arr.max()), 'n': int(len(arr))}


def repeated_splits(frame: pd.DataFrame, groups: pd.Series, n: int, seed: int, evaluate) -> dict:
    """Runs `evaluate(train, test)` -> {metric: value} over n presentation splits
    and returns mean, sd, min and max per metric."""
    runs: list[dict] = []
    for i, (tr, te) in enumerate(GroupShuffleSplit(n_splits=n, test_size=0.2, random_state=seed).split(frame, groups=groups)):
        train, test = frame.iloc[tr], frame.iloc[te]
        try:
            runs.append(evaluate(train, test))
        except ValueError as error:          # e.g. a test split with one class only
            print(f'  repeat {i}: skipped ({error})')
    if not runs:
        return {'repeats': 0}
    return {'repeats': len(runs), **{k: summarize([r[k] for r in runs]) for k in runs[0]}}


def temporal_split(frame: pd.DataFrame):
    """Train on 2013 presentations, test on 2014 ones (how the model is used:
    on a later cohort). Returns None when both years are not present."""
    year = frame['code_presentation'].astype(str).str[:4]
    train, test = frame[year == '2013'], frame[year == '2014']
    if train.empty or test.empty:
        return None
    return train, test


def calibration(y_true, prob, bins: int = 10) -> dict:
    """Brier score and a reliability table: within each probability bin, the
    mean predicted probability against the observed at-risk rate."""
    y = np.asarray(y_true).astype(int)
    p = np.asarray(prob, dtype=float)
    edges = np.linspace(0, 1, bins + 1)
    table = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (p >= lo) & ((p < hi) if hi < 1 else (p <= hi))
        if mask.sum():
            table.append({'bin': f'{lo:.1f}-{hi:.1f}', 'n': int(mask.sum()),
                          'mean_predicted': float(p[mask].mean()), 'observed_rate': float(y[mask].mean())})
    return {'brier': float(brier_score_loss(y, p)), 'base_rate_brier': float(brier_score_loss(y, np.full_like(p, y.mean()))), 'reliability': table}


def fairness_classification(test: pd.DataFrame, y_col: str, pred, prob) -> dict:
    """Per subgroup: n, at-risk rate, recall (share of at-risk students caught),
    false-positive rate and AUC. Groups below MIN_GROUP are marked too small."""
    df = test.assign(_pred=np.asarray(pred), _prob=np.asarray(prob))
    out: dict = {}
    for col in FAIRNESS_COLUMNS:
        if col not in df:
            continue
        rows = {}
        for value, g in df.groupby(col, dropna=False):
            key = 'missing' if pd.isna(value) else str(value)
            if len(g) < MIN_GROUP:
                rows[key] = {'n': int(len(g)), 'note': f'fewer than {MIN_GROUP} students'}
                continue
            y = g[y_col].astype(int)
            negatives = (y == 0).sum()
            rows[key] = {
                'n': int(len(g)),
                'at_risk_rate': float(y.mean()),
                'recall': float(recall_score(y, g['_pred'], zero_division=0)) if y.sum() else None,
                'false_positive_rate': float(((g['_pred'] == 1) & (y == 0)).sum() / negatives) if negatives else None,
                'auc': float(roc_auc_score(y, g['_prob'])) if y.nunique() == 2 else None,
            }
        out[col] = rows
    return out


def fairness_regression(test: pd.DataFrame, y_col: str, pred) -> dict:
    """Per subgroup: n, mean target and MAE."""
    df = test.assign(_pred=np.asarray(pred))
    out: dict = {}
    for col in FAIRNESS_COLUMNS:
        if col not in df:
            continue
        rows = {}
        for value, g in df.groupby(col, dropna=False):
            key = 'missing' if pd.isna(value) else str(value)
            rows[key] = ({'n': int(len(g)), 'note': f'fewer than {MIN_GROUP} students'} if len(g) < MIN_GROUP else
                         {'n': int(len(g)), 'mean_target': float(g[y_col].mean()), 'mae': float(mean_absolute_error(g[y_col], g['_pred']))})
        out[col] = rows
    return out


# ---------------------------------------------------------------- tuning, ranges, reasons

GRID = [{'max_depth': d, 'learning_rate': lr, 'n_estimators': 300} for d in (3, 5, 7) for lr in (0.05, 0.1)]
DEFAULT_PARAMS = {'max_depth': 5, 'learning_rate': 0.05, 'n_estimators': 200}
# Marks model: wider grid that also chooses the training objective. MAE is the target, so absolute error is a
# natural candidate; Huber sits between squared and absolute error.
LEARNING_GRID = [{'max_depth': d, 'learning_rate': lr, 'n_estimators': 400, 'objective': obj}
                 for d in (6, 8) for lr in (0.05, 0.1)
                 for obj in ('reg:squarederror', 'reg:absoluteerror', 'reg:pseudohubererror')]


def tune(make_model, X_fit, y_fit, X_val, y_val, score, greater_is_better=True, grid_options=None):
    """Tries each GRID setting, fitted on FIT and scored on VALIDATION (both
    inside the training presentations). ML_TUNE=0 skips tuning (tests)."""
    import os
    grid = (grid_options or GRID) if os.environ.get('ML_TUNE', '1') != '0' else [DEFAULT_PARAMS]
    results = []
    for params in grid:
        model = make_model(**params).fit(X_fit, y_fit)
        results.append((score(y_val, model, X_val), params))
    results.sort(key=lambda r: r[0], reverse=greater_is_better)
    return results[0][1], [{'params': p, 'validation_score': float(s)} for s, p in results]


def residual_interval(y_true, y_pred, low_q: float = 0.1, high_q: float = 0.9) -> dict:
    """80% prediction range from VALIDATION residuals: prediction + [low, high]."""
    resid = np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float)
    return {'low_offset': float(np.quantile(resid, low_q)), 'high_offset': float(np.quantile(resid, high_q)),
            'coverage_target': high_q - low_q}


def interval_coverage(y_true, y_pred, interval: dict, lo: float = 0, hi: float = 100) -> float:
    y = np.asarray(y_true, dtype=float)
    p = np.asarray(y_pred, dtype=float)
    low = np.clip(p + interval['low_offset'], lo, hi)
    high = np.clip(p + interval['high_offset'], lo, hi)
    return float(((y >= low) & (y <= high)).mean())


def top_reasons(model, frame: pd.DataFrame, names: list[str], top: int = 3, risk_up_only: bool = False) -> list[list[dict]]:
    """Per row, the features that moved this prediction most (XGBoost's exact
    per-feature contributions, the same idea as SHAP). With risk_up_only, only
    features that pushed the prediction UP (more risk) are listed."""
    import xgboost as xgb
    contribs = model.get_booster().predict(xgb.DMatrix(frame[names].astype(float), missing=np.nan), pred_contribs=True)[:, :-1]
    out = []
    for i, row in enumerate(contribs):
        order = np.argsort(-row) if risk_up_only else np.argsort(-np.abs(row))
        items = []
        for j in order[:top]:
            if risk_up_only and row[j] <= 0:
                break
            value = frame[names[j]].iloc[i]
            items.append({'feature': names[j], 'value': None if pd.isna(value) else float(value), 'effect': float(row[j])})
        out.append(items)
    return out


# ---------------------------------------------------------------- per-course results

def per_course_regression(test: pd.DataFrame, pred, y_col: str = 'target') -> dict:
    """Per course (module): rows, mean mark and MAE. Courses differ a lot; this shows where the model is weak."""
    df = test.assign(_pred=np.asarray(pred))
    return {str(mod): {'n': int(len(g)), 'mean_target': float(g[y_col].mean()), 'mae': float(mean_absolute_error(g[y_col], g['_pred']))}
            for mod, g in df.groupby('code_module') if len(g) >= MIN_GROUP}


def per_course_classification(test: pd.DataFrame, pred, prob, y_col: str = 'target') -> dict:
    """Per course (module): rows, at-risk rate, AUC, recall, precision and false-alarm rate."""
    df = test.assign(_pred=np.asarray(pred), _prob=np.asarray(prob))
    out = {}
    for mod, g in df.groupby('code_module'):
        if len(g) < MIN_GROUP:
            continue
        y = g[y_col].astype(int)
        pos, neg = (y == 1), (y == 0)
        flagged = g['_pred'] == 1
        out[str(mod)] = {
            'n': int(len(g)), 'at_risk_rate': float(y.mean()),
            'auc': float(roc_auc_score(y, g['_prob'])) if y.nunique() == 2 else None,
            'recall': float((flagged & pos).sum() / pos.sum()) if pos.any() else None,
            'precision': float((flagged & pos).sum() / flagged.sum()) if flagged.any() else None,
            'false_positive_rate': float((flagged & neg).sum() / neg.sum()) if neg.any() else None,
        }
    return out


def stamp() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat(timespec='seconds')
