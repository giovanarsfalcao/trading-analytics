# CLAUDE.md - Trading Analytics Platform Guidelines

## Project Overview

Trading Analytics is a quantitative research platform with a 6-stage workflow: Explore → Features → Signals → Backtest → Risk Analysis → Report. Built with Next.js 16 (frontend) + FastAPI (backend) + shared Python utils for financial calculations. Accompanied by a Jupyter notebook research suite under `research/`.

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

App runs at `http://localhost:3000`, API at `http://localhost:8000`.

## Architecture

```
trading-analytics/
├── frontend/                   # Next.js 16 (React 19, TypeScript, Tailwind, shadcn/ui)
│   ├── src/app/                # App Router (layout.tsx, page.tsx)
│   ├── src/components/         # React components by feature
│   │   ├── explore/            # TickerSearch, CandlestickChart
│   │   ├── features/           # FeaturesPanel, PriceDerivedPanel, FeatureCard
│   │   ├── signals/            # SignalsForm, SignalChart, WalkForward charts
│   │   ├── backtest/           # BacktestPanel, EquityCurve, TradeTable
│   │   ├── risk/               # RiskPanel, MonteCarloChart
│   │   └── report/             # ReportPanel
│   ├── src/stores/store.ts     # Zustand state management (6-stage workflow)
│   ├── src/types/index.ts      # TypeScript type definitions
│   ├── next.config.ts          # Standalone output + /api/* rewrite to backend
│   └── package.json
├── api/
│   ├── main.py                 # FastAPI app with all routes
│   └── requirements.txt        # Python dependencies
├── utils/                      # Shared Python modules (used by API)
│   ├── yfinance_fix.py         # Chrome session singleton for Yahoo Finance
│   ├── data.py                 # yfinance data fetching with TTL caching
│   ├── features.py             # Technical indicators + quant features
│   ├── signals.py              # ML signal generation (single-split + walk-forward)
│   ├── backtest.py             # Backtest engine with position sizing
│   └── risk.py                 # Risk metrics + Monte Carlo simulation
├── research/                   # Jupyter notebook research suite
│   ├── 1_data_exploration/     # Stationarity, Brownian motion, alternative data
│   ├── 2_features/             # Price-derived (quant + tech), fundamentals
│   ├── 3_signal_generation/    # Feature engineering, supervised (LogReg, RF), unsupervised (HMM), walk-forward
│   ├── 4_backtesting/          # Strategy comparison notebooks
│   └── 5_risk_analysis/        # Risk metrics, MCMC
├── Dockerfile                  # Multi-stage: Next.js build + Python/Node runtime
├── start.sh                    # Startup: Uvicorn :8000 + Node :8080
├── fly.toml                    # fly.io deployment config
└── .github/workflows/
    └── fly-deploy.yml          # Auto-deploy on push to main
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/search` | Ticker search (Yahoo Finance) |
| POST | `/api/explore` | Fetch OHLCV, indicators (tech + quant), fundamentals |
| POST | `/api/signals` | Generate ML trading signals (single train/test split) |
| POST | `/api/walk-forward` | Walk-forward ML signals (rolling window validation) |
| POST | `/api/backtest` | Run backtest simulation |
| POST | `/api/risk` | Calculate risk metrics |
| POST | `/api/monte-carlo` | Run Monte Carlo simulation |
| POST | `/api/export` | Export data as CSV |

## Key Modules

- **utils/yfinance_fix.py** - Rate limiting workaround using curl_cffi to impersonate Chrome
- **utils/features.py** - Technical indicators (RSI, MACD, BB, ATR, MFI, Stochastic) via `ta` library + quant features (momentum, vol_ratio, autocorrelation, illiquidity)
- **utils/signals.py** - ML signal generation: `ml_strategy()` (single train/test split) + `walk_forward_ml_strategy()` (rolling window). Models: Random Forest, Gradient Boosting, Logistic Regression
- **utils/backtest.py** - Trade-by-trade engine with fixed/percentage/Kelly position sizing and commission
- **utils/risk.py** - Sharpe, Sortino, VaR, CVaR, Beta, Alpha, Calmar, Information Ratio + Monte Carlo

## Frontend Stages

1. **Explore** - Ticker search + candlestick price chart
2. **Features** - 4-tab layout: Price-Derived (quant charts + tech indicators with parameter sliders), Fundamentals, Macro (placeholder), Alternative (placeholder)
3. **Signals** - Supervised learning (model config + walk-forward toggle) + Unsupervised (placeholder). Uses all available features automatically
4. **Backtest** - Portfolio simulation with position sizing, commission, slippage, benchmark comparison
5. **Risk** - Risk metrics + Monte Carlo simulation
6. **Report** - Summary, assessment, CSV export

## Deployment

- **fly.io** with GitHub Actions auto-deploy on push to `main`
- Workflow: `.github/workflows/fly-deploy.yml`
- Requires `FLY_API_TOKEN` as GitHub Secret
- Region: `gru` (São Paulo), 1GB RAM, 2 shared CPUs, 2 Uvicorn workers
- Frontend on port 8080, API on port 8000

## Critical Guidelines

### DO NOT break the yfinance fix
`utils/yfinance_fix.py` is critical for data fetching. It uses `curl_cffi` with Chrome impersonation to bypass Yahoo Finance rate limiting. Never modify this without understanding the session/cookie handling.

### Ask before implementing new features
Discuss the approach before writing code for new functionality. Don't assume an implementation path.

### Handle errors with proper HTTP responses
In FastAPI endpoints, catch exceptions and return meaningful error responses with appropriate status codes.

### Be careful with these fragile areas
1. **Indicator calculations** - Math must match standard technical analysis definitions exactly.
2. **yfinance_fix session** - All `yf.download` and `yf.Ticker` calls must use `session=yfinance_fix.chrome_session`.
3. **Look-ahead bias** - All strategy signals must be shifted by 1 bar (`signals.shift(1)`). ML models use temporal train/test splits with boundary gap (no shuffling).
4. **Quant features** - `add_quant_features()` in `features.py` must stay in sync with what the research notebooks compute. The 6 quant features: momentum_21d, momentum_252_21d, vol_ratio, autocorr_20, illiquidity, HV_20.

## Code Style

- **Language**: Use English for all new code and comments
- **Comments**: Minimal - code should be self-documenting
- **Backend**: Use pandas for all data operations, Pydantic for request/response models
- **Frontend**: TypeScript, functional React components, Zustand for state
- **Testing**: No formal test suite; manual testing via UI
