# CLAUDE.md - Trading Analytics Platform Guidelines

## Project Overview

Trading Analytics is a quantitative research platform with a 5-stage workflow: Explore → Strategy → Backtest → Risk Analysis → Report. Built with Python + Streamlit, it provides technical indicators, rule-based and ML trading strategies, trade-by-trade backtesting, and comprehensive risk analysis.

## Quick Start

```bash
# Install dependencies
pip install -r app/requirements.txt

# Run the Streamlit app
streamlit run app/app.py
```

## Architecture

```
trading-analytics/
├── app/
│   ├── app.py                 # Entry point (streamlit run app/app.py)
│   ├── requirements.txt        # Python dependencies
│   └── pages/
│       ├── 1_Explore.py        # Stage 1: Ticker analysis (price, indicators, fundamentals)
│       ├── 2_Strategy.py       # Stage 2: Rule-based & ML signal generation
│       ├── 3_Backtest.py       # Stage 3: Trade-by-trade backtesting
│       ├── 4_Risk_Analysis.py  # Stage 4: Risk metrics & Monte Carlo
│       └── 5_Report.py         # Stage 5: Summary & CSV export
├── utils/
│   ├── yfinance_fix.py         # Chrome session singleton for Yahoo Finance
│   ├── state_manager.py        # Session state management (stage gating)
│   ├── data_fetcher.py         # yfinance data fetching with caching
│   ├── indicators.py           # Technical indicators via 'ta' library
│   ├── fundamentals.py         # Fundamental data via yfinance
│   ├── charts.py               # Plotly chart functions + KPI helpers
│   ├── strategies.py           # 4 rule-based + 3 ML strategies
│   ├── backtester.py           # Backtest engine with position sizing
│   └── risk_analysis.py        # Risk metrics + Monte Carlo simulation
├── notebooks/                  # Research & development notebooks
├── Dockerfile                  # Docker container (entry: app/app.py)
├── fly.toml                    # fly.io deployment config
└── .github/workflows/
    └── fly-deploy.yml          # Auto-deploy on push to main
```

## Key Modules

- **utils/yfinance_fix.py** - Rate limiting workaround using curl_cffi to impersonate Chrome
- **utils/state_manager.py** - Session state with stage gating (each stage requires previous completion)
- **utils/indicators.py** - SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, MFI via `ta` library
- **utils/strategies.py** - SMA Crossover, RSI, MACD Crossover, Bollinger Breakout + Random Forest, Gradient Boosting, Logistic Regression
- **utils/backtester.py** - Trade-by-trade engine with fixed/percentage/Kelly position sizing and commission
- **utils/risk_analysis.py** - Sharpe, Sortino, VaR, CVaR, Beta, Alpha, Calmar, Information Ratio + Monte Carlo
- **utils/charts.py** - All Plotly charts, KPI cards, formatting helpers

## Deployment

- **fly.io** with GitHub Actions auto-deploy on push to `main`
- Workflow: `.github/workflows/fly-deploy.yml`
- Requires `FLY_API_TOKEN` as GitHub Secret
- Region: `gru` (São Paulo), 1GB RAM, shared CPU

## Critical Guidelines

### DO NOT break the yfinance fix
`utils/yfinance_fix.py` is critical for data fetching. It uses `curl_cffi` with Chrome impersonation to bypass Yahoo Finance rate limiting. Never modify this without understanding the session/cookie handling.

### Ask before implementing new features
Discuss the approach before writing code for new functionality. Don't assume an implementation path.

### Handle errors with user-friendly messages
In Streamlit code, catch exceptions and display readable error messages to the user rather than raw tracebacks.

### Be careful with these fragile areas
1. **Indicator calculations** - Math must match standard technical analysis definitions exactly.
2. **yfinance_fix session** - All `yf.download` and `yf.Ticker` calls must use `session=yfinance_fix.chrome_session`.
3. **Look-ahead bias** - All strategy signals must be shifted by 1 bar. ML models use temporal train/test splits (no shuffling).

## Code Style

- **Language**: Use English for all new code and comments
- **Comments**: Minimal - code should be self-documenting
- **Data manipulation**: Use pandas for all data operations
- **Testing**: No formal test suite; manual testing via Streamlit UI
