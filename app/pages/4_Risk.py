"""
Risk Management - VaR, Sharpe, Drawdown, Volatility Analysis
"""

import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
import yfinance_fix

from tradbot.risk.metrics import (
    calculate_sharpe_ratio, calculate_max_drawdown, calculate_var,
    calculate_annualized_return, calculate_annualized_volatility,
    calculate_sortino_ratio, calculate_cvar,
    calculate_beta, calculate_alpha,
    monte_carlo_simulation,
)
from components.charts import drawdown_chart, return_distribution, rolling_volatility, rolling_sharpe_chart, monthly_returns_heatmap, monte_carlo_chart
from components.kpi_cards import render_kpi_row


st.header("Risk Management")

ticker = (st.session_state.get("global_ticker") or "SPY").strip().upper()

# --- Sidebar ---
with st.sidebar:
    st.subheader("Settings")
    benchmark = st.text_input("Benchmark", value="SPY", help="Used for Beta and Alpha calculation", key="risk_benchmark")
    period = st.selectbox("Period", ["1y", "2y", "5y", "max"], index=2, key="risk_period")
    vol_window = st.slider("Volatility Window (days)", 10, 90, 30, key="risk_vol_window")
    with st.expander("Monte Carlo Settings"):
        num_simulations = st.slider("Simulations", 100, 5000, 1000, step=100, key="risk_mc_sims")
        forecast_days = st.slider("Forecast Days", 30, 504, 252, step=10, key="risk_mc_days")

# --- Load Data ---
@st.cache_data(ttl=300)
def load_data(symbol, period):
    df = yf.download(symbol, period=period, session=yfinance_fix.chrome_session, progress=False)
    if df.empty:
        return None
    df.columns = df.columns.get_level_values(0)
    return df

with st.spinner("Loading data..."):
    df = load_data(ticker, period)
    df_bench = load_data(benchmark, period) if benchmark != ticker else df

if df is None:
    st.error(f"Could not load data for {ticker}")
    st.stop()

returns = df["Close"].pct_change().dropna()
prices = df["Close"]
equity = (1 + returns).cumprod()

# --- Metrics ---
sharpe = calculate_sharpe_ratio(returns)
max_dd = calculate_max_drawdown(equity)
var_95 = calculate_var(returns, 0.95)
var_99 = calculate_var(returns, 0.99)
ann_ret = calculate_annualized_return(returns)
ann_vol = calculate_annualized_volatility(returns)
sortino = calculate_sortino_ratio(returns)
cvar_95 = calculate_cvar(returns, 0.95)

mc = monte_carlo_simulation(returns, num_simulations, forecast_days)

beta, alpha = None, None
if df_bench is not None:
    bench_returns = df_bench["Close"].pct_change().dropna()
    try:
        beta = calculate_beta(returns, bench_returns)
        alpha = calculate_alpha(returns, bench_returns)
    except Exception:
        pass

# --- KPI Row ---
kpis = [
    {"label": "Sharpe Ratio", "value": f"{sharpe:.3f}"},
    {"label": "Sortino Ratio", "value": f"{sortino:.3f}"},
    {"label": "Max Drawdown", "value": f"{max_dd:.2%}"},
    {"label": "VaR 95%", "value": f"{var_95:.4f}"},
    {"label": "CVaR 95%", "value": f"{cvar_95:.4f}"},
    {"label": "Ann. Return", "value": f"{ann_ret:.2%}"},
    {"label": "Ann. Volatility", "value": f"{ann_vol:.2%}"},
]
if beta is not None:
    kpis += [
        {"label": f"Beta ({benchmark})", "value": f"{beta:.3f}"},
        {"label": f"Alpha ({benchmark})", "value": f"{alpha:.2%}"},
    ]
render_kpi_row(kpis)

st.divider()

# --- Drawdown Chart ---
st.subheader("Drawdown")
fig_dd = drawdown_chart(equity, title=f"Drawdown - {ticker}")
st.plotly_chart(fig_dd, use_container_width=True)

st.divider()

# --- Return Distribution + Rolling Volatility ---
col1, col2 = st.columns(2)

with col1:
    st.subheader("Return Distribution")
    fig_dist = return_distribution(returns, var_95=var_95, var_99=var_99)
    st.plotly_chart(fig_dist, use_container_width=True)

with col2:
    st.subheader("Rolling Volatility")
    fig_vol = rolling_volatility(returns, window=vol_window)
    st.plotly_chart(fig_vol, use_container_width=True)

st.divider()

# --- Monte Carlo Simulation ---
st.subheader("Monte Carlo Simulation")
mc_kpis = [
    {"label": "Median End Value", "value": f"{float(mc['median'][-1]):.3f}"},
    {"label": "Simulated VaR", "value": f"{mc['var_simulated'] - 1:.2%}"},
    {"label": "Simulated CVaR", "value": f"{mc['cvar_simulated'] - 1:.2%}"},
    {"label": "P(Loss)", "value": f"{mc['prob_loss']:.1%}"},
]
render_kpi_row(mc_kpis)
fig_mc = monte_carlo_chart(
    mc, forecast_days,
    title=f"Monte Carlo – {ticker} ({num_simulations:,} Simulations, {forecast_days}d)",
)
st.plotly_chart(fig_mc, use_container_width=True)

st.divider()

# --- Rolling Sharpe ---
st.subheader("Rolling Sharpe Ratio")
fig_rs = rolling_sharpe_chart(returns, window=vol_window)
st.plotly_chart(fig_rs, use_container_width=True)

st.divider()

# --- Monthly Returns Heatmap ---
st.subheader("Monthly Returns")
fig_monthly = monthly_returns_heatmap(prices)
st.plotly_chart(fig_monthly, use_container_width=True)

st.divider()

# --- Detailed Stats Table ---
st.subheader("Detailed Statistics")
stats = pd.DataFrame({
    "Metric": [
        "Total Return", "Annualized Return", "Annualized Volatility",
        "Sharpe Ratio", "Sortino Ratio", "Max Drawdown",
        "VaR 95%", "VaR 99%", "CVaR 95%",
        "Skewness", "Kurtosis",
        "Best Day", "Worst Day",
        "Positive Days", "Negative Days",
        "Data Points",
    ],
    "Value": [
        f"{float(equity.iloc[-1] - 1):.2%}",
        f"{ann_ret:.2%}",
        f"{ann_vol:.2%}",
        f"{sharpe:.3f}",
        f"{sortino:.3f}",
        f"{max_dd:.2%}",
        f"{var_95:.4f}",
        f"{var_99:.4f}",
        f"{cvar_95:.4f}",
        f"{returns.skew():.3f}",
        f"{returns.kurtosis():.3f}",
        f"{returns.max():.2%}",
        f"{returns.min():.2%}",
        f"{(returns > 0).sum()} ({(returns > 0).mean():.1%})",
        f"{(returns < 0).sum()} ({(returns < 0).mean():.1%})",
        f"{len(df):,}",
    ]
})
if beta is not None:
    stats = pd.concat([stats, pd.DataFrame({
        "Metric": [f"Beta ({benchmark})", f"Alpha ({benchmark})"],
        "Value": [f"{beta:.3f}", f"{alpha:.2%}"],
    })], ignore_index=True)
st.dataframe(stats, use_container_width=True, hide_index=True)
