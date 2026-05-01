import threading
import time

import pandas as pd
import yfinance as yf
from utils import yfinance_fix

# ============================================================
# Price data (yfinance OHLCV)
# ============================================================

# TTL-based in-memory cache: key → (DataFrame, timestamp)
_price_cache: dict[tuple, tuple[pd.DataFrame, float]] = {}
_price_lock = threading.Lock()
_CACHE_TTL = 3600  # 1 hour


def fetch_price_data(ticker: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """
    Download OHLCV data with TTL caching.
    Raises ValueError with a descriptive message on failure.
    """
    key = (ticker.upper(), period, interval)
    with _price_lock:
        if key in _price_cache:
            df, ts = _price_cache[key]
            if time.time() - ts < _CACHE_TTL:
                return df

    try:
        df = yf.download(
            ticker,
            period=period,
            interval=interval,
            session=yfinance_fix.chrome_session,
            progress=False,
        )
    except Exception as e:
        raise ValueError(f"Failed to download data for '{ticker}': {e}") from e

    if df.empty:
        raise ValueError(
            f"No data found for '{ticker}' with period '{period}'. "
            "Check the ticker symbol and try again."
        )

    # Flatten multi-level columns from yfinance
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Remove timezone info and deduplicate/sort index (can occur with DST transitions in intraday data)
    if hasattr(df.index, "tz") and df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df = df.sort_index()
    df = df[~df.index.duplicated(keep="first")]

    with _price_lock:
        _price_cache[key] = (df, time.time())
    return df


def fetch_benchmark_data(ticker: str = "^GSPC", period: str = "2y") -> pd.DataFrame:
    """Fetch benchmark data. Returns empty DataFrame if unavailable."""
    try:
        return fetch_price_data(ticker, period=period)
    except ValueError:
        return pd.DataFrame()


# ============================================================
# Fundamentals (yfinance ticker info)
# ============================================================

_fundamentals_cache: dict[str, tuple[dict, float]] = {}
_fundamentals_lock = threading.Lock()
_FUNDAMENTALS_TTL = 86400  # 24h — fundamentals change rarely


def fetch_fundamentals(ticker: str) -> dict:
    """Fetch fundamental data for a ticker. Returns empty dict on failure."""
    key = ticker.upper()
    with _fundamentals_lock:
        if key in _fundamentals_cache:
            data, ts = _fundamentals_cache[key]
            if time.time() - ts < _FUNDAMENTALS_TTL:
                return data

    try:
        t = yf.Ticker(ticker, session=yfinance_fix.chrome_session)
        info = t.info
    except Exception:
        return {}

    if not info:
        return {}

    result = {
        "name": info.get("longName", ticker),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "pe": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "market_cap": info.get("marketCap"),
        "revenue": info.get("totalRevenue"),
        "eps": info.get("trailingEps"),
        "dividend_yield": info.get("dividendYield"),
        "high_52w": info.get("fiftyTwoWeekHigh"),
        "low_52w": info.get("fiftyTwoWeekLow"),
        "beta": info.get("beta"),
        "profit_margin": info.get("profitMargins"),
        "roe": info.get("returnOnEquity"),
        "roa": info.get("returnOnAssets"),
        "debt_to_equity": info.get("debtToEquity"),
        "revenue_growth": info.get("revenueGrowth"),
        "gross_margins": info.get("grossMargins"),
        "current_ratio": info.get("currentRatio"),
        "price_to_book": info.get("priceToBook"),
        "ev_to_ebitda": info.get("enterpriseToEbitda"),
        "raw_info": info,
    }

    with _fundamentals_lock:
        _fundamentals_cache[key] = (result, time.time())

    return result
