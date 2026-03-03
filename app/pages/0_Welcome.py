"""
Welcome – Getting Started Guide
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
from utils.state_manager import init_state

st.set_page_config(page_title="Welcome", page_icon="👋", layout="wide")
init_state()

st.title("Trading Analytics Platform")
st.caption("Quantitative research · Strategy development · Backtesting · Risk management")

st.info(
    "This app guides you through a **5-stage workflow** — from picking a ticker "
    "to generating a full risk report. Work through each stage in order."
)

# --- How it works ---
st.subheader("How it works")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("#### 1. Pick a Stock")
    st.markdown(
        "Enter a ticker symbol (e.g. **AAPL**, **SPY**, **NVDA**) "
        "on the Explore page — view price charts, indicators, and fundamentals."
    )

with col2:
    st.markdown("#### 2. Build & Test")
    st.markdown(
        "Choose a rule-based or ML trading strategy, then backtest it "
        "against historical data with configurable position sizing."
    )

with col3:
    st.markdown("#### 3. Analyze & Export")
    st.markdown(
        "Review risk metrics, run Monte Carlo simulations, "
        "and export your results as CSV."
    )

st.divider()

# --- Stage Overview ---
st.subheader("What each stage does")

with st.expander("📊  Stage 1: Explore – Ticker Analysis", expanded=False):
    st.markdown("""
**Best for:** Getting an overview of a stock before building a strategy.

- **Price Chart** — Interactive candlestick chart with volume
- **Technical Indicators** — MACD, RSI, Bollinger Bands, Stochastic, MFI, ATR
- **Fundamentals** — P/E, Market Cap, EPS, margins, growth metrics

**Inputs:** Ticker symbol, time period (6mo to max)
    """)

with st.expander("📈  Stage 2: Strategy – Signal Generation", expanded=False):
    st.markdown("""
**Best for:** Creating buy/sell signals using rule-based or ML approaches.

**Rule-Based Strategies:**
- **SMA Crossover** — Buy when fast SMA crosses above slow SMA
- **RSI Overbought/Oversold** — Buy below oversold, sell above overbought
- **MACD Signal Crossover** — Buy when MACD crosses above signal line
- **Bollinger Band Breakout** — Buy/sell on band breakouts

**Machine Learning:**
- **Random Forest, Gradient Boosting, Logistic Regression**
- Configurable features, train/test split, prediction horizon
- Accuracy, precision, recall metrics with confusion matrix

**Inputs:** Strategy selection, parameters, feature selection (ML)
    """)

with st.expander("🔄  Stage 3: Backtest – Strategy Testing", expanded=False):
    st.markdown("""
**Best for:** Testing whether your strategy would have been profitable historically.

- **Portfolio simulation** with configurable initial capital
- **Position sizing** — Fixed (100%), percentage, or Kelly criterion
- **Commission** handling on both buy and sell
- **Cumulative returns** vs S&P 500 benchmark
- **Trade-by-trade** details with entry/exit prices, PnL, holding days

**Inputs:** Initial capital, position sizing mode, commission rate
    """)

with st.expander("⚠️  Stage 4: Risk Analysis – Risk Metrics & Monte Carlo", expanded=False):
    st.markdown("""
**Best for:** Understanding the risk profile of your strategy.

**Risk Metrics:**
- **Sharpe & Sortino Ratio** — Risk-adjusted returns
- **Max Drawdown** — Largest peak-to-trough decline
- **VaR & CVaR 95%** — Value at Risk and Expected Shortfall
- **Beta, Alpha, Information Ratio** — Benchmark-relative metrics
- **Calmar Ratio** — Return per unit of drawdown

**Monte Carlo Simulation:**
- Simulates 500–5000 future price paths
- Probability of loss, expected/median final value
- Configurable time horizon (3 months to 1 year)

**Inputs:** Monte Carlo parameters (simulations, time horizon)
    """)

with st.expander("📋  Stage 5: Report – Summary & Export", expanded=False):
    st.markdown("""
**Best for:** Reviewing all results and exporting data.

- **Status overview** — Completion status of each stage
- **Key metrics** at a glance (Return, Sharpe, Max DD, Win Rate)
- **Traffic light assessment** — Green/yellow/red overall rating
- **CSV export** — Download trades and metrics

**Inputs:** None (reads from all previous stages)
    """)

st.divider()

# --- Quick Start Examples ---
st.subheader("Quick start examples")

st.markdown("""
| Use case | Ticker | Suggested strategy |
|----------|--------|--------------------|
| Blue chip momentum | `AAPL` | SMA Crossover (20/50) |
| Tech volatility play | `NVDA` | Bollinger Band Breakout |
| Mean reversion | `SPY` | RSI Overbought/Oversold |
| ML signal research | `MSFT` | Random Forest |
| High-frequency signals | `TSLA` | MACD Signal Crossover |
""")

st.divider()

# --- Tips ---
st.subheader("Tips")

c1, c2 = st.columns(2)
with c1:
    st.markdown("""
**Ticker format**
- US stocks: `AAPL`, `TSLA`, `NVDA`
- ETFs: `SPY`, `QQQ`, `VTI`
- Indices: `^GSPC` (S&P 500), `^NDX` (Nasdaq)
    """)
with c2:
    st.markdown("""
**Performance tips**
- Data is cached for 5 minutes — re-runs are instant
- For Monte Carlo: start with 500 simulations, raise to 5000 for precision
- ML models need ~200+ data points — use 2y+ period
- Fundamental data is only available for US-listed stocks (not ETFs)
    """)

st.divider()
st.page_link("pages/1_Explore.py", label="Start with Explore →", icon="📊")
