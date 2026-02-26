"""
Stock rating / scoring logic.

Provides algorithmic scores (0-100) across three dimensions:
- Technical:    RSI, MACD histogram, Bollinger Band position, MFI
- Fundamental:  P/E, Revenue Growth, ROE, Debt/Equity
- ML:           LogReg probability of upward movement

All functions are pure (no Streamlit, no I/O) and importable from any context.
"""

from components.charts import COLORS


# ── Internal helpers ──────────────────────────────────────────────────────────

def _score_rsi(rsi):
    if rsi < 30:   return 75
    if rsi < 45:   return 65
    if rsi < 55:   return 50
    if rsi < 70:   return 40
    return 20


def _score_oscillator(val):
    """Generic 0-100 oscillator — same thresholds as RSI (e.g. MFI)."""
    return _score_rsi(val)


# ── Public scoring functions ──────────────────────────────────────────────────

def score_technical(rsi, macd_hist, bb, mfi) -> float:
    """
    Returns a 0-100 technical score from the four core indicators.

    bb: normalized Bollinger Band position (0 = lower band, 1 = upper band).
    """
    rsi_s  = _score_rsi(rsi)
    macd_s = 70 if macd_hist > 0 else 30
    bb_s   = max(0.0, min(100.0, (1.0 - bb) * 100))
    mfi_s  = _score_oscillator(mfi)
    return 0.25 * rsi_s + 0.25 * macd_s + 0.25 * bb_s + 0.25 * mfi_s


def score_fundamental(info: dict) -> tuple:
    """
    Returns (score: float | None, components: list[tuple]).

    Each component tuple is (label, raw_value_str, score_int).
    Returns (None, []) when no fundamental data is available (e.g. ETFs).
    """
    components = []

    pe = info.get("trailingPE")
    if pe and pe > 0:
        if pe < 12:   s = 90
        elif pe < 18: s = 70
        elif pe < 25: s = 50
        elif pe < 35: s = 35
        else:         s = 15
        components.append(("P/E Ratio", f"{pe:.1f}x", s))

    rg = info.get("revenueGrowth")
    if rg is not None:
        if rg > 0.20:   s = 90
        elif rg > 0.10: s = 70
        elif rg > 0.05: s = 50
        elif rg > 0:    s = 35
        else:           s = 15
        components.append(("Revenue Growth", f"{rg:.1%}", s))

    roe = info.get("returnOnEquity")
    if roe is not None:
        if roe > 0.20:   s = 90
        elif roe > 0.10: s = 65
        elif roe > 0.05: s = 45
        else:            s = 20
        components.append(("ROE", f"{roe:.1%}", s))

    de = info.get("debtToEquity")
    if de is not None:
        if de < 30:    s = 90   # yfinance returns D/E * 100
        elif de < 70:  s = 70
        elif de < 150: s = 45
        else:          s = 20
        components.append(("Debt / Equity", f"{de/100:.2f}", s))

    if not components:
        return None, []

    avg = sum(s for _, _, s in components) / len(components)
    return avg, components


def score_ml(sig_log: dict) -> float | None:
    """Returns ML score (0-100) from a logreg signal dict, or None."""
    prob = sig_log.get("probability")
    if prob is None:
        return None
    return prob * 100


def overall_score(tech, fund, ml) -> float | None:
    """
    Weighted combination of available scores.
    Weights: technical 40%, fundamental 40%, ML 20%.
    Missing dimensions are excluded and remaining weights renormalized.
    """
    parts = []
    if tech is not None: parts.append((tech, 0.4))
    if fund is not None: parts.append((fund, 0.4))
    if ml   is not None: parts.append((ml,   0.2))
    if not parts:
        return None
    total_w = sum(w for _, w in parts)
    return sum(s * w for s, w in parts) / total_w


# ── Display helpers ───────────────────────────────────────────────────────────

def score_color(score: float) -> str:
    if score >= 75: return COLORS["green"]
    if score >= 60: return "#a8e063"
    if score >= 45: return COLORS["orange"]
    if score >= 30: return "#ff7043"
    return COLORS["red"]


def score_label(score: float) -> str:
    if score >= 75: return "Strong Buy"
    if score >= 60: return "Buy"
    if score >= 45: return "Neutral"
    if score >= 30: return "Sell"
    return "Strong Sell"
