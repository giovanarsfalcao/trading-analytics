"""
Signal generation module.

ML-based signals: train a classifier, return {-1, 0, 1} signals + diagnostics.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix,
)


# ── ML-Based Signals ─────────────────────────────────────────────

MODEL_REGISTRY = {
    "Random Forest": RandomForestClassifier,
    "Gradient Boosting": GradientBoostingClassifier,
    "Logistic Regression": LogisticRegression,
}


def walk_forward_ml_strategy(
    df: pd.DataFrame,
    features: list[str],
    model_type: str = "Random Forest",
    train_window: int = 504,
    step: int = 63,
    threshold: float = 0.55,
    target_shift: int = 1,
) -> dict:
    """
    Walk-forward ML strategy: rolling train/test windows.

    Each fold trains on the previous `train_window` bars and generates
    out-of-sample signals for the next `step` bars. This avoids the
    single train/test split bias and gives a more realistic estimate
    of live performance.

    Returns dict with: signals, fold_results, n_folds.
    """
    signals = pd.Series(0, index=df.index, dtype=int)
    fold_results = []
    n = len(df)
    pos = 0

    while pos + train_window + step <= n:
        # Training slice: exclude last target_shift rows (boundary gap)
        train_raw = df.iloc[pos: pos + train_window - target_shift].copy()
        test = df.iloc[pos + train_window: pos + train_window + step]

        train_raw["Target"] = (
            (train_raw["Close"].shift(-target_shift) > train_raw["Close"]).astype(int)
        )
        train_raw = train_raw.iloc[:-target_shift]

        X_train = train_raw[features].replace([np.inf, -np.inf], np.nan).dropna()
        y_train = train_raw["Target"].loc[X_train.index]
        X_test = test[features].replace([np.inf, -np.inf], np.nan).dropna()

        if len(X_train) < 30 or len(y_train.unique()) < 2 or len(X_test) == 0:
            pos += step
            continue

        ModelClass = MODEL_REGISTRY[model_type]
        model = (
            ModelClass(max_iter=1000, random_state=42)
            if model_type == "Logistic Regression"
            else ModelClass(n_estimators=100, random_state=42)
        )

        try:
            scaler = StandardScaler()
            X_train_s = scaler.fit_transform(X_train)
            X_test_s = scaler.transform(X_test)
            model.fit(X_train_s, y_train)
            proba = model.predict_proba(X_test_s)[:, 1]
            fold_sigs = np.where(proba > threshold, 1, np.where(proba < (1 - threshold), -1, 0))
            signals.loc[X_test.index] = fold_sigs

            # Per-fold metrics: build test targets from actual future returns
            fold_entry = {
                "fold": len(fold_results) + 1,
                "train_start": df.index[pos].isoformat(),
                "train_end": df.index[pos + train_window - 1].isoformat(),
                "test_start": df.index[pos + train_window].isoformat(),
                "test_end": X_test.index[-1].isoformat(),
                "n_train": len(X_train),
                "n_test": len(X_test),
            }
            test_target = (df["Close"].shift(-target_shift) > df["Close"]).astype(int)
            y_test = test_target.loc[X_test.index].dropna()
            common = y_test.index.intersection(X_test.index)
            if len(common) > 0:
                y_t = y_test.loc[common]
                preds = (proba[X_test.index.isin(common)] > threshold).astype(int)
                fold_entry["accuracy"] = float(accuracy_score(y_t, preds))
                fold_entry["f1"] = float(f1_score(y_t, preds, zero_division=0))
                try:
                    fold_entry["roc_auc"] = float(roc_auc_score(y_t, proba[X_test.index.isin(common)])) if len(y_t.unique()) > 1 else None
                except Exception:
                    fold_entry["roc_auc"] = None
            fold_results.append(fold_entry)
        except Exception:
            pass

        pos += step

    return {
        "signals": signals.shift(1).fillna(0).astype(int),
        "fold_results": fold_results,
        "n_folds": len(fold_results),
    }


def ml_strategy(
    df: pd.DataFrame,
    features: list[str],
    model_type: str = "Random Forest",
    train_ratio: float = 0.8,
    threshold: float = 0.5,
    target_shift: int = 1,
    fundamental_values: dict | None = None,
) -> dict:
    """
    Train an ML model for binary classification (next-day up/down).

    Returns dict with: signals, accuracy, precision, recall,
    feature_importance, confusion_matrix, probabilities, train_size, test_size.
    """
    data = df.copy()

    if fundamental_values:
        for k, v in fundamental_values.items():
            data[k] = v
        features = features + [k for k in fundamental_values if k not in features]

    # Target: 1 if price goes up in target_shift days (forward-return label).
    # Remove the last target_shift rows: they have NaN targets AND rows at the
    # train/test boundary would use labels that look into the test period.
    data["Target"] = (data["Close"].shift(-target_shift) > data["Close"]).astype(int)
    data = data.iloc[:-target_shift]
    data = data.dropna(subset=features + ["Target"])

    if len(data) < 100:
        raise ValueError(f"Not enough data points ({len(data)}). Need at least 100.")

    # Temporal split with boundary gap: excludes the last target_shift rows from
    # training so no training label "looks forward" into the test feature window.
    split_idx = int(len(data) * train_ratio)
    gap = target_shift
    train = data.iloc[:split_idx - gap]
    test = data.iloc[split_idx:]

    X_train = train[features].replace([np.inf, -np.inf], np.nan).dropna()
    y_train = train["Target"].loc[X_train.index]
    X_test = test[features].replace([np.inf, -np.inf], np.nan).dropna()
    y_test = test["Target"].loc[X_test.index]

    if len(X_train) < 50 or len(X_test) < 10:
        raise ValueError("Not enough clean data after removing NaN/inf values.")

    # Train
    ModelClass = MODEL_REGISTRY[model_type]
    if model_type == "Logistic Regression":
        model = ModelClass(max_iter=1000, random_state=42)
    else:
        model = ModelClass(n_estimators=100, random_state=42)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)
    model.fit(X_train_s, y_train)

    # Out-of-sample predictions (test set) — used for reported metrics
    test_proba = model.predict_proba(X_test_s)[:, 1]
    predictions = (test_proba > threshold).astype(int)

    # In-sample predictions (train set) — overfit by definition, shown with warning in UI
    train_proba = model.predict_proba(X_train_s)[:, 1]

    # Build full signal series covering both train and test periods
    signals = pd.Series(0, index=data.index, dtype=int)

    train_signals = np.where(
        train_proba > threshold, 1,
        np.where(train_proba < (1 - threshold), -1, 0),
    )
    signals.loc[X_train.index] = train_signals

    test_signals = np.where(
        test_proba > threshold, 1,
        np.where(test_proba < (1 - threshold), -1, 0),
    )
    signals.loc[X_test.index] = test_signals

    signals = signals.shift(1).fillna(0).astype(int)

    # Feature importance
    if hasattr(model, "feature_importances_"):
        importance = dict(zip(features, model.feature_importances_))
    else:
        importance = dict(zip(features, np.abs(model.coef_[0])))

    roc_auc = None
    if len(y_test.unique()) > 1:
        try:
            roc_auc = float(roc_auc_score(y_test, test_proba))
        except Exception:
            pass

    return {
        "signals": signals,
        "accuracy": accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, zero_division=0),
        "recall": recall_score(y_test, predictions, zero_division=0),
        "f1": f1_score(y_test, predictions, zero_division=0),
        "roc_auc": roc_auc,
        "feature_importance": importance,
        "confusion_matrix": confusion_matrix(y_test, predictions),
        "probabilities": pd.Series(test_proba, index=X_test.index),
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
