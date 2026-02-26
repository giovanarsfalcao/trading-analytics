"""
Reusable Plotly chart builders for the dashboard.

All charts use a consistent dark theme and color palette.
"""

import plotly.graph_objects as go
import pandas as pd
import numpy as np

# Shared layout config
CHART_LAYOUT = dict(
    template="plotly_dark",
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color="#e0e0e0"),
    margin=dict(l=40, r=40, t=40, b=40),
)

# Color palette
COLORS = {
    "green": "#00d4aa",
    "red": "#ff4757",
    "blue": "#1e88e5",
    "orange": "#ffa502",
    "gray": "#747d8c",
    "white": "#e0e0e0",
    "light_blue": "#54a0ff",
    "purple": "#a55eea",
}


def equity_curve(df: pd.DataFrame, columns: dict, title: str = "") -> go.Figure:
    """
    Plot equity/cumulative return curves.

    Args:
        df: DataFrame with index as dates
        columns: dict mapping column_name -> label, e.g. {"asset_cum_returns": "Buy & Hold"}
        title: Chart title
    """
    fig = go.Figure()
    palette = [COLORS["blue"], COLORS["green"], COLORS["orange"], COLORS["purple"]]

    for i, (col, label) in enumerate(columns.items()):
        if col in df.columns:
            fig.add_trace(go.Scatter(
                x=df.index, y=df[col],
                name=label,
                line=dict(color=palette[i % len(palette)], width=2),
            ))

    fig.update_layout(
        **CHART_LAYOUT,
        title=title,
        yaxis_title="Cumulative Return",
        yaxis_tickformat=".1%",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        hovermode="x unified",
    )
    return fig


def drawdown_chart(prices: pd.Series, title: str = "Drawdown") -> go.Figure:
    """Plot drawdown as filled area chart."""
    rolling_max = prices.cummax()
    drawdown = (prices - rolling_max) / rolling_max

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=drawdown.index, y=drawdown,
        fill="tozeroy",
        fillcolor="rgba(255,71,87,0.3)",
        line=dict(color=COLORS["red"], width=1),
        name="Drawdown",
    ))
    fig.update_layout(
        **CHART_LAYOUT,
        title=title,
        yaxis_title="Drawdown",
        yaxis_tickformat=".1%",
        hovermode="x unified",
    )
    return fig


def return_distribution(returns: pd.Series, var_95: float = None,
                        var_99: float = None) -> go.Figure:
    """Plot return distribution histogram with VaR lines."""
    fig = go.Figure()
    fig.add_trace(go.Histogram(
        x=returns, nbinsx=60,
        marker_color=COLORS["blue"], opacity=0.7,
        name="Returns",
    ))

    if var_95 is not None:
        fig.add_vline(x=var_95, line_dash="dash", line_color=COLORS["orange"],
                      annotation_text=f"VaR 95%: {var_95:.2%}")
    if var_99 is not None:
        fig.add_vline(x=var_99, line_dash="dash", line_color=COLORS["red"],
                      annotation_text=f"VaR 99%: {var_99:.2%}")

    fig.update_layout(
        **CHART_LAYOUT,
        title="Return Distribution",
        xaxis_title="Daily Return",
        xaxis_tickformat=".1%",
        yaxis_title="Frequency",
        showlegend=False,
    )
    return fig


def rolling_volatility(returns: pd.Series, window: int = 30) -> go.Figure:
    """Plot rolling annualized volatility."""
    vol = returns.rolling(window).std() * np.sqrt(252)

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=vol.index, y=vol,
        line=dict(color=COLORS["orange"], width=2),
        name=f"{window}d Rolling Volatility",
    ))
    fig.update_layout(
        **CHART_LAYOUT,
        title=f"Rolling Volatility ({window}-day)",
        yaxis_title="Annualized Volatility",
        yaxis_tickformat=".1%",
        hovermode="x unified",
    )
    return fig



def indicator_subplot(df: pd.DataFrame, indicator: str, **kwargs) -> go.Figure:
    """
    Create a single indicator chart.

    Supports: MACD, RSI, MFI, BB (Bollinger Bands)
    """
    subset = df.tail(200)

    if indicator == "MACD":
        fig = go.Figure()
        colors = [COLORS["green"] if x >= 0 else COLORS["red"] for x in subset["MACD_HIST"]]
        fig.add_trace(go.Bar(x=subset.index, y=subset["MACD_HIST"],
                             marker_color=colors, name="Histogram", opacity=0.5))
        fig.add_trace(go.Scatter(x=subset.index, y=subset["MACD"],
                                 line=dict(color=COLORS["blue"], width=2), name="MACD"))
        fig.add_trace(go.Scatter(x=subset.index, y=subset["Signal"],
                                 line=dict(color=COLORS["orange"], width=2), name="Signal"))
        fig.update_layout(**CHART_LAYOUT, title="MACD")

    elif indicator == "RSI":
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=subset.index, y=subset["RSI"],
                                 line=dict(color=COLORS["blue"], width=2), name="RSI"))
        fig.add_hline(y=70, line_dash="dash", line_color=COLORS["red"], opacity=0.5)
        fig.add_hline(y=30, line_dash="dash", line_color=COLORS["green"], opacity=0.5)
        fig.add_hrect(y0=30, y1=70, fillcolor=COLORS["gray"], opacity=0.05)
        fig.update_layout(**CHART_LAYOUT, title="RSI", yaxis_range=[0, 100])

    elif indicator == "MFI":
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=subset.index, y=subset["MFI"],
                                 line=dict(color=COLORS["purple"], width=2), name="MFI"))
        fig.add_hline(y=70, line_dash="dash", line_color=COLORS["red"], opacity=0.5)
        fig.add_hline(y=30, line_dash="dash", line_color=COLORS["green"], opacity=0.5)
        fig.add_hrect(y0=30, y1=70, fillcolor=COLORS["gray"], opacity=0.05)
        fig.update_layout(**CHART_LAYOUT, title="MFI", yaxis_range=[0, 100])

    elif indicator == "BB":
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=subset.index, y=subset["Upper"],
                                 line=dict(color=COLORS["red"], width=1, dash="dash"),
                                 name="Upper Band"))
        fig.add_trace(go.Scatter(x=subset.index, y=subset["Lower"],
                                 line=dict(color=COLORS["green"], width=1, dash="dash"),
                                 fill="tonexty", fillcolor="rgba(30,136,229,0.05)",
                                 name="Lower Band"))
        fig.add_trace(go.Scatter(x=subset.index, y=subset["Close"],
                                 line=dict(color=COLORS["white"], width=2), name="Close"))
        fig.add_trace(go.Scatter(x=subset.index, y=subset["BB_SMA"],
                                 line=dict(color=COLORS["blue"], width=1, dash="dot"),
                                 name="SMA"))
        fig.update_layout(**CHART_LAYOUT, title="Bollinger Bands")
    else:
        fig = go.Figure()
        fig.update_layout(**CHART_LAYOUT, title=f"Unknown indicator: {indicator}")

    fig.update_layout(hovermode="x unified")
    return fig


def signal_distribution_chart(strategy_series: pd.Series) -> go.Figure:
    """Bar chart showing Long/Short/Flat signal distribution."""
    counts = strategy_series.value_counts().sort_index()
    labels = {-1.0: "Short", 0.0: "Flat", 1.0: "Long"}
    color_map = {-1.0: COLORS["red"], 0.0: COLORS["gray"], 1.0: COLORS["green"]}

    fig = go.Figure()
    for val, count in counts.items():
        fig.add_trace(go.Bar(
            x=[labels.get(val, str(val))],
            y=[count],
            marker_color=color_map.get(val, COLORS["blue"]),
            name=labels.get(val, str(val)),
            text=f"{count} ({count / len(strategy_series) * 100:.1f}%)",
            textposition="auto",
        ))

    fig.update_layout(
        **CHART_LAYOUT,
        title="Signal Distribution",
        yaxis_title="Count",
        showlegend=False,
    )
    return fig



def roc_curve_chart(fpr, tpr, auc_score: float, title: str = "ROC Curve") -> go.Figure:
    """ROC curve plot."""
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=fpr, y=tpr,
        line=dict(color=COLORS["blue"], width=2),
        name=f"AUC = {auc_score:.3f}",
        fill="tozeroy", fillcolor="rgba(30,136,229,0.1)",
    ))
    fig.add_trace(go.Scatter(
        x=[0, 1], y=[0, 1],
        line=dict(color=COLORS["gray"], width=1, dash="dash"),
        name="Random",
        showlegend=False,
    ))
    fig.update_layout(
        **CHART_LAYOUT,
        title=title,
        xaxis_title="False Positive Rate",
        yaxis_title="True Positive Rate",
    )
    return fig


def rolling_sharpe_chart(returns: pd.Series, window: int = 252,
                         risk_free_rate: float = 0.02) -> go.Figure:
    """Rolling annualized Sharpe ratio chart."""
    daily_rf = risk_free_rate / 252
    rs = ((returns.rolling(window).mean() - daily_rf) /
          returns.rolling(window).std()) * np.sqrt(252)

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=rs.index, y=rs,
        line=dict(color=COLORS["blue"], width=1.5),
        name=f"{window}d Rolling Sharpe",
    ))
    fig.add_hline(y=0, line_color=COLORS["gray"], line_dash="dash")
    fig.add_hline(y=1, line_color=COLORS["green"], line_dash="dot", opacity=0.5)
    fig.update_layout(
        **CHART_LAYOUT,
        title=f"Rolling Sharpe ({window}-day)",
        yaxis_title="Sharpe Ratio",
        hovermode="x unified",
    )
    return fig


def monthly_returns_heatmap(prices: pd.Series, title: str = "Monthly Returns") -> go.Figure:
    """Calendar heatmap of monthly returns (years x months)."""
    returns = prices.pct_change().dropna()
    monthly = returns.resample("ME").apply(lambda x: (1 + x).prod() - 1)
    pivot = monthly.groupby([monthly.index.year, monthly.index.month]).first().unstack()
    pivot.columns = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    fig = go.Figure(go.Heatmap(
        z=pivot.values * 100,
        x=list(pivot.columns),
        y=[str(y) for y in pivot.index],
        colorscale="RdYlGn",
        zmid=0,
        text=(pivot * 100).round(1).values,
        texttemplate="%{text}%",
        textfont=dict(size=11),
        showscale=True,
    ))
    fig.update_layout(
        **CHART_LAYOUT,
        title=title,
        xaxis_title="Month",
        yaxis_title="Year",
        height=max(300, len(pivot) * 40 + 120),
    )
    return fig



def confusion_matrix_chart(cm, title: str = "Confusion Matrix") -> go.Figure:
    """Heatmap confusion matrix."""
    labels = ["Down (0)", "Up (1)"]
    fig = go.Figure(data=go.Heatmap(
        z=cm, x=labels, y=labels,
        colorscale="Blues",
        text=cm, texttemplate="%{text}",
        textfont=dict(size=16),
        showscale=False,
    ))
    fig.update_layout(
        **CHART_LAYOUT,
        title=title,
        xaxis_title="Predicted",
        yaxis_title="Actual",
        height=350,
    )
    return fig


def monte_carlo_chart(
        mc_result: dict,
        num_days: int,
        n_display: int = 200,
        title: str = "Monte Carlo Simulation",
) -> go.Figure:
    """Simulated price paths with confidence band and median."""
    paths = mc_result["paths"]
    x = list(range(num_days))

    fig = go.Figure()

    # Sample of individual paths (semitransparent)
    rng = np.random.default_rng(42)
    sample_idx = rng.choice(paths.shape[1], size=min(n_display, paths.shape[1]), replace=False)
    for i in sample_idx:
        fig.add_trace(go.Scatter(
            x=x, y=paths[:, i],
            mode="lines",
            line=dict(color=COLORS["blue"], width=0.5),
            opacity=0.12,
            showlegend=False,
            hoverinfo="skip",
        ))

    # Confidence band (filled area)
    fig.add_trace(go.Scatter(
        x=x + x[::-1],
        y=list(mc_result["upper"]) + list(mc_result["lower"][::-1]),
        fill="toself",
        fillcolor="rgba(255,71,87,0.15)",
        line=dict(color="rgba(0,0,0,0)"),
        name="Confidence Band",
    ))

    # Median path
    fig.add_trace(go.Scatter(
        x=x, y=mc_result["median"],
        line=dict(color=COLORS["white"], width=2),
        name="Median",
    ))

    fig.add_hline(y=1.0, line_color=COLORS["gray"], line_dash="dash")
    fig.update_layout(
        **CHART_LAYOUT,
        title=title,
        xaxis_title="Trading Days",
        yaxis_title="Portfolio Value (normalized)",
        hovermode="x unified",
    )
    return fig
