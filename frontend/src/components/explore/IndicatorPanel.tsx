"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, BarChart, Bar, CartesianGrid } from "recharts";
import type { IndicatorPoint } from "@/types";

interface Props {
  name: string;
  data: Record<string, IndicatorPoint[]>;
}

const COLORS = ["#3b82f6", "#f97316", "#a855f7", "#06b6d4", "#ec4899"];

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
};

export function IndicatorPanel({ name, data }: Props) {
  if (name === "MACD") return <MACDChart data={data} />;
  if (name === "RSI") return <BandChart data={data} cols={["RSI"]} upper={70} lower={30} label="RSI" />;
  if (name === "MFI") return <BandChart data={data} cols={["MFI"]} upper={80} lower={20} label="MFI" />;
  if (name === "Bollinger Bands") return <MultiLineChart data={data} cols={["BB_Upper", "BB_Middle", "BB_Lower"]} label="Bollinger Bands" />;
  return null;
}

function MACDChart({ data }: { data: Record<string, IndicatorPoint[]> }) {
  const macd = data["MACD"] || [];
  const signal = data["MACD_Signal"] || [];
  const hist = data["MACD_HIST"] || [];

  const merged = macd.map((p, i) => ({
    date: p.date.split("T")[0],
    MACD: p.value,
    Signal: signal[i]?.value,
    Hist: hist[i]?.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="Hist" fill="#3b82f6" opacity={0.6} />
        <Line type="monotone" dataKey="MACD" stroke="#22c55e" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="Signal" stroke="#f97316" strokeWidth={1.5} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BandChart({ data, cols, upper, lower }: { data: Record<string, IndicatorPoint[]>; cols: string[]; upper: number; lower: number; label: string }) {
  const primary = data[cols[0]] || [];
  const merged = primary.map((p, i) => {
    const row: Record<string, string | number> = { date: p.date.split("T")[0] };
    cols.forEach((c) => { row[c] = data[c]?.[i]?.value ?? 0; });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
        <Tooltip {...tooltipStyle} />
        <ReferenceLine y={upper} stroke="#ef4444" strokeDasharray="4 4" opacity={0.5} />
        <ReferenceLine y={lower} stroke="#22c55e" strokeDasharray="4 4" opacity={0.5} />
        {cols.map((c, i) => (
          <Line key={c} type="monotone" dataKey={c} stroke={COLORS[i]} strokeWidth={1.5} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function SimpleLineChart({ data, col }: { data: Record<string, IndicatorPoint[]>; col: string }) {
  const points = (data[col] || []).map((p) => ({ date: p.date.split("T")[0], value: p.value }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MultiLineChart({ data, cols }: { data: Record<string, IndicatorPoint[]>; cols: string[]; label: string }) {
  const primary = data[cols[0]] || [];
  const merged = primary.map((p, i) => {
    const row: Record<string, string | number> = { date: p.date.split("T")[0] };
    cols.forEach((c) => { row[c] = data[c]?.[i]?.value ?? 0; });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
        <Tooltip {...tooltipStyle} />
        {cols.map((c, i) => (
          <Line key={c} type="monotone" dataKey={c} stroke={COLORS[i]} strokeWidth={1.5} dot={false} strokeDasharray={i !== 1 ? "4 4" : undefined} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
