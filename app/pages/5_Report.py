import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
import pandas as pd
import io

from utils.state_manager import init_state, is_stage_complete, get_state
from utils.charts import (
    render_kpi_row, fmt, drawdown_chart, CHART_LAYOUT, COLORS,
)
import plotly.graph_objects as go

st.set_page_config(page_title="Report", page_icon="📋", layout="wide")
init_state()

st.header("📋 Report")

# ── Stage Completion Status ─────────────────────────────────────

stages = {
    1: ("Explore", is_stage_complete(1)),
    2: ("Strategy", is_stage_complete(2)),
    3: ("Backtest", is_stage_complete(3)),
    4: ("Risk Analysis", is_stage_complete(4)),
}

status_cols = st.columns(4)
all_complete = True
for col, (num, (name, done)) in zip(status_cols, stages.items()):
    with col:
        icon = "✅" if done else "❌"
        st.markdown(f"### {icon} {name}")
    if not done:
        all_complete = False

if not all_complete:
    st.warning("Complete all stages to generate a full report.")
    missing = [name for _, (name, done) in stages.items() if not done]
    st.info(f"Missing: {', '.join(missing)}")
    st.stop()

# ── Load All Data ───────────────────────────────────────────────

ticker = get_state("ticker")
strategy_name = get_state("strategy_name")
strategy_params = get_state("strategy_params")
backtest = get_state("backtest_results")
risk_metrics = get_state("risk_metrics")
mc_results = get_state("monte_carlo_results")
portfolio_value = backtest["portfolio_value"]
stats = backtest["trade_stats"]

# ── Header ──────────────────────────────────────────────────────

st.divider()

col_h1, col_h2, col_h3 = st.columns(3)
with col_h1:
    st.metric("Ticker", ticker)
with col_h2:
    st.metric("Strategy", strategy_name)
with col_h3:
    period_str = f"{portfolio_value.index[0].strftime('%Y-%m-%d')} to {portfolio_value.index[-1].strftime('%Y-%m-%d')}"
    st.metric("Period", period_str)

st.divider()

# ── Row 1: Key Metrics ─────────────────────────────────────────

st.subheader("Key Metrics")
render_kpi_row([
    {"label": "Total Return", "value": fmt(stats["total_return"], pct=True)},
    {"label": "Sharpe Ratio", "value": fmt(risk_metrics["sharpe_ratio"])},
    {"label": "Max Drawdown", "value": fmt(risk_metrics["max_drawdown"], pct=True)},
    {"label": "Win Rate", "value": fmt(stats["win_rate"], pct=True)},
    {"label": "Profit Factor", "value": fmt(stats["profit_factor"])},
    {"label": "Total Trades", "value": str(stats["total_trades"])},
])

st.divider()

# ── Row 2: Mini Charts ─────────────────────────────────────────

st.subheader("Overview Charts")
col_chart1, col_chart2 = st.columns(2)

with col_chart1:
    cum_ret = backtest["cumulative_returns"]
    fig_eq = go.Figure()
    fig_eq.add_trace(go.Scatter(
        x=cum_ret.index, y=cum_ret,
        line=dict(color=COLORS["blue"], width=2), name="Strategy",
        fill="tozeroy", fillcolor="rgba(30,136,229,0.1)",
    ))
    fig_eq.update_layout(
        **CHART_LAYOUT, title="Cumulative Returns",
        yaxis_tickformat=".0%", height=300,
        margin=dict(l=40, r=20, t=40, b=30),
    )
    st.plotly_chart(fig_eq, use_container_width=True)

with col_chart2:
    fig_dd = drawdown_chart(portfolio_value, title="Drawdown")
    fig_dd.update_layout(height=300, margin=dict(l=40, r=20, t=40, b=30))
    st.plotly_chart(fig_dd, use_container_width=True)

st.divider()

# ── Row 3: Strategy Details ────────────────────────────────────

st.subheader("Strategy Details")
col_d1, col_d2 = st.columns(2)

with col_d1:
    st.markdown(f"**Strategy Type:** {strategy_name}")
    if strategy_params:
        st.markdown("**Parameters:**")
        for k, v in strategy_params.items():
            if k == "features":
                st.markdown(f"- Features: {', '.join(v)}")
            else:
                st.markdown(f"- {k}: {v}")

with col_d2:
    st.markdown("**Trade Statistics:**")
    render_kpi_row([
        {"label": "Winners", "value": str(stats["winning_trades"])},
        {"label": "Losers", "value": str(stats["losing_trades"])},
        {"label": "Avg Win", "value": fmt(stats["avg_win"], pct=True)},
        {"label": "Avg Loss", "value": fmt(stats["avg_loss"], pct=True)},
    ])

st.divider()

# ── Row 4: Traffic Light Assessment ────────────────────────────

st.subheader("Assessment")

sharpe_ok = risk_metrics["sharpe_ratio"] > 1
dd_ok = risk_metrics["max_drawdown"] > -0.20
wr_ok = stats["win_rate"] > 0.50

score = sum([sharpe_ok, dd_ok, wr_ok])
if score == 3:
    color = "🟢"
    verdict = "Strong"
elif score >= 1:
    color = "🟡"
    verdict = "Moderate"
else:
    color = "🔴"
    verdict = "Weak"

col_a1, col_a2, col_a3 = st.columns(3)
with col_a1:
    st.markdown(f"{'🟢' if sharpe_ok else '🔴'} **Sharpe > 1:** {risk_metrics['sharpe_ratio']:.2f}")
with col_a2:
    st.markdown(f"{'🟢' if dd_ok else '🔴'} **Max DD < 20%:** {risk_metrics['max_drawdown']:.2%}")
with col_a3:
    st.markdown(f"{'🟢' if wr_ok else '🔴'} **Win Rate > 50%:** {stats['win_rate']:.2%}")

total_return = stats["total_return"]
period_months = (portfolio_value.index[-1] - portfolio_value.index[0]).days / 30
st.markdown(
    f"{color} **Overall: {verdict}** — "
    f"This strategy achieved **{total_return:.1%}** return over "
    f"**{period_months:.0f} months** with a maximum drawdown of "
    f"**{risk_metrics['max_drawdown']:.1%}**."
)

st.divider()

# ── Export ──────────────────────────────────────────────────────

st.subheader("Export")

col_ex1, col_ex2 = st.columns(2)

with col_ex1:
    # CSV Export — Trades + Metrics
    if backtest["trades"]:
        trade_df = pd.DataFrame(backtest["trades"])
        csv_buffer = io.StringIO()
        trade_df.to_csv(csv_buffer, index=False)
        st.download_button(
            "Download Trades (CSV)",
            data=csv_buffer.getvalue(),
            file_name=f"{ticker}_{strategy_name.replace(' ', '_')}_trades.csv",
            mime="text/csv",
        )

with col_ex2:
    # Metrics CSV
    metrics_data = {**stats, **risk_metrics}
    metrics_df = pd.DataFrame([metrics_data])
    csv_metrics = io.StringIO()
    metrics_df.to_csv(csv_metrics, index=False)
    st.download_button(
        "Download Metrics (CSV)",
        data=csv_metrics.getvalue(),
        file_name=f"{ticker}_{strategy_name.replace(' ', '_')}_metrics.csv",
        mime="text/csv",
    )
