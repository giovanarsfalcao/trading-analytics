"""
Technical Analysis - Chart-based Indicators: MACD, RSI, MFI, Bollinger Bands
"""

import streamlit as st
import yfinance as yf
import yfinance_fix

from tradbot.strategy import TechnicalIndicators
from components.charts import indicator_subplot


st.header("Technical Analysis")
st.caption("Chart-based momentum and trend indicators — identify patterns, overbought/oversold zones, and volatility breakouts.")

# --- Sidebar ---
with st.sidebar:
    st.subheader("Data Settings")
    ticker = st.text_input("Ticker", value="SPY", placeholder="e.g. AAPL, SPY, MSFT", key="ta_ticker")
    interval = st.selectbox("Interval", ["1d", "1h", "15m", "5m"], index=0, key="ta_interval")
    lookback = st.number_input("Lookback (rows)", value=5000, step=100, key="ta_lookback")

    st.divider()
    st.subheader("Indicator Parameters")

    with st.expander("MACD"):
        macd_fast = st.number_input("Fast", 12, key="ta_macd_fast")
        macd_slow = st.number_input("Slow", 27, key="ta_macd_slow")
        macd_span = st.number_input("Signal", 9, key="ta_macd_span")

    with st.expander("RSI"):
        rsi_length = st.number_input("RSI Length", 14, key="ta_rsi_len")

    with st.expander("MFI"):
        mfi_length = st.number_input("MFI Length", 14, key="ta_mfi_len")

    with st.expander("Bollinger Bands"):
        bb_length = st.number_input("BB Length", 20, key="ta_bb_len")
        bb_std = st.number_input("Std Dev", 2, key="ta_bb_std")


# --- Load Data ---
@st.cache_data(ttl=300)
def load_data(symbol, interval, lookback):
    period = "730d" if interval == "1h" else "max"
    df = yf.download(symbol, session=yfinance_fix.chrome_session,
                     interval=interval, period=period, progress=False)
    if df.empty:
        return None
    df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    return df.iloc[-lookback:, :].copy()


with st.spinner("Loading data..."):
    df_raw = load_data(ticker, interval, lookback)

if df_raw is None:
    st.error(f"Could not load data for {ticker}")
    st.stop()

# --- Compute Indicators ---
ti = TechnicalIndicators(df_raw)
ti.add_macd(macd_fast, macd_slow, macd_span)
ti.add_mfi(mfi_length)
ti.add_bb(bb_length, bb_std)
ti.add_rsi(rsi_length)
df = ti.dropna().get_df()

st.success(f"{len(df)} data points loaded for {ticker}")

# --- Charts ---
for ind in ["MACD", "RSI", "MFI", "BB"]:
    try:
        fig = indicator_subplot(df, ind)
        st.plotly_chart(fig, use_container_width=True)
    except Exception as e:
        st.warning(f"Could not render {ind}: {e}")
