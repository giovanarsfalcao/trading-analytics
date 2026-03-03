import sys
import os

# Add project root to path so 'utils' is importable
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import streamlit as st
from utils.state_manager import init_state

st.set_page_config(
    page_title="Trading Analytics",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

init_state()

st.title("Trading Analytics Platform")
st.caption("Quantitative research, strategy development, backtesting, and risk analysis.")

st.subheader("5-Stage Workflow")

cols = st.columns(5)
steps = [
    ("1. Explore", "📊", "Pick a ticker, view price charts, indicators, and fundamentals."),
    ("2. Strategy", "📈", "Build a rule-based or ML trading strategy."),
    ("3. Backtest", "🔄", "Test your strategy against historical data."),
    ("4. Risk", "⚠️", "Analyze risk metrics and run Monte Carlo simulations."),
    ("5. Report", "📋", "Review summary and export your results."),
]

for col, (title, icon, desc) in zip(cols, steps):
    with col:
        st.markdown(f"### {icon}")
        st.markdown(f"**{title}**")
        st.caption(desc)

st.divider()

st.markdown("#### Getting Started")
st.markdown(
    "Navigate to **Explore** in the sidebar to pick a ticker and start your analysis. "
    "Each stage builds on the previous one — work through them in order."
)

st.page_link("pages/1_📊_Explore.py", label="Start with Explore →", icon="📊")
