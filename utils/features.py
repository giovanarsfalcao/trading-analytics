import numpy as np
import pandas as pd
from ta.trend import SMAIndicator, EMAIndicator, MACD
from ta.momentum import RSIIndicator, StochRSIIndicator, StochasticOscillator
from ta.volatility import BollingerBands, AverageTrueRange
from ta.volume import MFIIndicator
from utils.risk import bars_per_year


def add_sma(df: pd.DataFrame, period: int = 20) -> pd.DataFrame:
    df[f"SMA_{period}"] = SMAIndicator(df["Close"], window=period).sma_indicator()
    return df


def add_ema(df: pd.DataFrame, period: int = 12) -> pd.DataFrame:
    df[f"EMA_{period}"] = EMAIndicator(df["Close"], window=period).ema_indicator()
    return df


def add_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    df["RSI"] = RSIIndicator(df["Close"], window=period).rsi()
    return df


def add_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    macd = MACD(df["Close"], window_slow=slow, window_fast=fast, window_sign=signal)
    df["MACD"] = macd.macd()
    df["MACD_Signal"] = macd.macd_signal()
    df["MACD_HIST"] = macd.macd_diff()
    return df


def add_bollinger_bands(df: pd.DataFrame, period: int = 20, std: float = 2.0) -> pd.DataFrame:
    bb = BollingerBands(df["Close"], window=period, window_dev=std)
    df["BB_Upper"] = bb.bollinger_hband()
    df["BB_Middle"] = bb.bollinger_mavg()
    df["BB_Lower"] = bb.bollinger_lband()
    df["BB_Bandwidth"] = bb.bollinger_wband()
    df["BB_Percent"] = bb.bollinger_pband()
    return df


def add_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    df["ATR"] = AverageTrueRange(df["High"], df["Low"], df["Close"], window=period).average_true_range()
    return df


def add_stochastic(df: pd.DataFrame, k: int = 14, d: int = 3) -> pd.DataFrame:
    stoch = StochasticOscillator(df["High"], df["Low"], df["Close"], window=k, smooth_window=d)
    df["STOCH_K"] = stoch.stoch()
    df["STOCH_D"] = stoch.stoch_signal()
    return df


def add_mfi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    df["MFI"] = MFIIndicator(df["High"], df["Low"], df["Close"], df["Volume"], window=period).money_flow_index()
    return df


def add_vwap(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Rolling VWAP: sum(typical_price * volume) / sum(volume) over period."""
    typical = (df["High"] + df["Low"] + df["Close"]) / 3
    df[f"VWAP_{period}"] = (
        (typical * df["Volume"]).rolling(period).sum()
        / df["Volume"].rolling(period).sum()
    )
    return df


def add_market_stats(df: pd.DataFrame, volume_window: int = 20, hv_window: int = 20, interval: str = "1d") -> pd.DataFrame:
    """Volume Ratio and 20-bar annualized Historical Volatility."""
    vol_ma = df["Volume"].rolling(volume_window).mean()
    df["Volume_Ratio"] = df["Volume"] / vol_ma

    log_returns = np.log(df["Close"] / df["Close"].shift(1))
    df["HV_20"] = log_returns.rolling(hv_window).std() * np.sqrt(bars_per_year(interval))
    return df


def calculate_all_indicators(
    df: pd.DataFrame,
    rsi_period: int = 14,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    bb_period: int = 20,
    bb_std: float = 2.0,
    sma_fast: int = 20,
    sma_medium: int = 50,
    sma_slow: int = 200,
    interval: str = "1d",
) -> pd.DataFrame:
    """Add all standard indicators. Returns a copy with indicator columns."""
    result = df.copy()
    result = add_sma(result, sma_fast)
    result = add_sma(result, sma_medium)
    result = add_sma(result, sma_slow)
    result = add_ema(result, macd_fast)
    result = add_ema(result, macd_slow)
    result = add_rsi(result, rsi_period)
    result = add_macd(result, macd_fast, macd_slow, macd_signal)
    result = add_bollinger_bands(result, bb_period, bb_std)
    result = add_atr(result)
    result = add_stochastic(result)
    result = add_mfi(result)
    result = add_vwap(result)
    result = add_market_stats(result, interval=interval)
    return result
