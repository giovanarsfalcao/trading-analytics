"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import type { SignalPoint } from "@/types";

interface Props {
  signals: SignalPoint[];
}

export function SignalChart({ signals }: Props) {
  const data = signals.map((s) => ({
    date: s.date.split("T")[0],
    price: s.price,
    buy: s.signal === 1 ? s.price : undefined,
    sell: s.signal === -1 ? s.price : undefined,
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Buy / Sell Signals</p>
        <span className="text-[10px] text-muted-foreground">Price with entry and exit markers</span>
      </div>
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1c1c2e",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
          formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`]}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="Price"
        />
        <Scatter
          dataKey="buy"
          fill="#22c55e"
          shape="triangle"
          name="Buy"
        />
        <Scatter
          dataKey="sell"
          fill="#ef4444"
          shape="triangle"
          name="Sell"
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}
