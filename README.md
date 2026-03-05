# Trading Analytics Platform

Quantitative research platform for strategy development, backtesting, and risk analysis. Built with Next.js 16 + FastAPI.

## Features

- **Explore** – Price charts, technical indicators (MACD, RSI, Bollinger Bands, Stochastic, MFI, ATR), and fundamental data
- **Strategy Builder** – 4 rule-based strategies (SMA Crossover, RSI, MACD, Bollinger) + 3 ML models (Random Forest, Gradient Boosting, Logistic Regression)
- **Backtesting** – Trade-by-trade simulation with position sizing (fixed, percentage, Kelly), commission handling, and S&P 500 benchmark comparison
- **Risk Analysis** – Sharpe, Sortino, VaR, CVaR, Beta, Alpha, Calmar Ratio, Monte Carlo simulation
- **Report** – Summary dashboard with traffic light assessment and CSV export

## Quick Start

```bash
# Backend
pip install -r api/requirements.txt
uvicorn api.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Deployment

Hosted on [fly.io](https://fly.io) with auto-deploy via GitHub Actions on push to `main`.

```bash
fly deploy
```
