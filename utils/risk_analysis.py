"""
Risk analysis module.

Core risk metrics + Monte Carlo simulation.
Math based on analytics_core/risk_metrics.py, with added Calmar and Information Ratio.
"""

import numpy as np
import pandas as pd


# ── Individual Metrics ──────────────────────────────────────────

def sharpe_ratio(returns: pd.Series, risk_free_rate: float = 0.05,
                 periods: int = 252) -> float:
    ann_ret = returns.mean() * periods
    ann_vol = returns.std() * np.sqrt(periods)
    if ann_vol == 0:
        return 0.0
    return float((ann_ret - risk_free_rate) / ann_vol)


def sortino_ratio(returns: pd.Series, risk_free_rate: float = 0.05,
                  periods: int = 252) -> float:
    downside = returns[returns < 0]
    if len(downside) == 0 or downside.std() == 0:
        return 0.0
    downside_vol = downside.std() * np.sqrt(periods)
    ann_ret = returns.mean() * periods
    return float((ann_ret - risk_free_rate) / downside_vol)


def max_drawdown(prices: pd.Series) -> float:
    rolling_max = prices.cummax()
    drawdown = (prices - rolling_max) / rolling_max
    return float(drawdown.min())


def value_at_risk(returns: pd.Series, confidence: float = 0.95) -> float:
    return float(np.percentile(returns.dropna(), (1 - confidence) * 100))


def conditional_var(returns: pd.Series, confidence: float = 0.95) -> float:
    var = value_at_risk(returns, confidence)
    tail = returns[returns <= var]
    return float(tail.mean()) if len(tail) > 0 else var


def beta(returns: pd.Series, benchmark_returns: pd.Series) -> float:
    aligned = pd.concat([returns, benchmark_returns], axis=1).dropna()
    if len(aligned) < 2:
        return 0.0
    cov = aligned.cov().iloc[0, 1]
    var = aligned.iloc[:, 1].var()
    return float(cov / var) if var != 0 else 0.0


def alpha(returns: pd.Series, benchmark_returns: pd.Series,
          risk_free_rate: float = 0.05, periods: int = 252) -> float:
    b = beta(returns, benchmark_returns)
    ann_ret = returns.mean() * periods
    bench_ann = benchmark_returns.mean() * periods
    return float(ann_ret - risk_free_rate - b * (bench_ann - risk_free_rate))


def calmar_ratio(returns: pd.Series, prices: pd.Series,
                 periods: int = 252) -> float:
    ann_ret = returns.mean() * periods
    mdd = abs(max_drawdown(prices))
    return float(ann_ret / mdd) if mdd != 0 else 0.0


def information_ratio(returns: pd.Series, benchmark_returns: pd.Series,
                      periods: int = 252) -> float:
    aligned = pd.concat([returns, benchmark_returns], axis=1).dropna()
    if len(aligned) < 2:
        return 0.0
    active_return = aligned.iloc[:, 0] - aligned.iloc[:, 1]
    tracking_error = active_return.std() * np.sqrt(periods)
    if tracking_error == 0:
        return 0.0
    return float(active_return.mean() * periods / tracking_error)


# ── Composite Function ──────────────────────────────────────────

def calculate_risk_metrics(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
    portfolio_prices: pd.Series,
    risk_free_rate: float = 0.05,
) -> dict:
    """Calculate all risk metrics at once."""
    result = {
        "sharpe_ratio": sharpe_ratio(portfolio_returns, risk_free_rate),
        "sortino_ratio": sortino_ratio(portfolio_returns, risk_free_rate),
        "max_drawdown": max_drawdown(portfolio_prices),
        "var_95": value_at_risk(portfolio_returns, 0.95),
        "var_99": value_at_risk(portfolio_returns, 0.99),
        "cvar_95": conditional_var(portfolio_returns, 0.95),
        "calmar_ratio": calmar_ratio(portfolio_returns, portfolio_prices),
        "annualized_return": float(portfolio_returns.mean() * 252),
        "annualized_volatility": float(portfolio_returns.std() * np.sqrt(252)),
    }

    if not benchmark_returns.empty and len(benchmark_returns) > 1:
        result["beta"] = beta(portfolio_returns, benchmark_returns)
        result["alpha"] = alpha(portfolio_returns, benchmark_returns, risk_free_rate)
        result["information_ratio"] = information_ratio(portfolio_returns, benchmark_returns)
    else:
        result["beta"] = None
        result["alpha"] = None
        result["information_ratio"] = None

    return result


# ── Monte Carlo Simulation ──────────────────────────────────────

def monte_carlo_simulation(
    portfolio_returns: pd.Series,
    initial_capital: float,
    n_simulations: int = 1000,
    n_days: int = 252,
    confidence_levels: list = None,
) -> dict:
    """
    Monte Carlo simulation using Geometric Brownian Motion.

    Returns dict with: simulations, percentiles, final_values,
    probability_of_loss, expected_value, median_value, median_path.
    """
    if confidence_levels is None:
        confidence_levels = [0.05, 0.25, 0.75, 0.95]

    mu = float(np.mean(portfolio_returns))
    sigma = float(np.std(portfolio_returns))

    shocks = np.random.normal(
        loc=(mu - 0.5 * sigma**2),
        scale=sigma,
        size=(n_days, n_simulations),
    )
    paths = initial_capital * np.exp(np.cumsum(shocks, axis=0))

    final_values = paths[-1]

    percentiles = {}
    for level in confidence_levels:
        percentiles[level] = np.percentile(paths, level * 100, axis=1)

    return {
        "simulations": paths,
        "percentiles": percentiles,
        "final_values": final_values,
        "probability_of_loss": float((final_values < initial_capital).mean()),
        "expected_value": float(final_values.mean()),
        "median_value": float(np.median(final_values)),
        "median_path": np.median(paths, axis=1),
        "best_case": float(np.percentile(final_values, 95)),
        "worst_case": float(np.percentile(final_values, 5)),
    }
