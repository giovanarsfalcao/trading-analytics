"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard, fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";
import { EquityCurve } from "./EquityCurve";
import { TradeTable } from "./TradeTable";

export function BacktestPanel() {
  const store = useStore();
  const { ticker, period, strategyName, strategyParams, tradeStats, portfolio, benchmarkPortfolio, trades, setBacktestData, setLoading, setError } = store;
  const [capital, setCapital] = useState(10000);
  const [sizing, setSizing] = useState("fixed");
  const [pct, setPct] = useState(1.0);
  const [commission, setCommission] = useState(0.1);

  async function run() {
    if (!ticker || !strategyName) return;
    setLoading("backtest", true);
    setError(null);
    try {
      const isML = strategyName.startsWith("ML:");
      const res = await api.backtest({
        ticker, period,
        strategy_name: strategyName,
        params: isML ? {} : strategyParams as Record<string, number>,
        model_type: isML ? (strategyParams as any).model_type : undefined,
        features: isML ? (strategyParams as any).features : undefined,
        train_ratio: isML ? (strategyParams as any).train_ratio : undefined,
        threshold: isML ? (strategyParams as any).threshold : undefined,
        target_shift: isML ? (strategyParams as any).target_shift : undefined,
        initial_capital: capital,
        position_size: sizing,
        position_pct: pct,
        commission: commission / 100,
      }) as any;
      setBacktestData({
        initialCapital: capital,
        portfolio: res.portfolio,
        benchmarkPortfolio: res.benchmark_portfolio || [],
        trades: res.trades,
        tradeStats: res.trade_stats,
        dailyReturns: res.daily_returns,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setLoading("backtest", false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Backtest Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Initial Capital ($)</label>
              <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} min={1000} step={1000} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Position Sizing</label>
              <Select value={sizing} onValueChange={setSizing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed (100%)</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="kelly">Kelly Criterion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sizing === "percentage" && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Position %</span><span>{(pct * 100).toFixed(0)}%</span></div>
                <Slider min={0.1} max={1} step={0.05} value={[pct]} onValueChange={([v]) => setPct(v)} />
              </div>
            )}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Commission</span><span>{commission.toFixed(1)}%</span></div>
              <Slider min={0} max={1} step={0.05} value={[commission]} onValueChange={([v]) => setCommission(v)} />
            </div>
          </div>
          <Button onClick={run} className="mt-4 w-full">Run Backtest</Button>
        </CardContent>
      </Card>

      {tradeStats && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <KPICard label="Total Return" value={fmt(tradeStats.total_return, { pct: true })} deltaType={tradeStats.total_return > 0 ? "positive" : "negative"} />
            <KPICard label="Ann. Return" value={fmt(tradeStats.annualized_return, { pct: true })} />
            <KPICard label="Max Drawdown" value={fmt(tradeStats.max_drawdown, { pct: true })} deltaType="negative" />
            <KPICard label="Win Rate" value={fmt(tradeStats.win_rate, { pct: true })} />
            <KPICard label="Profit Factor" value={fmt(tradeStats.profit_factor)} />
            <KPICard label="Sharpe" value={fmt(tradeStats.sharpe_ratio)} />
          </div>
          <EquityCurve portfolio={portfolio} benchmark={benchmarkPortfolio} />
          {trades.length > 0 && <TradeTable trades={trades} />}
        </>
      )}
    </div>
  );
}
