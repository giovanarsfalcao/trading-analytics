"""
Welcome – Getting Started Guide
"""

import streamlit as st

st.title("Trading Analytics Platform")
st.caption("Quantitative research · Technical & fundamental analysis · Risk management · Backtesting")

st.info(
    "Enter a stock ticker once in the sidebar and instantly get "
    "ratings, risk metrics, model signals, and backtests — across all pages."
)

# --- How it works ---
st.subheader("How it works")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("#### 1. Pick a Stock")
    st.markdown(
        "Enter a ticker symbol (e.g. **AAPL**, **SPY**, **NVDA**) "
        "in the sidebar — it applies to all analysis pages automatically."
    )

with col2:
    st.markdown("#### 2. Choose a Tool")
    st.markdown(
        "Use the navigation on the left to switch between **Analysis** "
        "(Rating, Technical, Fundamental, Risk) or **Research** (Models, Backtesting)."
    )

with col3:
    st.markdown("#### 3. Explore")
    st.markdown(
        "Adjust parameters in the sidebar — charts and metrics "
        "update instantly. Start with the defaults."
    )

st.divider()

# --- Page Overview ---
st.subheader("What each page does")

with st.expander("⭐  Stock Rating – Algorithmic Score", expanded=False):
    st.markdown("""
**Best for:** Quick overall assessment before diving into detail pages.

Three scored dimensions combined into one overall rating:
- **Technical Score** – RSI, MACD, Bollinger Bands, MFI weighted equally
- **Fundamental Score** – P/E, Revenue Growth, ROE, Debt/Equity (stocks only; N/A for ETFs)
- **ML Score** – Logistic Regression probability of upward movement

Each score ranges **0–100** with labels: Strong Sell / Sell / Neutral / Buy / Strong Buy.
Includes a natural language summary and a detailed score breakdown table.

**Inputs:** Ticker (global sidebar)
    """)

with st.expander("📈  Technical Analysis – Chart Indicators", expanded=False):
    st.markdown("""
**Best for:** Reading price momentum, trend direction, and volatility from charts.

Four interactive indicator charts:
- **MACD** – Momentum and trend direction via moving average convergence/divergence
- **RSI** – Overbought / oversold zones (above 70 = overbought, below 30 = oversold)
- **MFI** – Money Flow Index: combines price and volume to measure buying/selling pressure
- **Bollinger Bands** – Volatility envelope; breakouts above/below bands signal potential moves

**Inputs:** Ticker, Interval (daily / hourly / 15m / 5m), Indicator parameters (optional)
    """)

with st.expander("💼  Fundamental Analysis – Valuation & Financials", expanded=False):
    st.markdown("""
**Best for:** Assessing the intrinsic value and financial health of a company.

Covers:
- **Valuation multiples** – P/E, P/B, EV/EBITDA, P/S, PEG ratio
- **Revenue & earnings trends** – Annual income statement (last 4 years)
- **Profitability** – Gross margin, net margin, ROE, ROA
- **Cash flow** – Operating cash flow and free cash flow trends
- **Balance sheet** – Debt/equity ratio, current ratio, total cash vs. debt

**Inputs:** Ticker (US stocks recommended; e.g. `AAPL`, `MSFT`, `GOOGL`)
    """)

with st.expander("🛡️  Risk Management", expanded=False):
    st.markdown("""
**Best for:** Understanding how risky an asset is.

Metrics covered:
- **Sharpe & Sortino ratio** – Risk-adjusted return (Sortino only penalizes downside)
- **VaR & CVaR 95%** – Maximum expected loss on a bad day (CVaR = average beyond VaR)
- **Beta & Alpha** – Sensitivity to the benchmark (e.g. SPY) and excess return
- **Rolling volatility & Sharpe** – How risk changes over time
- **Monthly returns heatmap** – Calendar view of gains and losses by month
- **Monte Carlo simulation** – Simulates thousands of possible future price paths

**Inputs:** Ticker, Benchmark (default: SPY), Period, Monte Carlo settings
    """)

with st.expander("🤖  Model Insights – ML Price Prediction", expanded=False):
    st.markdown("""
**Best for:** Using machine learning to forecast price direction and generate research signals.

Two tabs:
1. **Linear Regression (OLS)** – Predicts future price changes; shows R², coefficients, residual diagnostics
2. **Logistic Regression** – Classifies next move as UP or DOWN; shows AUC, ROC curve, confusion matrix

**Inputs:** Ticker, Interval (daily / hourly / 15m / 5m), Features, Shift (forecast horizon)
    """)

with st.expander("⏱️  Backtesting – Strategy vs. Buy & Hold", expanded=False):
    st.markdown("""
**Best for:** Testing whether a strategy beats simply holding the asset.

Compares a rule-based strategy against a passive buy & hold position:
- **Performance table** – Total return, Sharpe, max drawdown, VaR side by side
- **Equity curve** – Visual comparison of both strategies over time
- **Signal distribution** – How often the strategy went Long / Short / Flat

Available strategies:
- **RSI + MACD** – Classic momentum strategy (no parameters needed)
- **Logistic Regression** – ML-based strategy (configurable shift and signal threshold)

**Inputs:** Ticker, Period, Strategy selection
    """)

st.divider()

# --- Quick Start Examples ---
st.subheader("Quick start examples")

st.markdown("""
| Use case | Ticker input | Suggested page |
|----------|-------------|---------------|
| Single stock deep-dive | `AAPL` | Risk Management |
| Fundamental value check | `AAPL` | Fundamental Analysis |
| Chart momentum read | `NVDA` | Technical Analysis |
| ML signal research | `SPY` | Model Insights |
| ETF momentum backtest | `SPY` | Backtesting |
| Overall stock assessment | `MSFT` | Stock Rating |
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
- Enter the ticker once in the sidebar — it persists across all pages
    """)
with c2:
    st.markdown("""
**Performance tips**
- Data is cached for 5 minutes — re-runs are instant
- For Monte Carlo: start with 500 simulations to stay fast, raise to 5000 for precision
- Logistic Regression needs at least ~200 data points — use daily interval with 2y+ period
- Fundamental data is only available for US-listed stocks (not ETFs)
    """)
