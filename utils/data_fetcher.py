import pandas as pd
import yfinance as yf
from utils import yfinance_fix


def fetch_price_data(ticker: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """Download OHLCV data. Returns empty DataFrame on failure."""
    try:
        df = yf.download(
            ticker,
            period=period,
            interval=interval,
            session=yfinance_fix.chrome_session,
            progress=False,
        )
    except Exception:
        return pd.DataFrame()

    if df.empty:
        return pd.DataFrame()

    # Flatten multi-level columns from yfinance
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    return df


def fetch_benchmark_data(period: str = "2y") -> pd.DataFrame:
    """Fetch S&P 500 data for benchmark comparison."""
    return fetch_price_data("^GSPC", period=period)
