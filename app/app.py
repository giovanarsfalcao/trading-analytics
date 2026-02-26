"""
Trading Analytics Platform

Multi-page Streamlit app for quantitative analysis,
backtesting, and portfolio optimization.

Run: streamlit run app/app.py
"""

import sys
import os

# Ensure tradbot package is importable from any working directory
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import streamlit as st

# --- Page Config (must be first Streamlit command) ---
st.set_page_config(
    page_title="Trading Analytics",
    page_icon=":material/monitoring:",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Global Ticker (renders above navigation categories) ---
with st.sidebar:
    if "global_ticker" not in st.session_state:
        st.session_state["global_ticker"] = "SPY"
    st.text_input("Ticker", key="global_ticker", placeholder="e.g. AAPL, SPY, MSFT")
    st.divider()

# --- Navigation ---
welcome     = st.Page("pages/0_Welcome.py",               title="Welcome",              icon=":material/home:")
overview    = st.Page("pages/1_Overview.py",              title="Overview",             icon=":material/dashboard:")
technical   = st.Page("pages/2_Technical_Analysis.py",   title="Technical Analysis",   icon=":material/show_chart:")
fundamental = st.Page("pages/3_Fundamental_Analysis.py", title="Fundamental Analysis", icon=":material/bar_chart:")
risk        = st.Page("pages/4_Risk.py",                  title="Risk Management",      icon=":material/shield:")
models      = st.Page("pages/5_Model_Insights.py",        title="Model Insights",       icon=":material/psychology:")
backtest    = st.Page("pages/6_Backtesting.py",           title="Backtesting",          icon=":material/replay:")
portfolio   = st.Page("pages/7_Portfolio.py",             title="Portfolio",            icon=":material/pie_chart:")

nav = st.navigation(
    {
        "Start":        [welcome],
        "Analysis":     [overview, technical, fundamental, risk],
        "Research":     [models, backtest],
        "Optimization": [portfolio],
    }
)

# --- Sidebar Branding ---
with st.sidebar:
    st.markdown("---")
    st.caption("Trading Analytics v2.0")

nav.run()
