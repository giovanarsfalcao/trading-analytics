"""
Fundamental Analysis - Valuation, Earnings, Cash Flow, Balance Sheet
"""

import streamlit as st
import pandas as pd
import yfinance as yf
import yfinance_fix
import plotly.graph_objects as go

from components.kpi_cards import render_kpi_row, fmt
from components.charts import CHART_LAYOUT, COLORS


st.header("Fundamental Analysis")
st.caption("Valuation multiples, earnings trends, and financial health indicators — assess the intrinsic worth of a company.")

ticker = (st.session_state.get("global_ticker") or "AAPL").strip().upper()

# --- Load Data ---
@st.cache_data(ttl=600)
def load_fundamentals(symbol):
    t = yf.Ticker(symbol, session=yfinance_fix.chrome_session)
    return t.info, t.financials, t.balance_sheet, t.cashflow


with st.spinner("Loading fundamental data..."):
    try:
        info, financials, balance_sheet, cashflow = load_fundamentals(ticker)
    except Exception as e:
        st.error(f"Could not load data for {ticker}: {e}")
        st.stop()

if not info or info.get("regularMarketPrice") is None and info.get("currentPrice") is None:
    st.error(f"No fundamental data found for **{ticker}**. Try a US-listed stock like AAPL or MSFT.")
    st.stop()

company_name = info.get("longName") or ticker
st.subheader(company_name)

# --- KPI Row: Valuation ---
render_kpi_row([
    {"label": "Market Cap",    "value": fmt(info.get("marketCap"), bn=True)},
    {"label": "P/E (TTM)",     "value": fmt(info.get("trailingPE"))},
    {"label": "P/B",           "value": fmt(info.get("priceToBook"))},
    {"label": "EV/EBITDA",     "value": fmt(info.get("enterpriseToEbitda"), x=True)},
    {"label": "EPS (TTM)",     "value": fmt(info.get("trailingEps"))},
    {"label": "Div. Yield",    "value": fmt(info.get("dividendYield"), pct=True)},
    {"label": "Beta",          "value": fmt(info.get("beta"))},
])

st.divider()

# --- Revenue & Earnings + Profitability ---
col1, col2 = st.columns([3, 2])

with col1:
    st.subheader("Revenue & Net Income")
    if financials is not None and not financials.empty:
        try:
            fin = financials.T.sort_index()
            years = [str(d.year) for d in fin.index]

            revenue = fin.get("Total Revenue", fin.get("Revenue", None))
            net_income = fin.get("Net Income", None)

            fig = go.Figure()
            if revenue is not None:
                fig.add_trace(go.Bar(
                    x=years, y=revenue / 1e9,
                    name="Revenue ($B)", marker_color=COLORS["blue"], opacity=0.85,
                ))
            if net_income is not None:
                fig.add_trace(go.Bar(
                    x=years, y=net_income / 1e9,
                    name="Net Income ($B)", marker_color=COLORS["green"], opacity=0.85,
                ))
            fig.update_layout(**CHART_LAYOUT, barmode="group",
                              yaxis_title="USD Billions", legend=dict(orientation="h", y=1.1))
            st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.warning(f"Could not render income chart: {e}")
    else:
        st.info("Income statement data not available for this ticker.")

with col2:
    st.subheader("Profitability")
    render_kpi_row([
        {"label": "Gross Margin",  "value": fmt(info.get("grossMargins"), pct=True)},
        {"label": "Net Margin",    "value": fmt(info.get("profitMargins"), pct=True)},
    ])
    render_kpi_row([
        {"label": "ROE",           "value": fmt(info.get("returnOnEquity"), pct=True)},
        {"label": "ROA",           "value": fmt(info.get("returnOnAssets"), pct=True)},
    ])
    render_kpi_row([
        {"label": "Revenue Growth","value": fmt(info.get("revenueGrowth"), pct=True)},
        {"label": "Earnings Growth","value": fmt(info.get("earningsGrowth"), pct=True)},
    ])

st.divider()

# --- Cash Flow ---
st.subheader("Cash Flow")
if cashflow is not None and not cashflow.empty:
    try:
        cf = cashflow.T.sort_index()
        years_cf = [str(d.year) for d in cf.index]

        op_cf = cf.get("Operating Cash Flow", cf.get("Total Cash From Operating Activities", None))
        capex = cf.get("Capital Expenditure", cf.get("Capital Expenditures", None))

        fig_cf = go.Figure()
        if op_cf is not None:
            fig_cf.add_trace(go.Bar(
                x=years_cf, y=op_cf / 1e9,
                name="Operating CF ($B)", marker_color=COLORS["blue"], opacity=0.85,
            ))
        if capex is not None and op_cf is not None:
            free_cf = op_cf + capex  # capex is negative in yfinance
            fig_cf.add_trace(go.Bar(
                x=years_cf, y=free_cf / 1e9,
                name="Free CF ($B)", marker_color=COLORS["green"], opacity=0.85,
            ))
        fig_cf.update_layout(**CHART_LAYOUT, barmode="group",
                             yaxis_title="USD Billions", legend=dict(orientation="h", y=1.1))
        st.plotly_chart(fig_cf, use_container_width=True)
    except Exception as e:
        st.warning(f"Could not render cash flow chart: {e}")
else:
    st.info("Cash flow data not available for this ticker.")

st.divider()

# --- Balance Sheet Ratios ---
st.subheader("Financial Health")
render_kpi_row([
    {"label": "Debt / Equity",   "value": fmt(info.get("debtToEquity"))},
    {"label": "Current Ratio",   "value": fmt(info.get("currentRatio"))},
    {"label": "Quick Ratio",     "value": fmt(info.get("quickRatio"))},
    {"label": "Total Cash",      "value": fmt(info.get("totalCash"), bn=True)},
    {"label": "Total Debt",      "value": fmt(info.get("totalDebt"), bn=True)},
])

st.divider()

# --- Detail Table ---
st.subheader("All Available Metrics")

metric_map = {
    "Sector": info.get("sector"),
    "Industry": info.get("industry"),
    "Country": info.get("country"),
    "Exchange": info.get("exchange"),
    "Currency": info.get("currency"),
    "Market Cap": fmt(info.get("marketCap"), bn=True),
    "Enterprise Value": fmt(info.get("enterpriseValue"), bn=True),
    "P/E (TTM)": fmt(info.get("trailingPE")),
    "P/E (Forward)": fmt(info.get("forwardPE")),
    "PEG Ratio": fmt(info.get("pegRatio")),
    "P/B": fmt(info.get("priceToBook")),
    "P/S (TTM)": fmt(info.get("priceToSalesTrailing12Months")),
    "EV/EBITDA": fmt(info.get("enterpriseToEbitda"), x=True),
    "EV/Revenue": fmt(info.get("enterpriseToRevenue"), x=True),
    "EPS (TTM)": fmt(info.get("trailingEps")),
    "EPS (Forward)": fmt(info.get("forwardEps")),
    "Revenue (TTM)": fmt(info.get("totalRevenue"), bn=True),
    "Gross Profit": fmt(info.get("grossProfits"), bn=True),
    "EBITDA": fmt(info.get("ebitda"), bn=True),
    "Gross Margin": fmt(info.get("grossMargins"), pct=True),
    "Operating Margin": fmt(info.get("operatingMargins"), pct=True),
    "Net Margin": fmt(info.get("profitMargins"), pct=True),
    "ROE": fmt(info.get("returnOnEquity"), pct=True),
    "ROA": fmt(info.get("returnOnAssets"), pct=True),
    "Revenue Growth (YoY)": fmt(info.get("revenueGrowth"), pct=True),
    "Earnings Growth (YoY)": fmt(info.get("earningsGrowth"), pct=True),
    "Debt / Equity": fmt(info.get("debtToEquity")),
    "Current Ratio": fmt(info.get("currentRatio")),
    "Quick Ratio": fmt(info.get("quickRatio")),
    "Total Cash": fmt(info.get("totalCash"), bn=True),
    "Total Debt": fmt(info.get("totalDebt"), bn=True),
    "Free Cash Flow": fmt(info.get("freeCashflow"), bn=True),
    "Dividend Yield": fmt(info.get("dividendYield"), pct=True),
    "Payout Ratio": fmt(info.get("payoutRatio"), pct=True),
    "Beta": fmt(info.get("beta")),
    "52W High": fmt(info.get("fiftyTwoWeekHigh")),
    "52W Low": fmt(info.get("fiftyTwoWeekLow")),
    "Avg Volume (10d)": f"{info.get('averageVolume10days', 'N/A'):,}" if info.get("averageVolume10days") else "N/A",
    "Shares Outstanding": fmt(info.get("sharesOutstanding"), bn=True),
    "Float Shares": fmt(info.get("floatShares"), bn=True),
    "Short Ratio": fmt(info.get("shortRatio")),
    "Employees": f"{info.get('fullTimeEmployees', 'N/A'):,}" if info.get("fullTimeEmployees") else "N/A",
}

detail_df = pd.DataFrame([
    {"Metric": k, "Value": v}
    for k, v in metric_map.items()
    if v not in (None, "N/A")
])
st.dataframe(detail_df, use_container_width=True, hide_index=True)
