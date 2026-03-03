import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
import pandas as pd

from utils.state_manager import init_state, is_stage_complete, get_state, set_state, clear_downstream
from utils.indicators import calculate_all_indicators
from utils.strategies import STRATEGY_REGISTRY, MODEL_REGISTRY, ml_strategy, combined_strategy
from utils.charts import (
    signal_chart, signal_distribution_chart, confusion_matrix_chart,
    feature_importance_chart, render_kpi_row, COLORS,
)

st.set_page_config(page_title="Strategy", page_icon="📈", layout="wide")
init_state()

st.header("📈 Strategy Builder")

# ── Stage Gate ──────────────────────────────────────────────────

if not is_stage_complete(1):
    st.warning("Please complete the **Explore** step first (load a ticker).")
    st.page_link("pages/1_Explore.py", label="Go to Explore", icon="📊")
    st.stop()

ticker = get_state("ticker")
df = get_state("price_data")
st.caption(f"Ticker: **{ticker}** — {len(df)} data points")

# Pre-calculate indicators
df_ind = calculate_all_indicators(df)

# ── Tabs ────────────────────────────────────────────────────────

tab_rules, tab_ml = st.tabs(["Rule-Based", "Machine Learning"])

# ── Tab 1: Rule-Based ──────────────────────────────────────────

with tab_rules:
    strategy_name = st.selectbox("Strategy", list(STRATEGY_REGISTRY.keys()))
    strategy_info = STRATEGY_REGISTRY[strategy_name]

    # Dynamic parameter inputs
    params = {}
    param_cols = st.columns(len(strategy_info["params"]))
    for col, (param_key, param_def) in zip(param_cols, strategy_info["params"].items()):
        with col:
            if isinstance(param_def["default"], float):
                params[param_key] = st.slider(
                    param_def["label"],
                    min_value=float(param_def["min"]),
                    max_value=float(param_def["max"]),
                    value=float(param_def["default"]),
                    step=0.1,
                )
            else:
                params[param_key] = st.slider(
                    param_def["label"],
                    min_value=param_def["min"],
                    max_value=param_def["max"],
                    value=param_def["default"],
                )

    if st.button("Generate Signals", key="btn_rules"):
        with st.spinner("Generating signals..."):
            signals = strategy_info["fn"](df_ind, **params)

        # Signal summary
        n_buy = (signals == 1).sum()
        n_sell = (signals == -1).sum()
        n_hold = (signals == 0).sum()
        render_kpi_row([
            {"label": "Buy Signals", "value": str(n_buy)},
            {"label": "Sell Signals", "value": str(n_sell)},
            {"label": "Hold", "value": str(n_hold)},
            {"label": "Total Bars", "value": str(len(signals))},
        ])

        # Price chart with signals
        fig = signal_chart(df, signals, title=f"{ticker} — {strategy_name}")
        st.plotly_chart(fig, use_container_width=True)

        # Signal distribution
        fig_dist = signal_distribution_chart(signals)
        st.plotly_chart(fig_dist, use_container_width=True)

        # Save to state
        set_state("signals", signals)
        set_state("strategy_name", strategy_name)
        set_state("strategy_params", params)
        clear_downstream(2)
        st.success("Signals saved. You can proceed to Backtest.")

# ── Tab 2: Machine Learning ────────────────────────────────────

with tab_ml:
    # Available features (indicator columns)
    indicator_cols = [c for c in df_ind.columns
                      if c not in ["Open", "High", "Low", "Close", "Volume"]]

    if len(indicator_cols) == 0:
        st.warning("No indicators available. Need more data points.")
        st.stop()

    col_feat, col_params = st.columns([2, 1])

    with col_feat:
        selected_features = st.multiselect(
            "Select Features",
            indicator_cols,
            default=[c for c in ["RSI", "MACD_HIST", "MFI", "BB_Percent", "STOCH_K"]
                     if c in indicator_cols],
        )

    with col_params:
        model_type = st.selectbox("Model", list(MODEL_REGISTRY.keys()))
        train_ratio = st.slider("Train Ratio", 0.6, 0.9, 0.8, 0.05)
        threshold = st.slider("Signal Threshold", 0.50, 0.70, 0.55, 0.01)
        target_shift = st.slider("Prediction Horizon (days)", 1, 20, 1)

    if not selected_features:
        st.info("Select at least one feature.")
    elif st.button("Train Model", key="btn_ml"):
        with st.spinner(f"Training {model_type}..."):
            try:
                result = ml_strategy(
                    df_ind,
                    features=selected_features,
                    model_type=model_type,
                    train_ratio=train_ratio,
                    threshold=threshold,
                    target_shift=target_shift,
                )
            except ValueError as e:
                st.error(str(e))
                st.stop()

        # Metrics
        render_kpi_row([
            {"label": "Accuracy", "value": f"{result['accuracy']:.2%}"},
            {"label": "Precision", "value": f"{result['precision']:.2%}"},
            {"label": "Recall", "value": f"{result['recall']:.2%}"},
            {"label": "Train / Test", "value": f"{result['train_size']} / {result['test_size']}"},
        ])

        col_imp, col_cm = st.columns(2)

        with col_imp:
            fig_imp = feature_importance_chart(result["feature_importance"])
            st.plotly_chart(fig_imp, use_container_width=True)

        with col_cm:
            fig_cm = confusion_matrix_chart(result["confusion_matrix"])
            st.plotly_chart(fig_cm, use_container_width=True)

        # Price chart with signals
        signals = result["signals"]
        fig = signal_chart(df, signals, title=f"{ticker} — {model_type}")
        st.plotly_chart(fig, use_container_width=True)

        # Signal distribution
        n_buy = (signals == 1).sum()
        n_sell = (signals == -1).sum()
        n_hold = (signals == 0).sum()
        render_kpi_row([
            {"label": "Buy Signals", "value": str(n_buy)},
            {"label": "Sell Signals", "value": str(n_sell)},
            {"label": "Hold", "value": str(n_hold)},
        ])

        # Save to state
        set_state("signals", signals)
        set_state("strategy_name", f"ML: {model_type}")
        set_state("strategy_params", {
            "features": selected_features,
            "model_type": model_type,
            "train_ratio": train_ratio,
            "threshold": threshold,
            "target_shift": target_shift,
        })
        clear_downstream(2)
        st.success("Signals saved. You can proceed to Backtest.")

# ── Navigation ──────────────────────────────────────────────────

st.divider()
st.page_link("pages/3_Backtest.py", label="Continue to Backtest →", icon="🔄")
