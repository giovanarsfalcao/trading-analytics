import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

import streamlit as st
from utils.state_manager import init_state

st.set_page_config(page_title="Report", page_icon="📋", layout="wide")
init_state()

st.header("📋 Report")
st.info("Coming in the next stage.")
