# CLAUDE.md - Trading Analytics Platform Guidelines

## Project Overview

Trading Analytics is a quantitative research and analysis platform for strategy development, backtesting, and stock analysis. Built with Python + Streamlit, it provides technical indicators, regression models (OLS/Logistic), risk metrics, and strategy backtesting.

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
├── app/                    # Streamlit web application
│   ├── app.py              # Main dashboard + navigation
│   ├── yfinance_fix.py     # Chrome session singleton for Yahoo Finance
│   ├── pages/              # 0_Welcome, 1_Rating, 2_Technical, 3_Fundamental, 4_Risk, 5_Model, 6_Backtesting
│   └── components/         # Shared chart builders (charts.py) + KPI helpers (kpi_cards.py)
└── analytics_core/         # Core Python package
    ├── rating.py           # Stock scoring logic (technical, fundamental, ML)
    ├── strategy/           # Technical indicators + regression models
    ├── strategies/         # RSI+MACD and LogReg strategy definitions
    ├── risk/               # Sharpe, VaR, max drawdown calculations
    └── backtest/           # Strategy vs. buy & hold engine
```

## Key Modules

- **app/yfinance_fix.py** - Rate limiting workaround using curl_cffi to impersonate Chrome
- **analytics_core/rating.py** - Stock scoring (0–100) across technical, fundamental, and ML dimensions
- **analytics_core/strategy/indicators.py** - Chainable technical indicators (MACD, RSI, MFI, Bollinger Bands)
- **analytics_core/strategy/models.py** - LinearRegression (OLS) and LogisticRegression for price prediction
- **analytics_core/risk/metrics.py** - Risk calculations (Sharpe ratio, VaR, max drawdown, Monte Carlo)
- **analytics_core/backtest/engine.py** - Backtest engine (strategy vs. buy & hold)
- **analytics_core/strategies/strategy_logreg.py** - LogReg signal generator (used by Rating + Backtesting)
- **analytics_core/strategies/strategy_rsi_macd.py** - RSI+MACD signal generator (used by Backtesting)

## Critical Guidelines

### DO NOT break the yfinance fix
`app/yfinance_fix.py` is critical for data fetching. It uses `curl_cffi` with Chrome impersonation to bypass Yahoo Finance rate limiting. Never modify this without understanding the session/cookie handling.

### Ask before implementing new features
Discuss the approach before writing code for new functionality. Don't assume an implementation path.

### Handle errors with user-friendly messages
In Streamlit code, catch exceptions and display readable error messages to the user rather than raw tracebacks.

### Be careful with these fragile areas
1. **Indicator calculations** - Math must match standard technical analysis definitions exactly.
2. **yfinance_fix session** - All `yf.download` and `yf.Ticker` calls must use `session=yfinance_fix.chrome_session`.

## Code Style

- **Language**: Use English for all new code and comments
- **Comments**: Minimal - code should be self-documenting
- **Data manipulation**: Use pandas for all data operations
- **Testing**: No formal test suite; manual testing via Streamlit UI
