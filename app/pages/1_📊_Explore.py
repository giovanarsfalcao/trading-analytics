import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

from utils.state_manager import init_state, set_state, get_state, clear_downstream
from utils.data_fetcher import fetch_price_data
from utils.indicators import calculate_all_indicators
from utils.fundamentals import fetch_fundamentals
from utils.charts import (
    candlestick_chart, indicator_subplot, render_kpi_row, fmt,
    CHART_LAYOUT, COLORS,
)

st.set_page_config(page_title="Explore", page_icon="📊", layout="wide")
init_state()

st.header("📊 Explore")
st.caption("Pick a ticker, analyze price action, technical indicators, and fundamentals.")

# ── Ticker Input ────────────────────────────────────────────────

col_input, col_period = st.columns([3, 1])
with col_input:
    ticker = st.text_input("Ticker Symbol", value=get_state("ticker") or "AAPL").strip().upper()
with col_period:
    period = st.selectbox("Period", ["6mo", "1y", "2y", "5y", "max"], index=2)

# Quick-select buttons
st.caption("Popular:")
popular = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY", "QQQ", "BRK-B"]
button_cols = st.columns(len(popular))
for i, t in enumerate(popular):
    with button_cols[i]:
        if st.button(t, key=f"quick_{t}", use_container_width=True):
            ticker = t

# ── Load Data ───────────────────────────────────────────────────

with st.spinner(f"Loading {ticker}..."):
    df = fetch_price_data(ticker, period=period)

if df.empty:
    st.error(f"No data found for **{ticker}**. Please check the ticker symbol.")
    st.stop()

# Save to state (clear downstream if ticker changed)
prev_ticker = get_state("ticker")
if ticker != prev_ticker:
    clear_downstream(1)
set_state("ticker", ticker)
set_state("price_data", df)

# Add all indicators for Tab 2
df_ind = calculate_all_indicators(df)

st.success(
    f"**{ticker}** loaded — {len(df)} data points "
    f"({df.index[0].strftime('%Y-%m-%d')} to {df.index[-1].strftime('%Y-%m-%d')})"
)

# ── Tabs ────────────────────────────────────────────────────────

tab_price, tab_indicators, tab_fundamentals = st.tabs(
    ["Price Chart", "Technical Indicators", "Fundamentals"]
)

# ── Tab 1: Price Chart ──────────────────────────────────────────

with tab_price:
    fig = candlestick_chart(df, title=f"{ticker} — Price & Volume")
    st.plotly_chart(fig, use_container_width=True)

# ── Tab 2: Technical Indicators ─────────────────────────────────

with tab_indicators:
    available_indicators = ["MACD", "RSI", "Bollinger Bands", "Stochastic", "MFI", "ATR"]
    indicator_key_map = {
        "MACD": "MACD",
        "RSI": "RSI",
        "Bollinger Bands": "BB",
        "Stochastic": "Stochastic",
        "MFI": "MFI",
        "ATR": "ATR",
    }

    selected = st.multiselect(
        "Select Indicators",
        available_indicators,
        default=["MACD", "RSI"],
    )

    if not selected:
        st.info("Select at least one indicator from the list above.")
    else:
        for ind_name in selected:
            key = indicator_key_map[ind_name]
            try:
                fig = indicator_subplot(df_ind, key)
                st.plotly_chart(fig, use_container_width=True)
            except KeyError as e:
                st.warning(f"Could not render {ind_name}: missing column {e}. Need more data points.")

    # SMA/EMA overlay option
    with st.expander("Moving Averages Overlay"):
        sma_cols = [c for c in df_ind.columns if c.startswith("SMA_") or c.startswith("EMA_")]
        if sma_cols:
            fig_ma = go.Figure()
            fig_ma.add_trace(go.Scatter(
                x=df_ind.index, y=df_ind["Close"],
                line=dict(color=COLORS["white"], width=1.5), name="Close",
            ))
            palette = [COLORS["blue"], COLORS["orange"], COLORS["green"],
                       COLORS["purple"], COLORS["light_blue"]]
            for i, col in enumerate(sma_cols):
                fig_ma.add_trace(go.Scatter(
                    x=df_ind.index, y=df_ind[col],
                    line=dict(color=palette[i % len(palette)], width=1, dash="dot"),
                    name=col,
                ))
            fig_ma.update_layout(
                **CHART_LAYOUT, title="Moving Averages",
                hovermode="x unified",
            )
            st.plotly_chart(fig_ma, use_container_width=True)

# ── Tab 3: Fundamentals ────────────────────────────────────────

with tab_fundamentals:
    with st.spinner("Loading fundamentals..."):
        fundamentals = fetch_fundamentals(ticker)

    if not fundamentals:
        st.warning(f"No fundamental data available for **{ticker}**.")
    else:
        set_state("fundamentals", fundamentals)
        company_name = fundamentals.get("name", ticker)

        st.subheader(company_name)
        if fundamentals.get("sector"):
            st.caption(f"{fundamentals['sector']} — {fundamentals.get('industry', '')}")

        # Valuation KPIs
        render_kpi_row([
            {"label": "Market Cap", "value": fmt(fundamentals.get("market_cap"), bn=True)},
            {"label": "P/E (TTM)", "value": fmt(fundamentals.get("pe"))},
            {"label": "P/B", "value": fmt(fundamentals.get("price_to_book"))},
            {"label": "EV/EBITDA", "value": fmt(fundamentals.get("ev_to_ebitda"), x=True)},
            {"label": "EPS (TTM)", "value": fmt(fundamentals.get("eps"))},
            {"label": "Div. Yield", "value": fmt(fundamentals.get("dividend_yield"), pct=True)},
            {"label": "Beta", "value": fmt(fundamentals.get("beta"))},
        ])

        st.divider()

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Profitability**")
            render_kpi_row([
                {"label": "Gross Margin", "value": fmt(fundamentals.get("gross_margins"), pct=True)},
                {"label": "Profit Margin", "value": fmt(fundamentals.get("profit_margin"), pct=True)},
            ])
            render_kpi_row([
                {"label": "ROE", "value": fmt(fundamentals.get("roe"), pct=True)},
                {"label": "ROA", "value": fmt(fundamentals.get("roa"), pct=True)},
            ])

        with col2:
            st.markdown("**Price Range & Growth**")
            render_kpi_row([
                {"label": "52W High", "value": fmt(fundamentals.get("high_52w"))},
                {"label": "52W Low", "value": fmt(fundamentals.get("low_52w"))},
            ])
            render_kpi_row([
                {"label": "Revenue Growth", "value": fmt(fundamentals.get("revenue_growth"), pct=True)},
                {"label": "D/E Ratio", "value": fmt(fundamentals.get("debt_to_equity"))},
            ])

# ── Navigation ──────────────────────────────────────────────────

st.divider()
st.page_link("pages/2_📈_Strategy.py", label="Continue to Strategy →", icon="📈")
