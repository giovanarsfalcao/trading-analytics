"""
Trading Analytics API — thin wrapper around utils/.
All routes in one file. No separate schemas/routers.
"""

import sys
import os
from contextlib import asynccontextmanager
from io import StringIO
import csv

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator, model_validator

# Ensure utils/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Pydantic Models ──────────────────────────────────────────────


class ExploreRequest(BaseModel):
    ticker: str
    period: str = "2y"
    rsi_period: int = 14
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    bb_period: int = 20
    bb_std: float = 2.0
    sma_fast: int = 20
    sma_medium: int = 50
    sma_slow: int = 200


class _StrategyBase(BaseModel):
    """Shared fields and validators for strategy + backtest requests."""
    ticker: str
    period: str = "2y"
    strategy_name: str
    params: dict = Field(default_factory=dict)
    model_type: str | None = None
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

    @model_validator(mode="after")
    def validate_strategy_params(self) -> "_StrategyBase":
        p = self.params
        name = self.strategy_name

        if name == "SMA Crossover" and p:
            fast = p.get("fast_period", 20)
            slow = p.get("slow_period", 50)
            if fast >= slow:
                raise ValueError(
                    f"SMA fast_period ({fast}) must be less than slow_period ({slow})"
                )

        if name == "MACD Signal Crossover" and p:
            fast = p.get("fast", 12)
            slow = p.get("slow", 26)
            if fast >= slow:
                raise ValueError(
                    f"MACD fast ({fast}) must be less than slow ({slow})"
                )

        return self


class StrategyRequest(_StrategyBase):
    pass


class BacktestRequest(_StrategyBase):
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


class MonteCarloRequest(BaseModel):
    daily_returns: list[float]
    initial_capital: float = 10000
    n_simulations: int = 1000
    n_days: int = 252
    method: str = "gbm"


class WalkForwardRequest(BaseModel):
    ticker: str
    period: str = "2y"
    model_type: str = "Random Forest"
    features: list[str] = Field(default_factory=lambda: ["RSI", "MACD_HIST", "MFI", "BB_Percent", "STOCH_K"])
    train_window: int = 504
    step: int = 63
    threshold: float = 0.55
    target_shift: int = 1


class ParamSweepRequest(BaseModel):
    ticker: str
    period: str = "2y"
    strategy_name: str
    param_name: str
    param_values: list[float]
    base_params: dict = Field(default_factory=dict)
    initial_capital: float = 10000
    commission: float = 0.001


class ExportRequest(BaseModel):
    data: list[dict]
    filename: str = "export.csv"


# ── App Setup ────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    from utils import yfinance_fix  # noqa: F401 — triggers patch + session creation
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
    return [
        {
            "date": idx.isoformat(),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": float(row["Volume"]),
        }
        for idx, row in df.iterrows()
    ]


def _serialize_indicators(df_ind: pd.DataFrame, ohlcv_cols: list[str]) -> dict:
    indicator_cols = [c for c in df_ind.columns if c not in ohlcv_cols]
    result = {}
    for col in indicator_cols:
        series = df_ind[col].dropna()
        result[col] = [
            {"date": idx.isoformat(), "value": float(v)}
            for idx, v in series.items()
        ]
    return result


def _fetch_and_prepare(ticker: str, period: str):
    from utils.data_fetcher import fetch_price_data
    from utils.indicators import calculate_all_indicators

    try:
        df = fetch_price_data(ticker, period=period)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    df_ind = calculate_all_indicators(df)
    return df, df_ind


def _generate_signals(df_ind: pd.DataFrame, req):
    from utils.strategies import STRATEGY_REGISTRY, ml_strategy

    if req.model_type:
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

    if req.strategy_name not in STRATEGY_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy_name}")
    strategy_fn = STRATEGY_REGISTRY[req.strategy_name]["fn"]
    signals = strategy_fn(df_ind, **req.params)
    return signals, None


def _signal_summary(signals: pd.Series) -> dict:
    return {
        "buy_count": int((signals == 1).sum()),
        "sell_count": int((signals == -1).sum()),
        "hold_count": int((signals == 0).sum()),
        "total": len(signals),
    }


def _serialize_signals(signals: pd.Series, close: pd.Series) -> list[dict]:
    return [
        {"date": idx.isoformat(), "signal": int(sig), "price": float(close.loc[idx])}
        for idx, sig in signals.items()
        if idx in close.index
    ]


# ── Routes ───────────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/strategies")
async def get_strategies():
    from utils.strategies import STRATEGY_REGISTRY
    result = {}
    for name, info in STRATEGY_REGISTRY.items():
        result[name] = {
            k: {f: v for f, v in spec.items() if f != "fn"}
            for k, spec in info["params"].items()
        }
    return result


@app.post("/api/explore")
async def explore(req: ExploreRequest):
    from utils.data_fetcher import fetch_price_data
    from utils.indicators import calculate_all_indicators
    from utils.fundamentals import fetch_fundamentals

    try:
        df = fetch_price_data(req.ticker, period=req.period)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    df_ind = calculate_all_indicators(
        df,
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


@app.post("/api/strategy")
async def strategy(req: StrategyRequest):
    df, df_ind = _fetch_and_prepare(req.ticker, req.period)

    try:
        signals, ml_metrics = _generate_signals(df_ind, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    strategy_name = f"ML: {req.model_type}" if req.model_type else req.strategy_name

    return {
        "ticker": req.ticker,
        "strategy_name": strategy_name,
        "signals": _serialize_signals(signals, df["Close"]),
        "signal_summary": _signal_summary(signals),
        "ml_metrics": ml_metrics,
    }


@app.post("/api/backtest")
async def backtest(req: BacktestRequest):
    from utils.data_fetcher import fetch_benchmark_data
    from utils.backtester import run_backtest

    df, df_ind = _fetch_and_prepare(req.ticker, req.period)

    try:
        if req.is_walk_forward and req.model_type:
            from utils.strategies import walk_forward_ml_strategy
            wf_result = walk_forward_ml_strategy(
                df_ind,
                features=req.features or ["RSI", "MACD_HIST", "MFI", "BB_Percent"],
                model_type=req.model_type,
                train_window=req.train_window,
                step=req.wf_step,
                threshold=req.threshold or 0.55,
                target_shift=req.target_shift or 1,
            )
            signals = wf_result["signals"]
        else:
            signals, _ = _generate_signals(df_ind, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    results = run_backtest(
        df, signals,
        initial_capital=req.initial_capital,
        position_size=req.position_size,
        position_pct=req.position_pct,
        commission=req.commission,
        risk_free_rate=req.risk_free_rate,
        slippage=req.slippage,
        spread=req.spread,
        kelly_fraction=req.kelly_fraction,
    )

    # Serialize portfolio
    portfolio = [
        {
            "date": idx.isoformat(),
            "value": float(val),
            "cumulative_return": float(results["cumulative_returns"].loc[idx]),
        }
        for idx, val in results["portfolio_value"].items()
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
                {"date": idx.isoformat(), "value": float(bench_aligned.loc[idx]), "cumulative_return": float(cr)}
                for idx, cr in bench_cum.items()
            ]

    strategy_name = f"ML: {req.model_type}" if req.model_type else req.strategy_name

    return {
        "ticker": req.ticker,
        "strategy_name": strategy_name,
        "initial_capital": req.initial_capital,
        "portfolio": portfolio,
        "trades": trades,
        "trade_stats": results["trade_stats"],
        "daily_returns": results["daily_returns"].tolist(),
        "benchmark_portfolio": benchmark_portfolio,
    }


@app.post("/api/risk")
async def risk(req: RiskRequest):
    from utils.risk_analysis import calculate_risk_metrics

    portfolio_returns = pd.Series(req.daily_returns, dtype=float)
    portfolio_prices = pd.Series(req.portfolio_values, dtype=float)
    benchmark_returns = (
        pd.Series(req.benchmark_returns, dtype=float)
        if req.benchmark_returns
        else pd.Series(dtype=float)
    )

    metrics = calculate_risk_metrics(
        portfolio_returns, benchmark_returns, portfolio_prices, req.risk_free_rate,
    )

    return metrics


@app.post("/api/monte-carlo")
async def monte_carlo(req: MonteCarloRequest):
    from utils.risk_analysis import monte_carlo_simulation

    returns = pd.Series(req.daily_returns, dtype=float)

    mc = monte_carlo_simulation(
        returns, req.initial_capital,
        n_simulations=req.n_simulations,
        n_days=req.n_days,
        method=req.method,
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
    }


@app.post("/api/walk-forward")
async def walk_forward(req: WalkForwardRequest):
    from utils.strategies import walk_forward_ml_strategy, ml_strategy

    df, df_ind = _fetch_and_prepare(req.ticker, req.period)

    try:
        result = walk_forward_ml_strategy(
            df_ind,
            features=req.features,
            model_type=req.model_type,
            train_window=req.train_window,
            step=req.step,
            threshold=req.threshold,
            target_shift=req.target_shift,
        )
    except ValueError as e:
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

    signals = result["signals"]
    serialized = _serialize_signals(signals, df["Close"])
    return {
        "signals": serialized,
        "base_signals": base_signals_serialized,
        "signal_summary": _signal_summary(signals),
        "fold_results": result["fold_results"],
        "n_folds": result["n_folds"],
        "strategy_name": f"Walk-Forward: {req.model_type}",
    }


@app.post("/api/param-sweep")
async def param_sweep(req: ParamSweepRequest):
    from utils.strategies import STRATEGY_REGISTRY
    from utils.backtester import run_backtest

    if req.strategy_name not in STRATEGY_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy_name}")

    df, df_ind = _fetch_and_prepare(req.ticker, req.period)
    strategy_fn = STRATEGY_REGISTRY[req.strategy_name]["fn"]

    # Convert float params to int where appropriate (JS sends all numbers as float)
    base = {k: int(v) if isinstance(v, float) and v == int(v) else v for k, v in req.base_params.items()}

    results = []
    for val in req.param_values:
        clean_val = int(val) if isinstance(val, float) and val == int(val) else val
        params = {**base, req.param_name: clean_val}
        try:
            signals = strategy_fn(df_ind, **params)
            bt = run_backtest(df, signals, initial_capital=req.initial_capital, commission=req.commission)
            stats = bt["trade_stats"]
            results.append({
                "param_value": val,
                "total_return": stats.get("total_return", 0),
                "sharpe_ratio": stats.get("sharpe_ratio", 0),
                "max_drawdown": stats.get("max_drawdown", 0),
                "win_rate": stats.get("win_rate", 0),
                "total_trades": stats.get("total_trades", 0),
            })
        except Exception as e:
            results.append({"param_value": val, "error": str(e)})

    return {"strategy_name": req.strategy_name, "param_name": req.param_name, "results": results}


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
