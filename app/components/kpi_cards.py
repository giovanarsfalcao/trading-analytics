"""
KPI metric card helpers for the dashboard.
"""

import streamlit as st


def render_kpi(label: str, value: str, delta: str = None,
               delta_color: str = "normal"):
    """Render a single KPI metric using Streamlit's metric widget."""
    st.metric(label=label, value=value, delta=delta, delta_color=delta_color)


def render_kpi_row(metrics: list[dict]):
    """
    Render a row of KPI cards.

    Args:
        metrics: list of dicts with keys: label, value, delta (optional), delta_color (optional)
    """
    cols = st.columns(len(metrics))
    for col, m in zip(cols, metrics):
        with col:
            st.metric(
                label=m["label"],
                value=m["value"],
                delta=m.get("delta"),
                delta_color=m.get("delta_color", "normal"),
            )


def fmt(val, pct=False, bn=False, x=False) -> str:
    """Format a numeric value for display. Returns 'N/A' for missing/NaN values."""
    import math
    if val is None:
        return "N/A"
    try:
        if math.isnan(float(val)):
            return "N/A"
    except (TypeError, ValueError):
        return "N/A"
    if bn:
        return f"${float(val) / 1e9:.2f}B"
    if pct:
        return f"{float(val):.2%}"
    if x:
        return f"{float(val):.1f}x"
    return f"{float(val):.2f}"


def render_metric_table(strategy_metrics: dict, buyhold_metrics: dict):
    """
    Render a comparison table of strategy vs buy & hold metrics.
    """
    import pandas as pd

    rows = [
        ("Total Return", f"{strategy_metrics['total_return']:.2%}",
         f"{buyhold_metrics['total_return']:.2%}"),
        ("Sharpe Ratio", f"{strategy_metrics['sharpe']:.3f}",
         f"{buyhold_metrics['sharpe']:.3f}"),
        ("Max Drawdown", f"{strategy_metrics['max_drawdown']:.2%}",
         f"{buyhold_metrics['max_drawdown']:.2%}"),
        ("VaR 95%", f"{strategy_metrics['var_95']:.4f}",
         f"{buyhold_metrics['var_95']:.4f}"),
        ("Ann. Return", f"{strategy_metrics['ann_return']:.2%}",
         f"{buyhold_metrics['ann_return']:.2%}"),
        ("Ann. Volatility", f"{strategy_metrics['ann_volatility']:.2%}",
         f"{buyhold_metrics['ann_volatility']:.2%}"),
    ]

    table = pd.DataFrame(rows, columns=["Metric", "Strategy", "Buy & Hold"])
    st.dataframe(table, use_container_width=True, hide_index=True)
