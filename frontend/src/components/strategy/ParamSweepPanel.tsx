"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";
import type { StrategyRegistry } from "@/types";

interface SweepResult {
  param_value: number;
  total_return?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  win_rate?: number;
  total_trades?: number;
  error?: string;
}

export function ParamSweepPanel() {
  const { ticker, period } = useStore();
  const [registry, setRegistry] = useState<StrategyRegistry>({});
  const [stratName, setStratName] = useState("");
  const [paramName, setParamName] = useState("");
  const [start, setStart] = useState(5);
  const [end, setEnd] = useState(50);
  const [step, setStep] = useState(5);
  const [results, setResults] = useState<SweepResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.strategies().then((r) => {
      setRegistry(r);
      const first = Object.keys(r)[0];
      if (first) {
        setStratName(first);
        const firstParam = Object.keys(r[first])[0];
        if (firstParam) {
          setParamName(firstParam);
          const spec = r[first][firstParam];
          setStart(spec.min);
          setEnd(spec.max);
          setStep(spec.max > 10 ? Math.round((spec.max - spec.min) / 10) : 1);
        }
      }
    });
  }, []);

  function onStrategyChange(name: string) {
    setStratName(name);
    const firstParam = Object.keys(registry[name] || {})[0];
    if (firstParam) {
      setParamName(firstParam);
      const spec = registry[name][firstParam];
      setStart(spec.min);
      setEnd(spec.max);
      setStep(spec.max > 10 ? Math.round((spec.max - spec.min) / 10) : 1);
    }
  }

  function onParamChange(name: string) {
    setParamName(name);
    const spec = registry[stratName]?.[name];
    if (spec) {
      setStart(spec.min);
      setEnd(spec.max);
      setStep(spec.max > 10 ? Math.round((spec.max - spec.min) / 10) : 1);
    }
  }

  async function runSweep() {
    if (!ticker || !stratName || !paramName) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const values: number[] = [];
      for (let v = start; v <= end; v += step) values.push(v);
      if (values.length === 0 || values.length > 50) {
        setError(values.length === 0 ? "No values in range" : "Too many values (max 50). Increase step size.");
        return;
      }
      // Build base params with defaults for non-swept params
      const baseParams: Record<string, number> = {};
      Object.entries(registry[stratName] || {}).forEach(([k, spec]) => {
        if (k !== paramName) baseParams[k] = spec.default;
      });

      const res = await api.paramSweep({
        ticker, period,
        strategy_name: stratName,
        param_name: paramName,
        param_values: values,
        base_params: baseParams,
      }) as { results: SweepResult[] };
      setResults(res.results.filter((r) => !r.error));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sweep failed");
    } finally {
      setLoading(false);
    }
  }

  const params = Object.keys(registry[stratName] || {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Parameter Sweep</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Strategy</label>
            <Select value={stratName} onValueChange={onStrategyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(registry).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Parameter</label>
            <Select value={paramName} onValueChange={onParamChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {params.map((p) => <SelectItem key={p} value={p}>{registry[stratName][p].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Start</label>
            <Input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">End</label>
            <Input type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Step</label>
            <Input type="number" value={step} onChange={(e) => setStep(Number(e.target.value))} className="h-8 text-xs" />
          </div>
        </div>

        <Button onClick={runSweep} disabled={loading || !ticker} className="w-full">
          {loading ? "Running Sweep..." : "Run Parameter Sweep"}
        </Button>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {results.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={results}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="param_value" tick={{ fontSize: 10, fill: "#71717a" }}
                  label={{ value: paramName, position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "#71717a" } }}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(l) => `${paramName} = ${l}`}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="sharpe_ratio" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Sharpe" />
                <Line yAxisId="right" type="monotone" dataKey="total_return" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Total Return" />
              </LineChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-muted-foreground font-medium">{paramName}</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Sharpe</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Return</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Max DD</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Win Rate</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const best = results.reduce((a, b) => (a.sharpe_ratio ?? 0) > (b.sharpe_ratio ?? 0) ? a : b);
                    const isBest = r === best;
                    return (
                      <tr key={r.param_value} className={`border-b border-border/50 ${isBest ? "bg-blue-500/5" : ""}`}>
                        <td className="py-1.5 pr-3 font-mono font-medium">{r.param_value}</td>
                        <td className="text-right py-1.5 px-2 font-mono">{fmt(r.sharpe_ratio ?? 0)}</td>
                        <td className={`text-right py-1.5 px-2 font-mono ${(r.total_return ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(r.total_return ?? 0, { pct: true })}
                        </td>
                        <td className="text-right py-1.5 px-2 font-mono text-red-400">{fmt(r.max_drawdown ?? 0, { pct: true })}</td>
                        <td className="text-right py-1.5 px-2 font-mono">{fmt(r.win_rate ?? 0, { pct: true })}</td>
                        <td className="text-right py-1.5 px-2 font-mono">{r.total_trades ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
