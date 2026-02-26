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

# --- Navigation ---
welcome = st.Page("pages/0_Welcome.py", title="Welcome", icon=":material/home:")
overview = st.Page("pages/1_Overview.py", title="Overview", icon=":material/dashboard:")
strategy = st.Page("pages/2_Strategy_Signals.py", title="Strategy & Signals", icon=":material/show_chart:")
risk = st.Page("pages/3_Risk.py", title="Risk Management", icon=":material/shield:")
portfolio = st.Page("pages/4_Portfolio.py", title="Portfolio", icon=":material/pie_chart:")
backtest = st.Page("pages/5_Backtesting.py", title="Backtesting", icon=":material/replay:")

nav = st.navigation(
    {
        "Start": [welcome],
        "Analysis": [overview, strategy, risk],
        "Optimization": [portfolio, backtest],
    }
)

# --- Sidebar Branding ---
with st.sidebar:
    st.markdown("---")
    st.caption("Trading Analytics v2.0")

nav.run()
