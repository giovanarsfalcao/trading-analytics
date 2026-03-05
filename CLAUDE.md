# CLAUDE.md - Trading Analytics Platform Guidelines

## Project Overview

Trading Analytics is a quantitative research platform with a 5-stage workflow: Explore → Strategy → Backtest → Risk Analysis → Report. Built with Next.js 16 (frontend) + FastAPI (backend) + shared Python utils for financial calculations.

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
│   ├── src/components/         # React components by feature (explore/, strategy/, backtest/, risk/, report/)
│   ├── src/stores/store.ts     # Zustand state management (5-stage workflow)
│   ├── src/types/index.ts      # TypeScript type definitions
│   ├── next.config.ts          # Standalone output + /api/* rewrite to backend
│   └── package.json
├── api/
│   ├── main.py                 # FastAPI app with all routes
│   └── requirements.txt        # Python dependencies
├── utils/                      # Shared Python modules (used by API)
│   ├── yfinance_fix.py         # Chrome session singleton for Yahoo Finance
│   ├── data_fetcher.py         # yfinance data fetching with caching
│   ├── indicators.py           # Technical indicators via 'ta' library
│   ├── fundamentals.py         # Fundamental data via yfinance
│   ├── strategies.py           # 4 rule-based + 3 ML strategies
│   ├── backtester.py           # Backtest engine with position sizing
│   └── risk_analysis.py        # Risk metrics + Monte Carlo simulation
├── notebooks/                  # Research & development notebooks
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
| GET | `/api/strategies` | List available strategies |
| POST | `/api/explore` | Fetch OHLCV, indicators, fundamentals |
| POST | `/api/strategy` | Generate trading signals |
| POST | `/api/backtest` | Run backtest simulation |
| POST | `/api/risk` | Calculate risk metrics |
| POST | `/api/monte-carlo` | Run Monte Carlo simulation |
| POST | `/api/export` | Export data as CSV |

## Key Modules

- **utils/yfinance_fix.py** - Rate limiting workaround using curl_cffi to impersonate Chrome
- **utils/indicators.py** - SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Stochastic, MFI via `ta` library
- **utils/strategies.py** - SMA Crossover, RSI, MACD Crossover, Bollinger Breakout + Random Forest, Gradient Boosting, Logistic Regression
- **utils/backtester.py** - Trade-by-trade engine with fixed/percentage/Kelly position sizing and commission
- **utils/risk_analysis.py** - Sharpe, Sortino, VaR, CVaR, Beta, Alpha, Calmar, Information Ratio + Monte Carlo

## Deployment

- **fly.io** with GitHub Actions auto-deploy on push to `main`
- Workflow: `.github/workflows/fly-deploy.yml`
- Requires `FLY_API_TOKEN` as GitHub Secret
- Region: `gru` (São Paulo), 1GB RAM, shared CPU
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
3. **Look-ahead bias** - All strategy signals must be shifted by 1 bar. ML models use temporal train/test splits (no shuffling).

## Code Style

- **Language**: Use English for all new code and comments
- **Comments**: Minimal - code should be self-documenting
- **Backend**: Use pandas for all data operations, Pydantic for request/response models
- **Frontend**: TypeScript, functional React components, Zustand for state
- **Testing**: No formal test suite; manual testing via UI
