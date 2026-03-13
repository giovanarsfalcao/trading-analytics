import time

import pandas as pd
import yfinance as yf
from utils import yfinance_fix

# TTL-based in-memory cache: key → (DataFrame, timestamp)
_price_cache: dict[tuple, tuple[pd.DataFrame, float]] = {}
_CACHE_TTL = 3600  # 1 hour


def fetch_price_data(ticker: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """
    Download OHLCV data with TTL caching.
    Raises ValueError with a descriptive message on failure.
    """
    key = (ticker.upper(), period, interval)
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

    _price_cache[key] = (df, time.time())
    return df


def fetch_benchmark_data(ticker: str = "^GSPC", period: str = "2y") -> pd.DataFrame:
    """Fetch benchmark data. Returns empty DataFrame if unavailable."""
    try:
        return fetch_price_data(ticker, period=period)
    except ValueError:
        return pd.DataFrame()
