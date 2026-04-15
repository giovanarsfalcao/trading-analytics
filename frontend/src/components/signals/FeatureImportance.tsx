"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";

interface Props {
  importance: Record<string, number>;
}

const COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f97316", "#22c55e", "#06b6d4"];

export function FeatureImportance({ importance }: Props) {
  const data = Object.entries(importance)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value * 1000) / 1000 }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Feature Importance</p>
        <span className="text-[10px] text-muted-foreground">Relative contribution of each input feature</span>
      </div>
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 16, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.toFixed(3)} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} width={90} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [Number(v ?? 0).toFixed(4), "Importance"]}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
