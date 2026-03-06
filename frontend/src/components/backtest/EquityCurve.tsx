"use client";

import { useRef } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { PortfolioPoint } from "@/types";

interface Props {
  portfolio: PortfolioPoint[];
  benchmark: PortfolioPoint[];
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

export function EquityCurve({ portfolio, benchmark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const merged = portfolio.map((p, i) => ({
    date: p.date.split("T")[0],
    strategy: p.cumulative_return * 100,
    benchmark: benchmark[i]?.cumulative_return != null ? benchmark[i].cumulative_return * 100 : undefined,
  }));

  return (
    <div className="space-y-1">
      <div className="flex justify-end">
        <button
          onClick={() => downloadChartAsPng(containerRef, "equity-curve.png")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted"
        >
          Save PNG
        </button>
      </div>
      <div ref={containerRef}>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(2, 7)} />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: "#71717a" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [`${Number(v ?? 0).toFixed(2)}%`]}
              labelStyle={{ color: "#a1a1aa" }}
            />
            <Area type="monotone" dataKey="strategy" stroke="#3b82f6" fill="rgba(59,130,246,0.08)" strokeWidth={2} name="Strategy" />
            {benchmark.length > 0 && (
              <Area type="monotone" dataKey="benchmark" stroke="#71717a" fill="none" strokeWidth={1.5} strokeDasharray="5 5" name="Benchmark" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
