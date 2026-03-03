"""
Strategy generation module.

Rule-based strategies: Pure functions (df, **params) -> pd.Series of {1, -1, 0}
ML strategies: Train model, return signals + diagnostics.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    confusion_matrix,
)
from utils.indicators import (
    add_sma, add_rsi, add_macd, add_bollinger_bands,
    add_stochastic, add_mfi, add_atr,
)


# ── Rule-Based Strategies ───────────────────────────────────────

def sma_crossover(df: pd.DataFrame, fast_period: int = 20, slow_period: int = 50) -> pd.Series:
    """Buy when fast SMA > slow SMA, sell when below."""
    data = add_sma(add_sma(df.copy(), fast_period), slow_period)
    fast_col = f"SMA_{fast_period}"
    slow_col = f"SMA_{slow_period}"
    signal = np.where(
        data[fast_col] > data[slow_col], 1,
        np.where(data[fast_col] < data[slow_col], -1, 0),
    )
    return pd.Series(signal, index=data.index).shift(1).fillna(0).astype(int)


def rsi_strategy(df: pd.DataFrame, period: int = 14,
                 overbought: int = 70, oversold: int = 30) -> pd.Series:
    """Buy below oversold, sell above overbought."""
    data = add_rsi(df.copy(), period)
    signal = np.where(
        data["RSI"] < oversold, 1,
        np.where(data["RSI"] > overbought, -1, 0),
    )
    return pd.Series(signal, index=data.index).shift(1).fillna(0).astype(int)


def macd_crossover(df: pd.DataFrame, fast: int = 12, slow: int = 26,
                   signal_period: int = 9) -> pd.Series:
    """Buy when MACD > Signal line, sell when below."""
    data = add_macd(df.copy(), fast, slow, signal_period)
    signal = np.where(
        data["MACD"] > data["MACD_Signal"], 1,
        np.where(data["MACD"] < data["MACD_Signal"], -1, 0),
    )
    return pd.Series(signal, index=data.index).shift(1).fillna(0).astype(int)


def bollinger_breakout(df: pd.DataFrame, period: int = 20, std: float = 2.0) -> pd.Series:
    """Buy when price breaks above upper band, sell when below lower."""
    data = add_bollinger_bands(df.copy(), period, std)
    signal = np.where(
        data["Close"] > data["BB_Upper"], 1,
        np.where(data["Close"] < data["BB_Lower"], -1, 0),
    )
    return pd.Series(signal, index=data.index).shift(1).fillna(0).astype(int)


def combined_strategy(signals_list: list[pd.Series], logic: str = "AND") -> pd.Series:
    """
    Combine multiple strategy signals.
    AND: all must agree. OR: any triggers.
    """
    if not signals_list:
        return pd.Series(dtype=int)
    stacked = pd.concat(signals_list, axis=1)
    if logic == "AND":
        buy = (stacked == 1).all(axis=1)
        sell = (stacked == -1).all(axis=1)
    else:
        buy = (stacked == 1).any(axis=1)
        sell = (stacked == -1).any(axis=1)
    return pd.Series(np.where(buy, 1, np.where(sell, -1, 0)), index=stacked.index)


STRATEGY_REGISTRY = {
    "SMA Crossover": {
        "fn": sma_crossover,
        "params": {
            "fast_period": {"label": "Fast SMA", "min": 5, "max": 100, "default": 20},
            "slow_period": {"label": "Slow SMA", "min": 20, "max": 300, "default": 50},
        },
    },
    "RSI Overbought/Oversold": {
        "fn": rsi_strategy,
        "params": {
            "period": {"label": "RSI Period", "min": 5, "max": 50, "default": 14},
            "overbought": {"label": "Overbought", "min": 60, "max": 90, "default": 70},
            "oversold": {"label": "Oversold", "min": 10, "max": 40, "default": 30},
        },
    },
    "MACD Signal Crossover": {
        "fn": macd_crossover,
        "params": {
            "fast": {"label": "Fast EMA", "min": 5, "max": 50, "default": 12},
            "slow": {"label": "Slow EMA", "min": 10, "max": 100, "default": 26},
            "signal_period": {"label": "Signal", "min": 3, "max": 30, "default": 9},
        },
    },
    "Bollinger Band Breakout": {
        "fn": bollinger_breakout,
        "params": {
            "period": {"label": "Period", "min": 5, "max": 50, "default": 20},
            "std": {"label": "Std Dev", "min": 1.0, "max": 3.5, "default": 2.0},
        },
    },
}


# ── ML-Based Strategy ───────────────────────────────────────────

MODEL_REGISTRY = {
    "Random Forest": RandomForestClassifier,
    "Gradient Boosting": GradientBoostingClassifier,
    "Logistic Regression": LogisticRegression,
}


def ml_strategy(
    df: pd.DataFrame,
    features: list[str],
    model_type: str = "Random Forest",
    train_ratio: float = 0.8,
    threshold: float = 0.5,
    target_shift: int = 1,
) -> dict:
    """
    Train an ML model for binary classification (next-day up/down).

    Returns dict with: signals, accuracy, precision, recall,
    feature_importance, confusion_matrix, probabilities, train_size, test_size.
    """
    data = df.copy()

    # Target: 1 if price goes up in target_shift days
    data["Target"] = (data["Close"].shift(-target_shift) > data["Close"]).astype(int)
    data = data.dropna(subset=features + ["Target"])

    if len(data) < 100:
        raise ValueError(f"Not enough data points ({len(data)}). Need at least 100.")

    # Temporal split (no shuffling)
    split_idx = int(len(data) * train_ratio)
    train = data.iloc[:split_idx]
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

    model.fit(X_train, y_train)

    # Predict on test set
    probabilities = model.predict_proba(X_test)[:, 1]
    predictions = (probabilities > threshold).astype(int)

    # Generate signals: train period = 0, test period = actual signals
    signals = pd.Series(0, index=data.index, dtype=int)
    test_signals = np.where(
        probabilities > threshold, 1,
        np.where(probabilities < (1 - threshold), -1, 0),
    )
    signals.iloc[split_idx:split_idx + len(test_signals)] = test_signals
    signals = signals.shift(1).fillna(0).astype(int)

    # Feature importance
    if hasattr(model, "feature_importances_"):
        importance = dict(zip(features, model.feature_importances_))
    else:
        importance = dict(zip(features, np.abs(model.coef_[0])))

    return {
        "signals": signals,
        "accuracy": accuracy_score(y_test, predictions),
        "precision": precision_score(y_test, predictions, zero_division=0),
        "recall": recall_score(y_test, predictions, zero_division=0),
        "feature_importance": importance,
        "confusion_matrix": confusion_matrix(y_test, predictions),
        "probabilities": pd.Series(probabilities, index=X_test.index),
        "train_size": len(train),
        "test_size": len(test),
    }
