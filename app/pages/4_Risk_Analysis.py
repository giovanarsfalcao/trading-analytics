import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go

from utils.state_manager import init_state, is_stage_complete, get_state, set_state
from utils.risk_analysis import calculate_risk_metrics, monte_carlo_simulation
from utils.charts import (
    render_kpi_row, fmt, return_distribution, drawdown_chart,
    rolling_volatility, rolling_sharpe_chart, monte_carlo_chart,
    CHART_LAYOUT, COLORS,
)

st.set_page_config(page_title="Risk Analysis", page_icon="⚠️", layout="wide")
init_state()

st.header("⚠️ Risk Analysis")

# ── Stage Gate ──────────────────────────────────────────────────

if not is_stage_complete(3):
    st.warning("Please complete the **Backtest** step first.")
    st.page_link("pages/3_Backtest.py", label="Go to Backtest", icon="🔄")
    st.stop()

ticker = get_state("ticker")
backtest = get_state("backtest_results")
portfolio_returns = backtest["daily_returns"]
portfolio_value = backtest["portfolio_value"]
benchmark_returns = get_state("benchmark_returns")
initial_capital = backtest["initial_capital"]

st.caption(f"Ticker: **{ticker}** | Strategy: **{get_state('strategy_name')}**")

# ── Section 1: Risk Metrics ────────────────────────────────────

st.subheader("Risk Metrics")

metrics = calculate_risk_metrics(
    portfolio_returns, benchmark_returns, portfolio_value,
)
set_state("risk_metrics", metrics)


def _color(val, good_thresh, bad_thresh, higher_is_better=True):
    """Return color string for metric value."""
    if val is None:
        return "off"
    if higher_is_better:
        if val >= good_thresh:
            return "normal"
        elif val <= bad_thresh:
            return "inverse"
    else:
        if val <= good_thresh:
            return "normal"
        elif val >= bad_thresh:
            return "inverse"
    return "off"


row1 = [
    {"label": "Sharpe Ratio", "value": fmt(metrics["sharpe_ratio"]),
     "delta": "Good" if metrics["sharpe_ratio"] > 1 else "Low",
     "delta_color": _color(metrics["sharpe_ratio"], 1.0, 0, True)},
    {"label": "Sortino Ratio", "value": fmt(metrics["sortino_ratio"])},
    {"label": "Max Drawdown", "value": fmt(metrics["max_drawdown"], pct=True),
     "delta": "OK" if metrics["max_drawdown"] > -0.2 else "High",
     "delta_color": _color(metrics["max_drawdown"], -0.2, -0.4, True)},
    {"label": "VaR 95%", "value": fmt(metrics["var_95"], pct=True)},
    {"label": "CVaR 95%", "value": fmt(metrics["cvar_95"], pct=True)},
    {"label": "Calmar Ratio", "value": fmt(metrics["calmar_ratio"])},
]
render_kpi_row(row1)

row2 = [
    {"label": "Ann. Return", "value": fmt(metrics["annualized_return"], pct=True)},
    {"label": "Ann. Volatility", "value": fmt(metrics["annualized_volatility"], pct=True)},
]
if metrics["beta"] is not None:
    row2.extend([
        {"label": "Beta", "value": fmt(metrics["beta"])},
        {"label": "Alpha", "value": fmt(metrics["alpha"], pct=True)},
        {"label": "Information Ratio", "value": fmt(metrics["information_ratio"])},
    ])
render_kpi_row(row2)

with st.expander("Metric Explanations"):
    st.markdown("""
    - **Sharpe Ratio**: Risk-adjusted return (>1 = good, >2 = very good)
    - **Sortino Ratio**: Like Sharpe but only penalizes downside volatility
    - **Max Drawdown**: Largest peak-to-trough decline
    - **VaR 95%**: Maximum expected daily loss with 95% confidence
    - **CVaR 95%**: Average loss when VaR is exceeded (Expected Shortfall)
    - **Calmar Ratio**: Annualized return / |Max Drawdown|
    - **Beta**: Sensitivity to benchmark moves (1 = same as market)
    - **Alpha**: Excess return over benchmark (risk-adjusted)
    - **Information Ratio**: Active return per unit of tracking error
    """)

st.divider()

# ── Section 2: Value at Risk ───────────────────────────────────

st.subheader("Value at Risk")

col_var_chart, col_var_text = st.columns([2, 1])

with col_var_chart:
    fig_var = return_distribution(
        portfolio_returns,
        var_95=metrics["var_95"],
        var_99=metrics["var_99"],
    )
    st.plotly_chart(fig_var, use_container_width=True)

with col_var_text:
    var95_dollar = abs(metrics["var_95"]) * portfolio_value.iloc[-1]
    var99_dollar = abs(metrics["var_99"]) * portfolio_value.iloc[-1]
    st.markdown(f"""
    **Interpretation:**

    With **95% confidence**, the maximum daily loss is
    **{metrics['var_95']:.2%}** (${var95_dollar:,.0f}).

    With **99% confidence**, the maximum daily loss is
    **{metrics['var_99']:.2%}** (${var99_dollar:,.0f}).

    **Expected Shortfall** (average loss beyond VaR):
    **{metrics['cvar_95']:.2%}**
    """)

st.divider()

# ── Section 3: Monte Carlo Simulation ──────────────────────────

st.subheader("Monte Carlo Simulation")

col_mc1, col_mc2 = st.columns(2)
with col_mc1:
    n_sims = st.slider("Simulations", 500, 5000, 1000, 100)
with col_mc2:
    horizon_options = {"3 Months (63d)": 63, "6 Months (126d)": 126, "1 Year (252d)": 252}
    horizon_label = st.selectbox("Time Horizon", list(horizon_options.keys()), index=2)
    n_days = horizon_options[horizon_label]

if st.button("Run Monte Carlo", type="primary"):
    with st.spinner(f"Running {n_sims} simulations over {n_days} days..."):
        mc = monte_carlo_simulation(
            portfolio_returns, initial_capital,
            n_simulations=n_sims, n_days=n_days,
        )

    set_state("monte_carlo_results", {
        k: v for k, v in mc.items() if k != "simulations"
    })

    # Fan chart
    fig_mc = monte_carlo_chart(mc, n_days, n_display=min(200, n_sims))
    st.plotly_chart(fig_mc, use_container_width=True)

    # Final value histogram
    col_hist, col_mc_stats = st.columns([2, 1])

    with col_hist:
        fig_hist = go.Figure()
        fig_hist.add_trace(go.Histogram(
            x=mc["final_values"], nbinsx=50,
            marker_color=COLORS["blue"], opacity=0.7,
        ))
        fig_hist.add_vline(x=initial_capital, line_dash="dash",
                           line_color=COLORS["red"],
                           annotation_text="Initial Capital")
        fig_hist.add_vline(x=mc["median_value"], line_dash="dash",
                           line_color=COLORS["green"],
                           annotation_text="Median")
        fig_hist.update_layout(
            **CHART_LAYOUT, title="Distribution of Final Values",
            xaxis_title="Portfolio Value ($)", yaxis_title="Frequency",
        )
        st.plotly_chart(fig_hist, use_container_width=True)

    with col_mc_stats:
        st.markdown("**Monte Carlo Results:**")
        render_kpi_row([
            {"label": "P(Loss)", "value": fmt(mc["probability_of_loss"], pct=True)},
            {"label": "Expected", "value": f"${mc['expected_value']:,.0f}"},
        ])
        render_kpi_row([
            {"label": "Median", "value": f"${mc['median_value']:,.0f}"},
            {"label": "Best (95th)", "value": f"${mc['best_case']:,.0f}"},
        ])
        render_kpi_row([
            {"label": "Worst (5th)", "value": f"${mc['worst_case']:,.0f}"},
            {"label": "Initial", "value": f"${initial_capital:,.0f}"},
        ])

st.divider()

# ── Additional Charts ───────────────────────────────────────────

col_vol, col_sharpe = st.columns(2)

with col_vol:
    fig_vol = rolling_volatility(portfolio_returns, window=30)
    st.plotly_chart(fig_vol, use_container_width=True)

with col_sharpe:
    fig_sharpe = rolling_sharpe_chart(portfolio_returns, window=min(252, len(portfolio_returns) - 1))
    st.plotly_chart(fig_sharpe, use_container_width=True)

# ── Navigation ──────────────────────────────────────────────────

st.divider()
st.page_link("pages/5_Report.py", label="Continue to Report →", icon="📋")
