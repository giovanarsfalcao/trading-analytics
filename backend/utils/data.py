import time
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf
from utils import yfinance_fix
from utils import cache

# ============================================================
# Price data (yfinance OHLCV) — backed by SQLite, gap-fetched
# ============================================================

GAP_REFRESH_TTL = 3600  # 1 hour — minimum time between yfinance polls for a given ticker


def _period_to_days(period: str) -> int:
    """Approximate days for a yfinance period string."""
    p = period.lower().strip()
    if p == "max":
        return 365 * 50
    if p == "ytd":
        now = datetime.now()
        return (now - datetime(now.year, 1, 1)).days
    if p.endswith("mo"):
        return int(p[:-2]) * 30
    if p.endswith("y"):
        return int(p[:-1]) * 365
    if p.endswith("d"):
        return int(p[:-1])
    return 365 * 2  # safe default


def _yf_download(ticker: str, interval: str, **kwargs) -> pd.DataFrame:
    """yfinance wrapper: cleans columns/index, returns empty df on failure."""
    try:
        df = yf.download(
            ticker,
            interval=interval,
            session=yfinance_fix.chrome_session,
            progress=False,
            **kwargs,
        )
    except Exception as e:
        raise ValueError(f"Failed to download data for '{ticker}': {e}") from e

    if df.empty:
        return df

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    if hasattr(df.index, "tz") and df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df = df.sort_index()
    df = df[~df.index.duplicated(keep="first")]
    return df


def fetch_price_data(ticker: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """
    Fetch OHLCV data with persistent SQLite caching + gap-filling.

    Strategy:
    1. If cache has insufficient history → full fetch from yfinance.
    2. Else if we polled yfinance < 1h ago → return from cache (no network call).
    3. Else → fetch only the gap (last cached bar → today) and append.
    Final read always comes from SQLite to guarantee a consistent shape.
    """
    ticker = ticker.upper()
    now = datetime.now()
    requested_start = now - timedelta(days=_period_to_days(period))

    first_cached = cache.get_first_cached_date(ticker, interval)
    last_cached = cache.get_last_cached_date(ticker, interval)
    last_fetched_at = cache.get_last_fetched_at(ticker, interval)

    # 7-day buffer: requesting "2y" but having "2y minus a few days" is still a hit.
    have_enough_history = (
        first_cached is not None
        and first_cached <= pd.Timestamp(requested_start) + pd.Timedelta(days=7)
    )

    if not have_enough_history:
        # Cold cache or insufficient history — full fetch
        df_full = _yf_download(ticker, interval, period=period)
        if df_full.empty:
            raise ValueError(
                f"No data found for '{ticker}' with period '{period}'. "
                "Check the ticker symbol and try again."
            )
        cache.upsert_ohlcv(df_full, ticker, interval)
        cache.update_fetched_at(ticker, interval)

    elif last_fetched_at is None or (int(time.time()) - last_fetched_at) >= GAP_REFRESH_TTL:
        # Cache covers the range but we haven't polled recently — fetch gap
        gap_start = (last_cached + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        gap_end = (now + timedelta(days=1)).strftime("%Y-%m-%d")  # yfinance end is exclusive
        if gap_start < gap_end:
            df_gap = _yf_download(ticker, interval, start=gap_start, end=gap_end)
            if not df_gap.empty:
                cache.upsert_ohlcv(df_gap, ticker, interval)
        cache.update_fetched_at(ticker, interval)

    # Else: cache is fresh, no network call needed.

    # Always read the requested window from SQLite for a consistent shape.
    start_str = requested_start.strftime("%Y-%m-%dT%H:%M:%S")
    df_out = cache.get_ohlcv_range(ticker, interval, start_date=start_str)

    if df_out.empty:
        raise ValueError(
            f"No data found for '{ticker}' with period '{period}'. "
            "Check the ticker symbol and try again."
        )

    return df_out


def fetch_benchmark_data(ticker: str = "^GSPC", period: str = "2y") -> pd.DataFrame:
    """Fetch benchmark data. Returns empty DataFrame if unavailable."""
    try:
        return fetch_price_data(ticker, period=period)
    except ValueError:
        return pd.DataFrame()


# ============================================================
# Fundamentals — SQLite-backed, 24h TTL
# ============================================================

_FUNDAMENTALS_TTL = 86400  # 24h


def fetch_fundamentals(ticker: str) -> dict:
    """Fetch fundamental data for a ticker. Returns empty dict on failure."""
    cached = cache.get_fundamentals(ticker, ttl_seconds=_FUNDAMENTALS_TTL)
    if cached is not None:
        return cached

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

    cache.set_fundamentals(ticker, result)

    # Return without raw_info (matches what the cache will return on subsequent hits)
    return {k: v for k, v in result.items() if k != "raw_info"}
