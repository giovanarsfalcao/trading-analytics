"""
Trading Analytics API — thin wrapper around utils/.
All routes in one file. No separate schemas/routers.
"""

import asyncio
import sys
import os
import threading
import time as _time
from contextlib import asynccontextmanager
from io import StringIO
import csv

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

# Ensure utils/ is importable from backend/
sys.path.insert(0, os.path.dirname(__file__))


# ── Pydantic Models ──────────────────────────────────────────────


class ExploreRequest(BaseModel):
    ticker: str
    period: str = "2y"
    interval: str = "1d"
    rsi_period: int = 14
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    bb_period: int = 20
    bb_std: float = 2.0
    sma_fast: int = 20
    sma_medium: int = 50
    sma_slow: int = 200


class _SignalsBase(BaseModel):
    """Shared fields and validators for signals + backtest requests."""
    ticker: str
    period: str = "2y"
    interval: str = "1d"
    model_type: str
    features: list[str] | None = None
    train_ratio: float = 0.8
    threshold: float = 0.55
    target_shift: int = 1
    fundamental_values: dict[str, float] | None = None

    @field_validator("train_ratio")
    @classmethod
    def validate_train_ratio(cls, v: float) -> float:
        if not 0.5 <= v <= 0.95:
            raise ValueError("train_ratio must be between 0.5 and 0.95")
        return v

    @field_validator("threshold")
    @classmethod
    def validate_threshold(cls, v: float) -> float:
        if not 0.5 <= v <= 0.9:
            raise ValueError("threshold must be between 0.5 and 0.9")
        return v

    @field_validator("target_shift")
    @classmethod
    def validate_target_shift(cls, v: int) -> int:
        if not 1 <= v <= 20:
            raise ValueError("target_shift must be between 1 and 20")
        return v


class SignalsRequest(_SignalsBase):
    pass


class BacktestRequest(_SignalsBase):
    initial_capital: float = 10000
    position_size: str = "fixed"
    position_pct: float = 1.0
    commission: float = 0.001
    risk_free_rate: float = 0.0
    slippage: float = 0.0
    spread: float = 0.0
    kelly_fraction: float = 0.5
    benchmark: str = "^GSPC"
    is_walk_forward: bool = False
    train_window: int = 252
    wf_step: int = 63

    @field_validator("initial_capital")
    @classmethod
    def validate_initial_capital(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("initial_capital must be positive")
        return v

    @field_validator("commission")
    @classmethod
    def validate_commission(cls, v: float) -> float:
        if not 0 <= v <= 0.05:
            raise ValueError("commission must be between 0% and 5%")
        return v

    @field_validator("position_pct")
    @classmethod
    def validate_position_pct(cls, v: float) -> float:
        if not 0.01 <= v <= 1.0:
            raise ValueError("position_pct must be between 1% and 100%")
        return v

    @field_validator("slippage", "spread")
    @classmethod
    def validate_market_impact(cls, v: float) -> float:
        if not 0 <= v <= 0.01:
            raise ValueError("slippage and spread must be between 0% and 1%")
        return v

    @field_validator("kelly_fraction")
    @classmethod
    def validate_kelly_fraction(cls, v: float) -> float:
        if not 0.1 <= v <= 1.0:
            raise ValueError("kelly_fraction must be between 0.1 and 1.0")
        return v


class RiskRequest(BaseModel):
    daily_returns: list[float]
    portfolio_values: list[float]
    portfolio_dates: list[str]
    benchmark_returns: list[float] = Field(default_factory=list)
    risk_free_rate: float = 0.05
    interval: str = "1d"


class MonteCarloRequest(BaseModel):
    daily_returns: list[float]
    initial_capital: float = 10000
    n_simulations: int = 1000
    n_days: int = 252
    method: str = "gbm"
    interval: str = "1d"


class WalkForwardRequest(BaseModel):
    ticker: str
    period: str = "2y"
    interval: str = "1d"
    model_type: str = "Random Forest"
    features: list[str] = Field(default_factory=lambda: ["RSI", "MACD_HIST", "MFI", "BB_Percent", "STOCH_K"])
    train_window: int = 504
    step: int = 63
    threshold: float = 0.55
    target_shift: int = 1


class ExportRequest(BaseModel):
    data: list[dict]
    filename: str = "export.csv"


# ── App Setup ────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    from utils import yfinance_fix  # noqa: F401 — triggers patch + session creation
    from utils import cache
    cache.ensure_schema()
    yield


app = FastAPI(title="Trading Analytics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ──────────────────────────────────────────────────────


def _serialize_ohlcv(df: pd.DataFrame) -> list[dict]:
    out = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    out["date"] = out.index.strftime("%Y-%m-%dT%H:%M:%S")
    out = out.rename(columns={"Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"})
    return out[["date", "open", "high", "low", "close", "volume"]].to_dict(orient="records")


def _serialize_indicators(df_ind: pd.DataFrame, ohlcv_cols: list[str]) -> dict:
    indicator_cols = [c for c in df_ind.columns if c not in ohlcv_cols]
    result = {}
    for col in indicator_cols:
        series = df_ind[col].dropna()
        dates = series.index.strftime("%Y-%m-%dT%H:%M:%S")
        values = series.values.tolist()
        result[col] = [
            {"date": d, "value": v} for d, v in zip(dates, values)
        ]
    return result


# Keyed by (ticker, period, interval, sorted-indicator-params-tuple).
# Params are always merged with defaults before hashing so that a call with
# explicit defaults and a call with no kwargs produce the same cache key.
# df is NOT cached — SQLite reads are fast enough.
_indicator_cache: dict[tuple, tuple[pd.DataFrame, float]] = {}
_indicator_lock = threading.Lock()
_INDICATOR_TTL = 3600  # 1 hour

_INDICATOR_DEFAULTS = {
    "rsi_period": 14, "macd_fast": 12, "macd_slow": 26, "macd_signal": 9,
    "bb_period": 20, "bb_std": 2.0, "sma_fast": 20, "sma_medium": 50, "sma_slow": 200,
}


def _get_or_compute_indicators(
    df: pd.DataFrame, ticker: str, period: str, interval: str, **params
) -> pd.DataFrame:
    from utils.features import calculate_all_indicators

    full_params = {**_INDICATOR_DEFAULTS, **params}
    cache_key = (ticker.upper(), period, interval, tuple(sorted(full_params.items())))
    with _indicator_lock:
        hit = _indicator_cache.get(cache_key)
        if hit and _time.time() - hit[1] < _INDICATOR_TTL:
            return hit[0]
    df_ind = calculate_all_indicators(df, interval=interval, **full_params)
    with _indicator_lock:
        _indicator_cache[cache_key] = (df_ind, _time.time())
    return df_ind


def _fetch_and_prepare(ticker: str, period: str, interval: str = "1d"):
    from utils.data import fetch_price_data

    try:
        df = fetch_price_data(ticker, period=period, interval=interval)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    df_ind = _get_or_compute_indicators(df, ticker, period, interval)
    return df, df_ind


def _generate_signals(df_ind: pd.DataFrame, req):
    from utils.signals import ml_strategy

    features = req.features or ["RSI", "MACD_HIST", "MFI", "BB_Percent", "STOCH_K"]
    result = ml_strategy(
        df_ind,
        features=features,
        model_type=req.model_type,
        train_ratio=req.train_ratio,
        threshold=req.threshold,
        target_shift=req.target_shift,
        fundamental_values=req.fundamental_values or None,
    )
    signals = result["signals"]
    ml_metrics = {
        "accuracy": result["accuracy"],
        "precision": result["precision"],
        "recall": result["recall"],
        "f1": result["f1"],
        "roc_auc": result["roc_auc"],
        "train_size": result["train_size"],
        "test_size": result["test_size"],
        "feature_importance": result["feature_importance"],
        "confusion_matrix": result["confusion_matrix"].tolist(),
    }
    return signals, ml_metrics


def _signal_summary(signals: pd.Series) -> dict:
    return {
        "buy_count": int((signals == 1).sum()),
        "sell_count": int((signals == -1).sum()),
        "hold_count": int((signals == 0).sum()),
        "total": len(signals),
    }


def _serialize_signals(signals: pd.Series, close: pd.Series) -> list[dict]:
    common = signals.index.intersection(close.index)
    dates = common.strftime("%Y-%m-%dT%H:%M:%S")
    sigs = signals.loc[common].values
    prices = close.loc[common].values
    return [
        {"date": d, "signal": int(s), "price": float(p)}
        for d, s, p in zip(dates, sigs, prices)
    ]


# ── Routes ───────────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/search")
async def search_tickers(q: str = "", limit: int = 8):
    if len(q.strip()) < 1:
        return {"results": []}

    def _search():
        from utils import yfinance_fix
        resp = yfinance_fix.chrome_session.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": q.strip(), "quotesCount": limit, "newsCount": 0, "listsCount": 0},
        )
        data = resp.json()
        return [
            {
                "symbol": item.get("symbol", ""),
                "name": item.get("shortname", item.get("longname", "")),
                "exchange": item.get("exchange", ""),
                "type": item.get("quoteType", ""),
            }
            for item in data.get("quotes", [])
        ]

    try:
        results = await asyncio.to_thread(_search)
        return {"results": results}
    except Exception:
        return {"results": []}


@app.post("/api/explore")
async def explore(req: ExploreRequest):
    from utils.data import fetch_price_data, fetch_fundamentals

    def _explore():
        try:
            df = fetch_price_data(req.ticker, period=req.period, interval=req.interval)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        df_ind = _get_or_compute_indicators(
            df, req.ticker, req.period, req.interval,
            rsi_period=req.rsi_period,
            macd_fast=req.macd_fast,
            macd_slow=req.macd_slow,
            macd_signal=req.macd_signal,
            bb_period=req.bb_period,
            bb_std=req.bb_std,
            sma_fast=req.sma_fast,
            sma_medium=req.sma_medium,
            sma_slow=req.sma_slow,
        )
        ohlcv_cols = ["Open", "High", "Low", "Close", "Volume"]

        fundamentals = fetch_fundamentals(req.ticker)
        if "raw_info" in fundamentals:
            del fundamentals["raw_info"]

        return {
            "ticker": req.ticker,
            "data_points": len(df),
            "date_range": [df.index[0].isoformat(), df.index[-1].isoformat()],
            "ohlcv": _serialize_ohlcv(df),
            "indicators": _serialize_indicators(df_ind, ohlcv_cols),
            "fundamentals": fundamentals or None,
        }

    return await asyncio.to_thread(_explore)


@app.post("/api/signals")
async def signals(req: SignalsRequest):
    def _run():
        df, df_ind = _fetch_and_prepare(req.ticker, req.period, req.interval)
        try:
            sig, ml_metrics = _generate_signals(df_ind, req)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {
            "ticker": req.ticker,
            "signal_name": f"ML: {req.model_type}",
            "signals": _serialize_signals(sig, df["Close"]),
            "signal_summary": _signal_summary(sig),
            "ml_metrics": ml_metrics,
        }

    return await asyncio.to_thread(_run)


@app.post("/api/backtest")
async def backtest(req: BacktestRequest):
    def _run():
        from utils.data import fetch_benchmark_data
        from utils.backtest import run_backtest

        df, df_ind = _fetch_and_prepare(req.ticker, req.period, req.interval)

        try:
            if req.is_walk_forward and req.model_type:
                from utils.signals import walk_forward_ml_strategy
                raw_features = req.features or ["RSI", "MACD_HIST", "MFI", "BB_Percent"]
                features = [f for f in raw_features if f in df_ind.columns] or ["RSI", "MACD_HIST", "MFI", "BB_Percent"]
                wf_result = walk_forward_ml_strategy(
                    df_ind,
                    features=features,
                    model_type=req.model_type,
                    train_window=req.train_window,
                    step=req.wf_step,
                    threshold=req.threshold or 0.55,
                    target_shift=req.target_shift or 1,
                )
                sigs = wf_result["signals"]
            else:
                sigs, _ = _generate_signals(df_ind, req)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        results = run_backtest(
            df, sigs,
            initial_capital=req.initial_capital,
            position_size=req.position_size,
            position_pct=req.position_pct,
            commission=req.commission,
            risk_free_rate=req.risk_free_rate,
            slippage=req.slippage,
            spread=req.spread,
            kelly_fraction=req.kelly_fraction,
            interval=req.interval,
        )

        # Serialize portfolio (vectorized)
        pv = results["portfolio_value"]
        cr = results["cumulative_returns"]
        portfolio = [
            {"date": d, "value": v, "cumulative_return": c}
            for d, v, c in zip(
                pv.index.strftime("%Y-%m-%dT%H:%M:%S"),
                pv.values.tolist(),
                cr.values.tolist(),
            )
        ]

        # Serialize trades
        trades = []
        for t in results["trades"]:
            trades.append({
                "entry_date": t["entry_date"].isoformat() if hasattr(t["entry_date"], "isoformat") else str(t["entry_date"]),
                "exit_date": t["exit_date"].isoformat() if hasattr(t["exit_date"], "isoformat") else str(t["exit_date"]),
                "direction": t["direction"],
                "entry_price": float(t["entry_price"]),
                "exit_price": float(t["exit_price"]),
                "shares": float(t["shares"]),
                "return_pct": float(t["return_pct"]),
                "holding_days": int(t["holding_days"]),
                "pnl": float(t["pnl"]),
                "commission_entry": float(t["commission_entry"]),
                "commission_exit": float(t["commission_exit"]),
            })

        # Benchmark
        benchmark_portfolio = None
        bench_df = fetch_benchmark_data(ticker=req.benchmark, period=req.period)
        if not bench_df.empty:
            bench_close = bench_df["Close"]
            mask = (bench_close.index >= df.index[0]) & (bench_close.index <= df.index[-1])
            bench_aligned = bench_close.loc[mask]
            if len(bench_aligned) > 0:
                bench_cum = (bench_aligned / bench_aligned.iloc[0]) - 1
                benchmark_portfolio = [
                    {"date": d, "value": float(v), "cumulative_return": float(c)}
                    for d, v, c in zip(
                        bench_cum.index.strftime("%Y-%m-%dT%H:%M:%S"),
                        bench_aligned.values.tolist(),
                        bench_cum.values.tolist(),
                    )
                ]

        return {
            "ticker": req.ticker,
            "signal_name": f"ML: {req.model_type}",
            "initial_capital": req.initial_capital,
            "portfolio": portfolio,
            "trades": trades,
            "trade_stats": results["trade_stats"],
            "daily_returns": results["daily_returns"].tolist(),
            "benchmark_portfolio": benchmark_portfolio,
        }

    return await asyncio.to_thread(_run)


@app.post("/api/risk")
async def risk(req: RiskRequest):
    def _run():
        from utils.risk import calculate_risk_metrics

        portfolio_returns = pd.Series(req.daily_returns, dtype=float)
        portfolio_prices = pd.Series(req.portfolio_values, dtype=float)
        benchmark_returns = (
            pd.Series(req.benchmark_returns, dtype=float)
            if req.benchmark_returns
            else pd.Series(dtype=float)
        )

        return calculate_risk_metrics(
            portfolio_returns, benchmark_returns, portfolio_prices, req.risk_free_rate, req.interval,
        )

    return await asyncio.to_thread(_run)


@app.post("/api/monte-carlo")
async def monte_carlo(req: MonteCarloRequest):
    def _run():
        from utils.risk import monte_carlo_simulation

        returns = pd.Series(req.daily_returns, dtype=float)

        mc = monte_carlo_simulation(
            returns, req.initial_capital,
            n_simulations=req.n_simulations,
            n_days=req.n_days,
            method=req.method,
            interval=req.interval,
        )

        # Downsample final values for histogram (max 500)
        final_vals = mc["final_values"].tolist()
        if len(final_vals) > 500:
            rng = np.random.default_rng(42)
            final_vals = rng.choice(mc["final_values"], size=500, replace=False).tolist()

        percentiles = [
            {"level": float(level), "values": [float(v) for v in values]}
            for level, values in mc["percentiles"].items()
        ]

        return {
            "percentiles": percentiles,
            "median_path": [float(v) for v in mc["median_path"]],
            "probability_of_loss": mc["probability_of_loss"],
            "expected_value": mc["expected_value"],
            "median_value": mc["median_value"],
            "best_case": mc["best_case"],
            "worst_case": mc["worst_case"],
            "final_values_histogram": [float(v) for v in final_vals],
            "max_drawdown_distribution": mc["max_drawdown_distribution"],
        }

    return await asyncio.to_thread(_run)


@app.post("/api/walk-forward")
async def walk_forward(req: WalkForwardRequest):
    def _run():
        from utils.signals import walk_forward_ml_strategy, ml_strategy

        df, df_ind = _fetch_and_prepare(req.ticker, req.period, req.interval)

        try:
            features = [f for f in req.features if f in df_ind.columns] or ["RSI", "MACD_HIST", "MFI", "BB_Percent"]
            result = walk_forward_ml_strategy(
                df_ind,
                features=features,
                model_type=req.model_type,
                train_window=req.train_window,
                step=req.step,
                threshold=req.threshold,
                target_shift=req.target_shift,
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Base model: single train/test split (80/20) for comparison with WFA
        base_signals_serialized = []
        try:
            base_result = ml_strategy(
                df_ind,
                features=req.features,
                model_type=req.model_type,
                train_ratio=0.8,
                threshold=req.threshold,
                target_shift=req.target_shift,
            )
            base_signals_serialized = _serialize_signals(base_result["signals"], df["Close"])
        except Exception:
            pass

        sigs = result["signals"]
        serialized = _serialize_signals(sigs, df["Close"])
        return {
            "signals": serialized,
            "base_signals": base_signals_serialized,
            "signal_summary": _signal_summary(sigs),
            "fold_results": result["fold_results"],
            "n_folds": result["n_folds"],
            "signal_name": f"Walk-Forward: {req.model_type}",
        }

    return await asyncio.to_thread(_run)


@app.post("/api/export")
async def export_csv(req: ExportRequest):
    if not req.data:
        return StreamingResponse(StringIO(""), media_type="text/csv")

    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=req.data[0].keys())
    writer.writeheader()
    writer.writerows(req.data)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={req.filename}"},
    )
