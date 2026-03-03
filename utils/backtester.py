"""
Backtest engine with trade tracking, position sizing, and commission handling.
"""

import pandas as pd
import numpy as np


def run_backtest(
    price_data: pd.DataFrame,
    signals: pd.Series,
    initial_capital: float = 10_000,
    position_size: str = "fixed",
    position_pct: float = 1.0,
    commission: float = 0.001,
) -> dict:
    """
    Run a full backtest with trade-by-trade tracking.

    Args:
        price_data: OHLCV DataFrame with 'Close' column
        signals: pd.Series with {1, -1, 0}
        initial_capital: starting capital in $
        position_size: "fixed" (100%), "percentage", or "kelly"
        position_pct: fraction for "percentage" mode
        commission: rate per trade (applied on buy AND sell)

    Returns dict with: portfolio_value, cumulative_returns, trades,
    trade_stats, daily_returns, initial_capital.
    """
    aligned = pd.DataFrame({
        "Close": price_data["Close"],
        "Signal": signals,
    }).dropna()

    prices = aligned["Close"].values
    sigs = aligned["Signal"].values
    dates = aligned.index

    capital = initial_capital
    position = 0.0
    portfolio_values = []
    trades = []
    current_trade = None

    for i in range(len(prices)):
        price = prices[i]
        sig = int(sigs[i])

        pv = capital + position * price
        portfolio_values.append(pv)

        # Position sizing fraction
        if position_size == "kelly":
            frac = _kelly_fraction(trades) if trades else 0.5
        elif position_size == "percentage":
            frac = position_pct
        else:
            frac = 1.0

        # Buy signal, no position
        if sig == 1 and position == 0:
            invest = capital * frac
            shares = invest / price
            cost = invest * commission
            capital -= (invest + cost)
            position = shares
            current_trade = {
                "entry_date": dates[i],
                "entry_price": price,
                "direction": "long",
                "shares": shares,
                "commission_entry": cost,
            }

        # Sell signal, holding long
        elif sig == -1 and position > 0:
            proceeds = position * price
            cost = proceeds * commission
            capital += (proceeds - cost)
            if current_trade:
                current_trade.update({
                    "exit_date": dates[i],
                    "exit_price": price,
                    "commission_exit": cost,
                    "return_pct": (price - current_trade["entry_price"]) / current_trade["entry_price"],
                    "holding_days": (dates[i] - current_trade["entry_date"]).days,
                    "pnl": proceeds - cost - current_trade["shares"] * current_trade["entry_price"] - current_trade["commission_entry"],
                })
                trades.append(current_trade)
                current_trade = None
            position = 0.0

        # Sell signal, no position -> short
        elif sig == -1 and position == 0:
            invest = capital * frac
            shares = invest / price
            cost = invest * commission
            capital += invest  # proceeds from short sale
            capital -= cost
            position = -shares
            current_trade = {
                "entry_date": dates[i],
                "entry_price": price,
                "direction": "short",
                "shares": shares,
                "commission_entry": cost,
            }

        # Buy signal, holding short -> cover
        elif sig == 1 and position < 0:
            cover_cost = abs(position) * price
            cost = cover_cost * commission
            capital -= (cover_cost + cost)
            if current_trade:
                current_trade.update({
                    "exit_date": dates[i],
                    "exit_price": price,
                    "commission_exit": cost,
                    "return_pct": (current_trade["entry_price"] - price) / current_trade["entry_price"],
                    "holding_days": (dates[i] - current_trade["entry_date"]).days,
                    "pnl": (current_trade["entry_price"] - price) * current_trade["shares"] - cost - current_trade["commission_entry"],
                })
                trades.append(current_trade)
                current_trade = None
            position = 0.0

    # Close any open position at the end
    if position != 0 and current_trade:
        final_price = prices[-1]
        if position > 0:
            proceeds = position * final_price
            cost = proceeds * commission
            capital += (proceeds - cost)
            ret = (final_price - current_trade["entry_price"]) / current_trade["entry_price"]
            pnl = proceeds - cost - current_trade["shares"] * current_trade["entry_price"] - current_trade["commission_entry"]
        else:
            cover_cost = abs(position) * final_price
            cost = cover_cost * commission
            capital -= (cover_cost + cost)
            ret = (current_trade["entry_price"] - final_price) / current_trade["entry_price"]
            pnl = (current_trade["entry_price"] - final_price) * current_trade["shares"] - cost - current_trade["commission_entry"]

        current_trade.update({
            "exit_date": dates[-1],
            "exit_price": final_price,
            "commission_exit": cost,
            "return_pct": ret,
            "holding_days": (dates[-1] - current_trade["entry_date"]).days,
            "pnl": pnl,
        })
        trades.append(current_trade)

    portfolio_series = pd.Series(portfolio_values, index=dates)
    daily_returns = portfolio_series.pct_change().dropna()
    cumulative_returns = (portfolio_series / initial_capital) - 1

    trade_stats = _compute_trade_stats(trades, portfolio_series, initial_capital)

    return {
        "portfolio_value": portfolio_series,
        "cumulative_returns": cumulative_returns,
        "trades": trades,
        "trade_stats": trade_stats,
        "daily_returns": daily_returns,
        "initial_capital": initial_capital,
    }


def _kelly_fraction(trades: list) -> float:
    if len(trades) < 5:
        return 0.25
    returns = [t["return_pct"] for t in trades if "return_pct" in t]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r < 0]
    if not wins or not losses:
        return 0.25
    win_rate = len(wins) / len(returns)
    avg_win = np.mean(wins)
    avg_loss = abs(np.mean(losses))
    if avg_loss == 0:
        return 0.5
    kelly = win_rate - (1 - win_rate) / (avg_win / avg_loss)
    return max(0.05, min(0.5, kelly))


def _compute_trade_stats(trades: list, portfolio: pd.Series, initial_capital: float) -> dict:
    if not trades:
        return {
            "total_trades": 0, "winning_trades": 0, "losing_trades": 0,
            "win_rate": 0, "avg_win": 0, "avg_loss": 0,
            "profit_factor": 0, "total_return": 0,
            "max_drawdown": 0, "max_drawdown_duration_days": 0,
        }

    returns = [t.get("return_pct", 0) for t in trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]

    gross_wins = sum(wins) if wins else 0
    gross_losses = abs(sum(losses)) if losses else 0.0001

    # Max drawdown
    rolling_max = portfolio.cummax()
    drawdown = (portfolio - rolling_max) / rolling_max
    max_dd = float(drawdown.min())

    # Max drawdown duration
    is_dd = drawdown < 0
    if is_dd.any():
        dd_groups = (~is_dd).cumsum()
        dd_durations = is_dd.groupby(dd_groups).sum()
        max_dd_duration = int(dd_durations.max())
    else:
        max_dd_duration = 0

    # Sharpe (annualized)
    daily_ret = portfolio.pct_change().dropna()
    sharpe = 0.0
    if len(daily_ret) > 1 and daily_ret.std() > 0:
        sharpe = float((daily_ret.mean() * 252) / (daily_ret.std() * np.sqrt(252)))

    # Annualized return
    total_days = (portfolio.index[-1] - portfolio.index[0]).days
    total_return = (portfolio.iloc[-1] / initial_capital) - 1
    ann_return = (1 + total_return) ** (365 / max(total_days, 1)) - 1 if total_days > 0 else 0

    return {
        "total_trades": len(trades),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": len(wins) / len(trades) if trades else 0,
        "avg_win": float(np.mean(wins)) if wins else 0,
        "avg_loss": float(np.mean(losses)) if losses else 0,
        "profit_factor": gross_wins / gross_losses,
        "total_return": float(total_return),
        "annualized_return": float(ann_return),
        "max_drawdown": max_dd,
        "max_drawdown_duration_days": max_dd_duration,
        "sharpe_ratio": sharpe,
    }
