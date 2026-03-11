"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import type { SignalPoint } from "@/types";

interface Props {
  signals: SignalPoint[];
}

function SignalTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;

  const signal = payload.find((p) => p.dataKey !== "price" && p.value != null);
  const price = payload.find((p) => p.dataKey === "price");

  const signalLabel = signal?.name ?? "Price";
  const signalColor =
    signal?.dataKey === "buy" ? "#22c55e" :
    signal?.dataKey === "sell" ? "#ef4444" :
    signal?.dataKey === "hold" ? "#a1a1aa" : "#3b82f6";
  const displayPrice = signal?.value ?? price?.value;

  return (
    <div style={{ background: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#a1a1aa", marginBottom: 4 }}>{label}</p>
      <p style={{ color: signalColor, fontWeight: 600 }}>{signalLabel}</p>
      <p style={{ color: "#e4e4e7", fontFamily: "monospace" }}>${Number(displayPrice ?? 0).toFixed(2)}</p>
    </div>
  );
}

export function SignalChart({ signals }: Props) {
  const data = signals.map((s) => ({
    date: s.date.split("T")[0],
    price: s.price,
    buy: s.signal === 1 ? s.price : undefined,
    sell: s.signal === -1 ? s.price : undefined,
    hold: s.signal !== 1 && s.signal !== -1 ? s.price : undefined,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} domain={["auto", "auto"]} />
        <Tooltip content={<SignalTooltip />} />
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
        <Scatter
          dataKey="hold"
          fill="#a1a1aa"
          shape="circle"
          name="Hold"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
