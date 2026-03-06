"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import type { PortfolioPoint } from "@/types";

interface Props {
  portfolio: PortfolioPoint[];
}

export function DrawdownChart({ portfolio }: Props) {
  let peak = portfolio[0]?.value ?? 0;
  const data = portfolio.map((p) => {
    if (p.value > peak) peak = p.value;
    const drawdown = peak > 0 ? ((p.value / peak) - 1) * 100 : 0;
    return { date: p.date.split("T")[0], drawdown };
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(2, 7)} />
        <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10, fill: "#71717a" }} domain={["auto", 0]} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${Number(v ?? 0).toFixed(2)}%`, "Drawdown"]}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
        <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="rgba(239,68,68,0.15)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
