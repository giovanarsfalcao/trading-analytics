import yfinance as yf
from utils import yfinance_fix


def fetch_fundamentals(ticker: str) -> dict:
    """Fetch fundamental data for a ticker. Returns empty dict on failure."""
    try:
        t = yf.Ticker(ticker, session=yfinance_fix.chrome_session)
        info = t.info
    except Exception:
        return {}

    if not info:
        return {}

    return {
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
