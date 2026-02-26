"""
Model Insights - OLS Linear Regression, Logistic Regression
"""

import streamlit as st
import pandas as pd
import yfinance as yf
from sklearn.metrics import confusion_matrix, roc_auc_score, roc_curve
import yfinance_fix

from tradbot.strategy import TechnicalIndicators
from tradbot.strategy.models import LinearRegression, LogisticRegression
from components.charts import (
    roc_curve_chart, confusion_matrix_chart, CHART_LAYOUT, COLORS,
)
import plotly.graph_objects as go


st.header("Model Insights")
st.caption("Machine learning models for price prediction — OLS trend forecasting and logistic regression signal classification.")

ticker = (st.session_state.get("global_ticker") or "SPY").strip().upper()

# --- Sidebar ---
with st.sidebar:
    st.subheader("Data Settings")
    interval = st.selectbox("Interval", ["1d", "1h", "15m", "5m"], index=0, key="mi_interval")
    lookback = st.number_input("Lookback (rows)", value=5000, step=100, key="mi_lookback")

    st.divider()
    st.subheader("Indicator Parameters")

    with st.expander("MACD"):
        macd_fast = st.number_input("Fast", 12, key="mi_macd_fast")
        macd_slow = st.number_input("Slow", 27, key="mi_macd_slow")
        macd_span = st.number_input("Signal", 9, key="mi_macd_span")

    with st.expander("RSI"):
        rsi_length = st.number_input("RSI Length", 14, key="mi_rsi_len")

    with st.expander("MFI"):
        mfi_length = st.number_input("MFI Length", 14, key="mi_mfi_len")

    with st.expander("Bollinger Bands"):
        bb_length = st.number_input("BB Length", 20, key="mi_bb_len")
        bb_std = st.number_input("Std Dev", 2, key="mi_bb_std")

    features = st.multiselect(
        "Features",
        ["MACD_HIST", "MFI", "BB", "RSI"],
        default=["MACD_HIST", "MFI", "BB", "RSI"],
        key="mi_features",
    )


# --- Load Data ---
@st.cache_data(ttl=300)
def load_data(symbol, interval, lookback):
    period = "730d" if interval == "1h" else "max"
    df = yf.download(symbol, session=yfinance_fix.chrome_session,
                     interval=interval, period=period, progress=False)
    if df.empty:
        return None
    df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    return df.iloc[-lookback:, :].copy()


with st.spinner("Loading data..."):
    df_raw = load_data(ticker, interval, lookback)

if df_raw is None:
    st.error(f"Could not load data for {ticker}")
    st.stop()

# Add indicators
ti = TechnicalIndicators(df_raw)
ti.add_macd(macd_fast, macd_slow, macd_span)
ti.add_mfi(mfi_length)
ti.add_bb(bb_length, bb_std)
ti.add_rsi(rsi_length)
df = ti.dropna().get_df()

st.success(f"{len(df)} data points loaded for {ticker}")

# --- Tabs ---
tab1, tab2 = st.tabs(["Linear Regression", "Logistic Regression"])

# === Tab 1: Linear Regression ===
with tab1:
    st.subheader("OLS Linear Regression")

    shift_lr = st.slider("Shift (days)", 1, 30, 5, key="mi_lr_shift")

    if not features:
        st.warning("Select at least one feature")
        st.stop()

    try:
        lr = LinearRegression(df, features=features)
        lr.add_target(shift=shift_lr)
        lr.fix_autocorrelation()
        result = lr.fit()
        validation = lr.validate()

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("R-squared", f"{result['r_squared']:.4f}")
        with col2:
            st.metric("F p-value", f"{result['p_value']:.4e}")
        with col3:
            st.metric("Intercept", f"{result['intercept']:.4f}")

        coef_df = pd.DataFrame({
            "Feature": list(result["coefficients"].keys()),
            "Coefficient": list(result["coefficients"].values()),
        })
        st.dataframe(coef_df, use_container_width=True, hide_index=True)

        st.subheader("Residual Diagnostics")
        c1, c2, c3 = st.columns(3)

        residuals = validation["residuals"]
        predictions = validation["predictions"]

        with c1:
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=predictions, y=residuals, mode="markers",
                                     marker=dict(color=COLORS["blue"], opacity=0.5)))
            fig.add_hline(y=0, line_color=COLORS["red"])
            fig.update_layout(**CHART_LAYOUT, title="Linearity",
                              xaxis_title="Predicted", yaxis_title="Residuals")
            st.plotly_chart(fig, use_container_width=True)

        with c2:
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=residuals.values[:-1], y=residuals.values[1:],
                                     mode="markers", marker=dict(color=COLORS["blue"], opacity=0.5)))
            fig.update_layout(**CHART_LAYOUT, title="Independence (Lag Plot)",
                              xaxis_title="Residual(t)", yaxis_title="Residual(t+1)")
            st.plotly_chart(fig, use_container_width=True)

        with c3:
            fig = go.Figure()
            fig.add_trace(go.Histogram(x=residuals, nbinsx=30,
                                       marker_color=COLORS["blue"]))
            fig.update_layout(**CHART_LAYOUT, title="Normality",
                              xaxis_title="Residual")
            st.plotly_chart(fig, use_container_width=True)

    except Exception as e:
        st.error(f"Linear Regression failed: {e}")


# === Tab 2: Logistic Regression ===
with tab2:
    st.subheader("Logistic Regression")

    if not features:
        st.warning("Select at least one feature")
        st.stop()

    try:
        logreg = LogisticRegression(df, features=features)

        st.markdown("**AUC Optimization (Train Set)**")
        train_df_all, _ = logreg.train_test_split(train_size=0.7)

        auc_results = logreg.explore_shift_auc(train_df_all)
        best_shift = int(auc_results.iloc[0]["Shift"])

        fig_auc = go.Figure()
        fig_auc.add_trace(go.Scatter(
            x=auc_results["Shift"], y=auc_results["AUC"],
            mode="lines+markers",
            line=dict(color=COLORS["blue"], width=2),
            marker=dict(size=8),
        ))
        fig_auc.update_layout(**CHART_LAYOUT, title=f"AUC by Shift (Best: {best_shift})",
                              xaxis_title="Shift", yaxis_title="AUC")
        st.plotly_chart(fig_auc, use_container_width=True)

        logreg2 = LogisticRegression(df, features=features)
        logreg2.add_target(shift=best_shift)
        train_df, test_df = logreg2.train_test_split(train_size=0.7)

        train_result = logreg2.fit(train_df)
        roc_train = logreg2.get_roc_data()
        cm_train = logreg2.get_confusion_matrix().values

        test_probs = logreg2.predict(test_df)
        test_target = test_df["Target"].loc[test_probs.index]
        test_auc = roc_auc_score(test_target, test_probs)
        test_fpr, test_tpr, _ = roc_curve(test_target, test_probs)
        test_cm = confusion_matrix(test_target, (test_probs > 0.5).astype(int))

        st.divider()
        st.subheader("Train vs Test Comparison")

        col1, col2 = st.columns(2)

        with col1:
            st.markdown(f"**Train** (AUC = {train_result['auc']:.3f})")
            st.plotly_chart(roc_curve_chart(roc_train["fpr"], roc_train["tpr"],
                                            roc_train["auc"], "ROC - Train"),
                           use_container_width=True)
            st.plotly_chart(confusion_matrix_chart(cm_train, "Confusion Matrix - Train"),
                           use_container_width=True)

        with col2:
            st.markdown(f"**Test** (AUC = {test_auc:.3f})")
            st.plotly_chart(roc_curve_chart(test_fpr, test_tpr, test_auc, "ROC - Test"),
                           use_container_width=True)
            st.plotly_chart(confusion_matrix_chart(test_cm, "Confusion Matrix - Test"),
                           use_container_width=True)

    except Exception as e:
        st.error(f"Logistic Regression failed: {e}")

