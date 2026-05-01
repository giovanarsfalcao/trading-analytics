# Trading Analytics Platform

Quantitative research platform for strategy development, backtesting, and risk analysis. Built with Next.js 16 + FastAPI + Jupyter research suite.

## Workflow

| Stage | Description |
|-------|-------------|
| **1. Explore** | Search any ticker, visualize OHLCV candlestick chart |
| **2. Features** | Price-derived features (quant + technical indicators with adjustable parameters), fundamentals, macro, alternative data |
| **3. Signals** | ML signal generation (Random Forest, Gradient Boosting, Logistic Regression) with optional walk-forward validation |
| **4. Backtest** | Trade-by-trade simulation with position sizing (fixed, percentage, Kelly), commission, slippage, and S&P 500 benchmark |
| **5. Risk** | Sharpe, Sortino, VaR, CVaR, Beta, Alpha, Calmar Ratio, Monte Carlo simulation |
| **6. Report** | Summary dashboard with traffic-light assessment and CSV export |

## Features

### Price-Derived Features
- **Quant**: Momentum (21d, 252-21d), Volatility Ratio, Historical Volatility, Amihud Illiquidity, Return Autocorrelation
- **Technical**: RSI, MACD Histogram, ATR, Bollinger %B, MFI, Volume Ratio — with interactive parameter sliders

### Signal Generation
- 3 ML classifiers with temporal train/test split (no data leakage)
- Walk-forward validation with rolling windows and per-fold metrics
- Probability thresholding for buy/hold/sell signals
- Signal shift by 1 bar to prevent look-ahead bias

### Research Notebooks
Jupyter notebook suite under `research/` covering:
- Data exploration (stationarity, Brownian motion)
- Feature engineering (quant features, tech indicators, fundamentals)
- Supervised learning (LogReg, Random Forest with sklearn pipeline)
- Unsupervised learning (HMM regime detection)
- Walk-forward validation
- Backtesting and risk analysis

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | FastAPI, pandas, scikit-learn, ta (technical analysis) |
| Data | yfinance (Yahoo Finance API) with curl_cffi Chrome session |
| State | Zustand with localStorage persistence |
| Deploy | fly.io + GitHub Actions CI/CD |

## Quick Start

```bash
# Backend
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`, API at `http://localhost:8000`.

## Deployment

Hosted on [fly.io](https://fly.io) with auto-deploy via GitHub Actions on push to `main`.

```bash
fly deploy
```
