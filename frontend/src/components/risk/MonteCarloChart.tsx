"use client";

import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { KPICard, fmt } from "@/components/shared/KPICard";
import type { MonteCarloResult } from "@/types";

interface Props {
  result: MonteCarloResult;
  initialCapital: number;
}

export function MonteCarloChart({ result, initialCapital }: Props) {
  const p05 = result.percentiles.find((p) => p.level === 0.05)?.values || [];
  const p95 = result.percentiles.find((p) => p.level === 0.95)?.values || [];
  const median = result.median_path;

  const data = median.map((v, i) => ({
    day: i + 1,
    median: v,
    p05: p05[i],
    p95: p95[i],
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#71717a" }} label={{ value: "Trading Days", position: "insideBottom", offset: -5, style: { fontSize: 11, fill: "#71717a" } }} />
          <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#71717a" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`$${Number(v ?? 0).toFixed(0)}`]}
            labelFormatter={(l) => `Day ${l}`}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Area type="monotone" dataKey="p95" stroke="none" fill="rgba(59,130,246,0.1)" />
          <Area type="monotone" dataKey="p05" stroke="none" fill="var(--background)" />
          <Line type="monotone" dataKey="median" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <ReferenceLine y={initialCapital} stroke="#ef4444" strokeDasharray="4 4" opacity={0.5} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <KPICard label="P(Loss)" value={fmt(result.probability_of_loss, { pct: true })} deltaType={result.probability_of_loss > 0.5 ? "negative" : "positive"} />
        <KPICard label="Expected" value={`$${result.expected_value.toFixed(0)}`} />
        <KPICard label="Median" value={`$${result.median_value.toFixed(0)}`} />
        <KPICard label="Best Case (95th)" value={`$${result.best_case.toFixed(0)}`} />
        <KPICard label="Worst Case (5th)" value={`$${result.worst_case.toFixed(0)}`} />
        <KPICard label="Initial" value={`$${initialCapital.toFixed(0)}`} />
      </div>
    </div>
  );
}
