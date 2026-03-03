import streamlit as st
import pandas as pd
from typing import Any

STAGE_KEYS = {
    1: ["ticker", "price_data"],
    2: ["strategy_name", "strategy_params", "signals"],
    3: ["backtest_results", "trades", "portfolio_value", "benchmark_returns"],
    4: ["risk_metrics", "monte_carlo_results"],
}

_DEFAULTS = {
    "ticker": None,
    "price_data": None,
    "fundamentals": None,
    "strategy_name": None,
    "strategy_params": None,
    "signals": None,
    "backtest_results": None,
    "trades": None,
    "portfolio_value": None,
    "benchmark_returns": None,
    "risk_metrics": None,
    "monte_carlo_results": None,
}


def init_state() -> None:
    for key, default in _DEFAULTS.items():
        if key not in st.session_state:
            st.session_state[key] = default


def get_state(key: str) -> Any:
    init_state()
    return st.session_state.get(key)


def set_state(key: str, value: Any) -> None:
    init_state()
    st.session_state[key] = value


def is_stage_complete(stage: int) -> bool:
    init_state()
    keys = STAGE_KEYS.get(stage, [])
    for k in keys:
        val = st.session_state.get(k)
        if val is None:
            return False
        if isinstance(val, pd.DataFrame) and val.empty:
            return False
    return True


def clear_downstream(from_stage: int) -> None:
    for stage_num in range(from_stage + 1, 5):
        for key in STAGE_KEYS.get(stage_num, []):
            st.session_state[key] = None
