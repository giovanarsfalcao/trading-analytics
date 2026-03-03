import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go

from utils.state_manager import init_state, is_stage_complete, get_state, set_state, clear_downstream
from utils.backtester import run_backtest
from utils.data_fetcher import fetch_benchmark_data
from utils.charts import (
    render_kpi_row, fmt, drawdown_chart, CHART_LAYOUT, COLORS,
)

st.set_page_config(page_title="Backtest", page_icon="🔄", layout="wide")
init_state()

st.header("🔄 Backtest")

# ── Stage Gate ──────────────────────────────────────────────────

if not is_stage_complete(2):
    st.warning("Please complete the **Strategy** step first (generate signals).")
    st.page_link("pages/2_Strategy.py", label="Go to Strategy", icon="📈")
    st.stop()

ticker = get_state("ticker")
strategy_name = get_state("strategy_name")
signals = get_state("signals")
df = get_state("price_data")

st.caption(f"Ticker: **{ticker}** | Strategy: **{strategy_name}**")

# ── Configuration ───────────────────────────────────────────────

with st.expander("Backtest Settings", expanded=True):
    col1, col2, col3 = st.columns(3)
    with col1:
        initial_capital = st.number_input("Initial Capital ($)", value=10000, min_value=1000, step=1000)
    with col2:
        position_sizing = st.selectbox("Position Sizing", ["fixed", "percentage", "kelly"])
        position_pct = 1.0
        if position_sizing == "percentage":
            position_pct = st.slider("Position %", 0.1, 1.0, 0.5, 0.05)
    with col3:
        commission = st.slider("Commission (%)", 0.0, 1.0, 0.1, 0.05) / 100

# ── Run Backtest ────────────────────────────────────────────────

if st.button("Run Backtest", type="primary"):
    with st.spinner("Running backtest..."):
        results = run_backtest(
            df, signals,
            initial_capital=initial_capital,
            position_size=position_sizing,
            position_pct=position_pct,
            commission=commission,
        )

        # Fetch benchmark
        period_days = (df.index[-1] - df.index[0]).days
        if period_days > 1500:
            bench_period = "5y"
        elif period_days > 700:
            bench_period = "2y"
        else:
            bench_period = "1y"
        benchmark_df = fetch_benchmark_data(period=bench_period)
        if not benchmark_df.empty:
            bench_returns = benchmark_df["Close"].pct_change().dropna()
        else:
            bench_returns = pd.Series(dtype=float)

    # Save to state
    set_state("backtest_results", results)
    set_state("portfolio_value", results["portfolio_value"])
    set_state("trades", results["trades"])
    set_state("benchmark_returns", bench_returns)
    clear_downstream(3)

    stats = results["trade_stats"]

    # ── KPI Row ─────────────────────────────────────────────────

    render_kpi_row([
        {"label": "Total Return", "value": fmt(stats["total_return"], pct=True)},
        {"label": "Ann. Return", "value": fmt(stats["annualized_return"], pct=True)},
        {"label": "Max Drawdown", "value": fmt(stats["max_drawdown"], pct=True)},
        {"label": "Win Rate", "value": fmt(stats["win_rate"], pct=True)},
        {"label": "Profit Factor", "value": fmt(stats["profit_factor"])},
        {"label": "Sharpe Ratio", "value": fmt(stats["sharpe_ratio"])},
    ])

    st.divider()

    # ── Chart 1: Cumulative Returns vs Benchmark ────────────────

    st.subheader("Cumulative Returns")
    cum_ret = results["cumulative_returns"]

    fig_equity = go.Figure()
    fig_equity.add_trace(go.Scatter(
        x=cum_ret.index, y=cum_ret,
        name="Strategy", line=dict(color=COLORS["blue"], width=2),
    ))

    if not bench_returns.empty:
        # Align benchmark to same date range
        bench_aligned = bench_returns.loc[
            (bench_returns.index >= cum_ret.index[0]) &
            (bench_returns.index <= cum_ret.index[-1])
        ]
        bench_cum = (1 + bench_aligned).cumprod() - 1
        fig_equity.add_trace(go.Scatter(
            x=bench_cum.index, y=bench_cum,
            name="S&P 500", line=dict(color=COLORS["gray"], width=1.5, dash="dot"),
        ))

    fig_equity.update_layout(
        **CHART_LAYOUT,
        yaxis_title="Cumulative Return", yaxis_tickformat=".1%",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        hovermode="x unified",
    )
    st.plotly_chart(fig_equity, use_container_width=True)

    # ── Chart 2: Drawdown ───────────────────────────────────────

    col_dd, col_trades_scatter = st.columns(2)

    with col_dd:
        st.subheader("Drawdown")
        fig_dd = drawdown_chart(results["portfolio_value"])
        st.plotly_chart(fig_dd, use_container_width=True)

    # ── Chart 3: Individual Trades Scatter ──────────────────────

    with col_trades_scatter:
        st.subheader("Trade Returns")
        if results["trades"]:
            trade_dates = [t["exit_date"] for t in results["trades"] if "exit_date" in t]
            trade_returns = [t["return_pct"] for t in results["trades"] if "return_pct" in t]
            trade_colors = [COLORS["green"] if r > 0 else COLORS["red"] for r in trade_returns]

            fig_trades = go.Figure()
            fig_trades.add_trace(go.Scatter(
                x=trade_dates, y=trade_returns,
                mode="markers",
                marker=dict(size=8, color=trade_colors, opacity=0.7),
                name="Trades",
            ))
            fig_trades.add_hline(y=0, line_color=COLORS["gray"], line_dash="dash")
            fig_trades.update_layout(
                **CHART_LAYOUT,
                yaxis_title="Return %", yaxis_tickformat=".1%",
                hovermode="closest",
            )
            st.plotly_chart(fig_trades, use_container_width=True)

    # ── Trade Table ─────────────────────────────────────────────

    st.subheader("Trade Details")
    if results["trades"]:
        trade_df = pd.DataFrame(results["trades"])
        display_cols = [c for c in ["entry_date", "exit_date", "direction", "entry_price",
                                     "exit_price", "return_pct", "holding_days", "pnl"]
                        if c in trade_df.columns]
        trade_display = trade_df[display_cols].copy()
        if "return_pct" in trade_display.columns:
            trade_display["return_pct"] = trade_display["return_pct"].apply(lambda x: f"{x:.2%}")
        if "pnl" in trade_display.columns:
            trade_display["pnl"] = trade_display["pnl"].apply(lambda x: f"${x:,.2f}")
        if "entry_price" in trade_display.columns:
            trade_display["entry_price"] = trade_display["entry_price"].apply(lambda x: f"${x:,.2f}")
        if "exit_price" in trade_display.columns:
            trade_display["exit_price"] = trade_display["exit_price"].apply(lambda x: f"${x:,.2f}")

        st.dataframe(trade_display, use_container_width=True, hide_index=True)

        render_kpi_row([
            {"label": "Total Trades", "value": str(stats["total_trades"])},
            {"label": "Winners", "value": str(stats["winning_trades"])},
            {"label": "Losers", "value": str(stats["losing_trades"])},
            {"label": "Avg Win", "value": fmt(stats["avg_win"], pct=True)},
            {"label": "Avg Loss", "value": fmt(stats["avg_loss"], pct=True)},
            {"label": "Max DD Duration", "value": f"{stats['max_drawdown_duration_days']}d"},
        ])
    else:
        st.info("No trades were executed. The strategy may not have generated any entry signals.")

# ── Navigation ──────────────────────────────────────────────────

st.divider()
st.page_link("pages/4_Risk_Analysis.py", label="Continue to Risk Analysis →", icon="⚠️")
