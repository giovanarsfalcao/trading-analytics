"""
Stock Rating - Algorithmic scoring across technical, fundamental, and ML dimensions
"""

import streamlit as st
import yfinance as yf
import yfinance_fix
import plotly.graph_objects as go

from analytics_core.strategy import TechnicalIndicators
from analytics_core.strategies.strategy_rsi_macd import generate_signal as rsi_signal
from analytics_core.strategies.strategy_logreg import generate_signal as logreg_signal
from analytics_core.rating import (
    score_technical, score_fundamental, score_ml,
    overall_score, score_color, score_label, _score_rsi,
)
from components.charts import CHART_LAYOUT, COLORS


st.header("Stock Rating")
st.caption("Algorithmic scoring across technical indicators, fundamental metrics, and ML model predictions.")

with st.expander("⚠️ Disclaimer", expanded=True):
    st.info(
        "This is not investment advice. Ratings are based on algorithmic indicators and "
        "statistical models. Past performance does not guarantee future results. "
        "Always conduct your own research before making investment decisions."
    )

ticker = (st.session_state.get("global_ticker") or "SPY").strip().upper()


def gauge_chart(score, title, height=220):
    color = score_color(score)
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=round(score, 1),
        title={"text": title, "font": {"color": "#fafafa", "size": 14}},
        number={"font": {"color": color, "size": 32}, "suffix": ""},
        gauge={
            "axis": {"range": [0, 100], "tickcolor": "#555", "tickfont": {"color": "#aaa"}},
            "bar": {"color": color, "thickness": 0.25},
            "bgcolor": "#1e1e2e",
            "borderwidth": 0,
            "steps": [
                {"range": [0,  30], "color": "#2a1a1a"},
                {"range": [30, 45], "color": "#2a251a"},
                {"range": [45, 60], "color": "#2a2a1a"},
                {"range": [60, 75], "color": "#1a2a1a"},
                {"range": [75, 100],"color": "#1a2a22"},
            ],
        },
    ))
    layout = {**CHART_LAYOUT, "margin": dict(l=20, r=20, t=40, b=10)}
    fig.update_layout(**layout, height=height)
    return fig


# ── Load data ────────────────────────────────────────────────────────────────

@st.cache_data(ttl=300)
def load_price_data(symbol):
    df = yf.download(symbol, period="1y", interval="1d",
                     session=yfinance_fix.chrome_session, progress=False)
    if df.empty:
        return None
    df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    return df


@st.cache_data(ttl=600)
def load_fundamental_data(symbol):
    try:
        t = yf.Ticker(symbol, session=yfinance_fix.chrome_session)
        return t.info
    except Exception:
        return {}


with st.spinner("Computing scores..."):
    df_raw = load_price_data(ticker)

if df_raw is None:
    st.error(f"Could not load data for **{ticker}**. Check the ticker symbol.")
    st.stop()

# Compute indicators
ti = TechnicalIndicators(df_raw.copy())
ti.add_macd().add_rsi().add_mfi().add_bb()
df = ti.dropna().get_df()

if df.empty:
    st.error("Not enough data to compute indicators.")
    st.stop()

last = df.iloc[-1]
rsi_val      = float(last["RSI"])
macd_hist_val= float(last["MACD_HIST"])
bb_val       = float(last["BB"])
mfi_val      = float(last["MFI"])

# Signals
try:
    sig_rsi = rsi_signal(df_raw)
except Exception:
    sig_rsi = {"signal": "N/A", "reason": "", "rsi": rsi_val, "macd_hist": macd_hist_val}

try:
    sig_log = logreg_signal(df_raw)
except Exception:
    sig_log = {"signal": "N/A", "probability": None, "reason": ""}

# Fundamental info
info = load_fundamental_data(ticker)

# ── Compute scores ───────────────────────────────────────────────────────────

tech_score                = score_technical(rsi_val, macd_hist_val, bb_val, mfi_val)
fund_score, fund_details  = score_fundamental(info)
ml_score                  = score_ml(sig_log)
total_score               = overall_score(tech_score, fund_score, ml_score)

# ── Layout: Overall score ─────────────────────────────────────────────────────

st.divider()

col_g, col_info = st.columns([1, 1])

with col_g:
    fig_total = gauge_chart(total_score, f"{ticker} — Overall Score", height=260)
    st.plotly_chart(fig_total, use_container_width=True)

with col_info:
    label = score_label(total_score)
    color = score_color(total_score)
    st.markdown(f"<h1 style='color:{color}; margin-top:40px'>{label}</h1>", unsafe_allow_html=True)
    st.markdown(f"<p style='font-size:18px; color:#aaa'>{total_score:.0f} / 100</p>", unsafe_allow_html=True)

    # Natural language
    parts = []
    rsi_desc  = "oversold" if rsi_val < 30 else "overbought" if rsi_val > 70 else "neutral"
    mom_desc  = "positive momentum" if macd_hist_val > 0 else "negative momentum"
    parts.append(f"**Technical:** {ticker} is {rsi_desc} (RSI: {rsi_val:.0f}) with {mom_desc}.")

    if fund_score is not None:
        pe = info.get("trailingPE")
        fund_desc = "attractively valued" if fund_score >= 65 else "fairly valued" if fund_score >= 45 else "richly valued"
        pe_str = f" (P/E: {pe:.1f}x)" if pe and pe > 0 else ""
        parts.append(f"**Fundamental:** {fund_desc}{pe_str}.")
    else:
        parts.append("**Fundamental:** N/A — insufficient data (ETF or no financials).")

    prob = sig_log.get("probability")
    if prob is not None:
        ml_dir = "upward" if prob > 0.55 else "downward" if prob < 0.45 else "sideways"
        parts.append(f"**ML model** predicts {ml_dir} movement (P(Up): {prob:.0%}).")

    for p in parts:
        st.markdown(p)

st.divider()

# ── Sub-scores ───────────────────────────────────────────────────────────────

c1, c2, c3 = st.columns(3)

with c1:
    st.plotly_chart(gauge_chart(tech_score, "Technical Score"), use_container_width=True)
    st.caption(f"RSI {rsi_val:.0f} · MACD {'▲' if macd_hist_val > 0 else '▼'} · MFI {mfi_val:.0f} · BB {bb_val:.2f}")

with c2:
    if fund_score is not None:
        st.plotly_chart(gauge_chart(fund_score, "Fundamental Score"), use_container_width=True)
    else:
        st.markdown("#### Fundamental Score")
        st.markdown("<p style='color:#888; margin-top:60px; text-align:center; font-size:20px'>N/A</p>",
                    unsafe_allow_html=True)
        st.caption("No fundamental data available for this ticker.")

with c3:
    if ml_score is not None:
        st.plotly_chart(gauge_chart(ml_score, "ML Score"), use_container_width=True)
        st.caption(f"LogReg · P(Up): {prob:.0%}" if prob else "LogReg · N/A")
    else:
        st.markdown("#### ML Score")
        st.markdown("<p style='color:#888; margin-top:60px; text-align:center; font-size:20px'>N/A</p>",
                    unsafe_allow_html=True)
        st.caption("ML model could not generate a prediction.")

# ── Score breakdown ───────────────────────────────────────────────────────────

with st.expander("Score breakdown", expanded=False):
    import pandas as pd

    rows = [
        ("RSI",        f"{rsi_val:.1f}",       f"{_score_rsi(rsi_val):.0f}/100",  "Technical · 10%"),
        ("MACD Hist",  f"{macd_hist_val:.4f}",  f"{'70' if macd_hist_val > 0 else '30'}/100", "Technical · 10%"),
        ("Bollinger B",f"{bb_val:.2f}",         f"{max(0, min(100, (1-bb_val)*100)):.0f}/100", "Technical · 10%"),
        ("MFI",        f"{mfi_val:.1f}",        f"{_score_rsi(mfi_val):.0f}/100",  "Technical · 10%"),
    ]
    for label, raw, score in fund_details:
        rows.append((label, raw, f"{score:.0f}/100", "Fundamental · ~10%"))

    if prob is not None:
        rows.append(("LogReg P(Up)", f"{prob:.0%}", f"{ml_score:.0f}/100", "ML · 20%"))

    df_breakdown = pd.DataFrame(rows, columns=["Component", "Value", "Score", "Weight"])
    st.dataframe(df_breakdown, use_container_width=True, hide_index=True)
