"use client";

import { useRef } from "react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { KPICard, fmt } from "@/components/shared/KPICard";
import type { MonteCarloResult } from "@/types";

interface Props {
  result: MonteCarloResult;
  initialCapital: number;
}

function downloadChartAsPng(containerRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  const svg = containerRef.current?.querySelector("svg");
  if (!svg) return;
  const { width, height } = svg.getBoundingClientRect();
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  canvas.width = width || 800;
  canvas.height = height || 400;
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
}

function computeHistogramBins(values: number[], nBins: number): Array<{ bin: number; count: number }> {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [];
  const width = (max - min) / nBins;
  const counts = new Array(nBins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), nBins - 1);
    counts[idx]++;
  }
  return counts.map((count, i) => ({ bin: min + (i + 0.5) * width, count }));
}

export function MonteCarloChart({ result, initialCapital }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const p05 = result.percentiles.find((p) => p.level === 0.05)?.values || [];
  const p95 = result.percentiles.find((p) => p.level === 0.95)?.values || [];
  const median = result.median_path;

  const data = median.map((v, i) => ({
    day: i + 1,
    median: v,
    p05: p05[i],
    p95: p95[i],
  }));

  const pnlBins = computeHistogramBins(result.final_values_histogram, 25);
  const ddBins = result.max_drawdown_distribution ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Monte Carlo Simulation</p>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">Portfolio paths · median, 5th and 95th percentiles</span>
          <button
            onClick={() => downloadChartAsPng(containerRef, "monte-carlo.png")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted"
          >
            Save PNG
          </button>
        </div>
      </div>
      <div ref={containerRef}>
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
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <KPICard label="P(Loss)" value={fmt(result.probability_of_loss, { pct: true })} deltaType={result.probability_of_loss > 0.5 ? "negative" : "positive"} />
        <KPICard label="Expected" value={`$${result.expected_value.toFixed(0)}`} />
        <KPICard label="Median" value={`$${result.median_value.toFixed(0)}`} />
        <KPICard label="Best Case (95th)" value={`$${result.best_case.toFixed(0)}`} />
        <KPICard label="Worst Case (5th)" value={`$${result.worst_case.toFixed(0)}`} />
        <KPICard label="Initial" value={`$${initialCapital.toFixed(0)}`} />
      </div>

      {pnlBins.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Final PnL Distribution</p>
            <span className="text-[10px] text-muted-foreground">Frequency of simulated ending portfolio values</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pnlBins} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="bin" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#71717a" }} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                formatter={(v, _name, props) => [v, "Simulations"]}
                labelFormatter={(v) => `~$${Number(v).toFixed(0)}`}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <ReferenceLine x={initialCapital} stroke="#ef4444" strokeDasharray="4 4" opacity={0.6} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {pnlBins.map((entry, i) => (
                  <Cell key={i} fill={entry.bin >= initialCapital ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {ddBins.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Max Drawdown Distribution</p>
            <span className="text-[10px] text-muted-foreground">Worst peak-to-trough decline across simulations</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ddBins} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="bin" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 10, fill: "#71717a" }} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [v, "Simulations"]}
                labelFormatter={(v) => `~${Number(v).toFixed(1)}%`}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Bar dataKey="count" fill="rgba(239,68,68,0.65)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
