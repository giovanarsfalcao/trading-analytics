"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { KPICard, fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import { EquityCurve } from "@/components/backtest/EquityCurve";

export function ReportPanel() {
  const { ticker, strategyName, period, tradeStats, riskMetrics, portfolio, benchmarkPortfolio, trades, completedStages } = useStore();
  const [minSharpe, setMinSharpe] = useState(1.0);
  const [maxDD, setMaxDD] = useState(-20);
  const [minWinRate, setMinWinRate] = useState(50);

  const allComplete = [1, 2, 3, 4].every((s) => completedStages.includes(s));

  if (!allComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Complete all stages to generate report</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <Badge key={s} variant={completedStages.includes(s) ? "default" : "outline"}>
              Stage {s} {completedStages.includes(s) ? "Done" : "Pending"}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  const ts = tradeStats!;
  const rm = riskMetrics!;

  const checks = [
    { label: `Sharpe > ${minSharpe}`, pass: rm.sharpe_ratio > minSharpe },
    { label: `Max DD > ${maxDD}%`, pass: rm.max_drawdown * 100 > maxDD },
    { label: `Win Rate > ${minWinRate}%`, pass: ts.win_rate * 100 > minWinRate },
  ];
  const score = checks.filter((c) => c.pass).length;
  const verdict = score === 3 ? "Strong" : score >= 1 ? "Moderate" : "Weak";
  const verdictColor = score === 3 ? "text-emerald-400" : score >= 1 ? "text-yellow-400" : "text-red-400";

  function downloadCsv(data: Record<string, unknown>[], filename: string) {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map((row) => keys.map((k) => row[k]).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ticker</p><p className="text-xl font-bold font-mono">{ticker}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Strategy</p><p className="text-xl font-bold">{strategyName}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Period</p><p className="text-xl font-bold">{portfolio[0]?.date.split("T")[0]} - {portfolio[portfolio.length-1]?.date.split("T")[0]}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <KPICard label="Total Return" value={fmt(ts.total_return, { pct: true })} />
        <KPICard label="Sharpe" value={fmt(rm.sharpe_ratio)} />
        <KPICard label="Max Drawdown" value={fmt(rm.max_drawdown, { pct: true })} />
        <KPICard label="Win Rate" value={fmt(ts.win_rate, { pct: true })} />
        <KPICard label="Profit Factor" value={fmt(ts.profit_factor)} />
        <KPICard label="Total Trades" value={String(ts.total_trades)} />
      </div>

      <EquityCurve portfolio={portfolio} benchmark={benchmarkPortfolio} />

      <Separator />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min Sharpe</label>
              <Input type="number" value={minSharpe} step={0.1} onChange={(e) => setMinSharpe(Number(e.target.value))} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Drawdown (%)</label>
              <Input type="number" value={maxDD} step={1} max={0} onChange={(e) => setMaxDD(Number(e.target.value))} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min Win Rate (%)</label>
              <Input type="number" value={minWinRate} step={1} min={0} max={100} onChange={(e) => setMinWinRate(Number(e.target.value))} className="h-7 text-xs" />
            </div>
          </div>
          <div className="flex gap-6">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className={c.pass ? "text-emerald-400" : "text-red-400"}>{c.pass ? "Pass" : "Fail"}</span>
                <span className="text-sm text-muted-foreground">{c.label}</span>
              </div>
            ))}
          </div>
          <p className={`text-lg font-semibold ${verdictColor}`}>
            Overall: {verdict} ({score}/3)
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => downloadCsv(trades as any, `${ticker}_${strategyName}_trades.csv`)}>
          Download Trades CSV
        </Button>
        <Button variant="outline" onClick={() => downloadCsv([{ ...ts, ...rm } as any], `${ticker}_${strategyName}_metrics.csv`)}>
          Download Metrics CSV
        </Button>
      </div>
    </div>
  );
}
