"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard, fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";
import { EquityCurve } from "./EquityCurve";
import { DrawdownChart } from "./DrawdownChart";
import { TradeTable } from "./TradeTable";
import { ComparisonPanel } from "./ComparisonPanel";
import { AnnualReturnsTable } from "./AnnualReturnsTable";

const BENCHMARKS = [
  { label: "S&P 500", value: "^GSPC" },
  { label: "NASDAQ-100", value: "QQQ" },
  { label: "Russell 2000", value: "IWM" },
  { label: "No Benchmark", value: "none" },
];

export function BacktestPanel() {
  const store = useStore();
  const {
    ticker, period, strategyName, strategyParams,
    tradeStats, portfolio, benchmarkPortfolio, trades,
    comparisonResults, setBacktestData, addComparison, setLoading, setError,
  } = store;
  const [capital, setCapital] = useState(10000);
  const [sizing, setSizing] = useState("fixed");
  const [pct, setPct] = useState(1.0);
  const [commission, setCommission] = useState(0.1);
  const [slippage, setSlippage] = useState(0);
  const [spread, setSpread] = useState(0);
  const [kellyFraction, setKellyFraction] = useState(0.5);
  const [benchmark, setBenchmark] = useState("^GSPC");

  async function run() {
    if (!ticker || !strategyName) return;
    setLoading("backtest", true);
    setError(null);
    try {
      const isML = strategyName.startsWith("ML:") || strategyName.startsWith("Walk-Forward:");
      const isWF = strategyName.startsWith("Walk-Forward:");
      const res = await api.backtest({
        ticker, period,
        strategy_name: strategyName,
        params: isML ? {} : strategyParams as Record<string, number>,
        model_type: isML ? (strategyParams as any).model_type : undefined,
        features: isML ? (strategyParams as any).features : undefined,
        train_ratio: isML && !isWF ? (strategyParams as any).train_ratio : undefined,
        threshold: isML ? (strategyParams as any).threshold : undefined,
        target_shift: isML ? (strategyParams as any).target_shift : undefined,
        is_walk_forward: isWF || undefined,
        train_window: isWF ? (strategyParams as any).train_window : undefined,
        wf_step: isWF ? (strategyParams as any).wf_step : undefined,
        initial_capital: capital,
        position_size: sizing,
        position_pct: pct,
        commission: commission / 100,
        slippage: slippage / 100,
        spread: spread / 100,
        kelly_fraction: kellyFraction,
        benchmark: benchmark !== "none" ? benchmark : undefined,
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

  function handleAddToComparison() {
    if (!tradeStats || !portfolio || !strategyName) return;
    const label = `${strategyName} (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
    addComparison({ label, strategyName, portfolio, tradeStats });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Backtest Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Benchmark</label>
              <Select value={benchmark} onValueChange={setBenchmark}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BENCHMARKS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Commission</span><span>{commission.toFixed(2)}%</span></div>
              <Slider min={0} max={1} step={0.05} value={[commission]} onValueChange={([v]) => setCommission(v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            {sizing === "percentage" && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Position %</span><span>{(pct * 100).toFixed(0)}%</span></div>
                <Slider min={0.1} max={1} step={0.05} value={[pct]} onValueChange={([v]) => setPct(v)} />
              </div>
            )}
            {sizing === "kelly" && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Kelly Fraction</span><span>{kellyFraction.toFixed(1)}×</span></div>
                <Slider min={0.1} max={1} step={0.1} value={[kellyFraction]} onValueChange={([v]) => setKellyFraction(v)} />
              </div>
            )}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Slippage</span><span>{slippage.toFixed(2)}%</span></div>
              <Slider min={0} max={0.5} step={0.05} value={[slippage]} onValueChange={([v]) => setSlippage(v)} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Bid-Ask Spread</span><span>{spread.toFixed(2)}%</span></div>
              <Slider min={0} max={0.5} step={0.05} value={[spread]} onValueChange={([v]) => setSpread(v)} />
            </div>
          </div>

          <Button onClick={run} className="w-full">Run Backtest</Button>
        </CardContent>
      </Card>

      {tradeStats && (
        <Tabs defaultValue="results">
          <div className="flex items-center justify-between mb-3">
            <TabsList>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="comparison">
                Comparison {comparisonResults.length > 0 && `(${comparisonResults.length})`}
              </TabsTrigger>
            </TabsList>
            <Button size="sm" variant="outline" onClick={handleAddToComparison}>
              + Add to Comparison
            </Button>
          </div>

          <TabsContent value="results" className="space-y-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <KPICard label="Total Return" value={fmt(tradeStats.total_return, { pct: true })} deltaType={tradeStats.total_return > 0 ? "positive" : "negative"} />
              <KPICard label="Ann. Return" value={fmt(tradeStats.annualized_return, { pct: true })} />
              <KPICard label="Max Drawdown" value={fmt(tradeStats.max_drawdown, { pct: true })} deltaType="negative" />
              <KPICard label="Win Rate" value={fmt(tradeStats.win_rate, { pct: true })} />
              <KPICard label="Profit Factor" value={fmt(tradeStats.profit_factor)} />
              <KPICard label="Sharpe" value={fmt(tradeStats.sharpe_ratio)} />
            </div>
            <EquityCurve portfolio={portfolio} benchmark={benchmarkPortfolio} />
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Drawdown</h3>
              <DrawdownChart portfolio={portfolio} />
            </div>
            {tradeStats.annual_returns && tradeStats.annual_returns.length > 0 && (
              <AnnualReturnsTable data={tradeStats.annual_returns} />
            )}
            {trades.length > 0 && <TradeTable trades={trades} />}
          </TabsContent>

          <TabsContent value="comparison">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Strategy Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ComparisonPanel />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
