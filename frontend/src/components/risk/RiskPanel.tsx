"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard, fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";
import { MonteCarloChart } from "./MonteCarloChart";

const HORIZONS = [
  { label: "3 Months", days: 63 },
  { label: "6 Months", days: 126 },
  { label: "1 Year", days: 252 },
];

export function RiskPanel() {
  const { dailyReturns, portfolio, benchmarkPortfolio, initialCapital, riskMetrics, monteCarloResult, setRiskData, setMonteCarloData, setLoading, setError } = useStore();
  const [nSims, setNSims] = useState(1000);
  const [horizon, setHorizon] = useState(252);
  const [mcMethod, setMcMethod] = useState("gbm");

  async function loadRisk() {
    setLoading("risk", true);
    setError(null);
    try {
      const benchReturns = benchmarkPortfolio.length > 1
        ? benchmarkPortfolio.slice(1).map((p, i) => (p.value - benchmarkPortfolio[i].value) / benchmarkPortfolio[i].value)
        : [];
      const res = await api.risk({
        daily_returns: dailyReturns,
        portfolio_values: portfolio.map((p) => p.value),
        portfolio_dates: portfolio.map((p) => p.date),
        benchmark_returns: benchReturns,
      }) as any;
      setRiskData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Risk calculation failed");
    } finally {
      setLoading("risk", false);
    }
  }

  async function runMC() {
    setLoading("montecarlo", true);
    setError(null);
    try {
      const res = await api.monteCarlo({
        daily_returns: dailyReturns,
        initial_capital: initialCapital,
        n_simulations: nSims,
        n_days: horizon,
        method: mcMethod,
      }) as any;
      setMonteCarloData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monte Carlo failed");
    } finally {
      setLoading("montecarlo", false);
    }
  }

  if (!riskMetrics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Calculate risk metrics for your backtest results</p>
        <Button onClick={loadRisk}>Calculate Risk Metrics</Button>
      </div>
    );
  }

  const m = riskMetrics;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <KPICard label="Sharpe" value={fmt(m.sharpe_ratio)} deltaType={m.sharpe_ratio > 1 ? "positive" : m.sharpe_ratio < 0 ? "negative" : "neutral"} />
        <KPICard label="Sortino" value={fmt(m.sortino_ratio)} />
        <KPICard label="Max Drawdown" value={fmt(m.max_drawdown, { pct: true })} deltaType="negative" />
        <KPICard label="VaR 95%" value={fmt(m.var_95, { pct: true })} />
        <KPICard label="CVaR 95%" value={fmt(m.cvar_95, { pct: true })} />
        <KPICard label="Calmar" value={fmt(m.calmar_ratio)} />
      </div>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        <KPICard label="Ann. Return" value={fmt(m.annualized_return, { pct: true })} />
        <KPICard label="Ann. Volatility" value={fmt(m.annualized_volatility, { pct: true })} />
        {m.beta != null && <KPICard label="Beta" value={fmt(m.beta)} />}
        {m.alpha != null && <KPICard label="Alpha" value={fmt(m.alpha, { pct: true })} />}
        {m.information_ratio != null && <KPICard label="Info Ratio" value={fmt(m.information_ratio)} />}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Monte Carlo Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Simulations</span><span>{nSims}</span></div>
              <Slider min={500} max={5000} step={100} value={[nSims]} onValueChange={([v]) => setNSims(v)} className="w-48" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Horizon</label>
              <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HORIZONS.map((h) => <SelectItem key={h.days} value={String(h.days)}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Method</label>
              <Select value={mcMethod} onValueChange={setMcMethod}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gbm">GBM (Normal)</SelectItem>
                  <SelectItem value="bootstrap">Bootstrap (Historical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runMC}>Run Simulation</Button>
          </div>
          {monteCarloResult && <MonteCarloChart result={monteCarloResult} initialCapital={initialCapital} />}
        </CardContent>
      </Card>
    </div>
  );
}
