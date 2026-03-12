"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { OHLCVRow, IndicatorPoint } from "@/types";

interface Props {
  ohlcv: OHLCVRow[];
  indicators: Record<string, IndicatorPoint[]>;
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#1c1c2e",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    fontSize: 11,
  },
  labelStyle: { color: "#a1a1aa" },
};

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function MarketStatsPanel({ ohlcv, indicators }: Props) {
  if (!ohlcv || ohlcv.length === 0) return null;

  // --- Volume chart: daily volume bars + 20-day MA line ---
  const volumeMA = computeRollingMean(ohlcv.map((r) => r.volume), 20);
  const volumeData = ohlcv.map((r, i) => ({
    date: r.date.split("T")[0],
    Volume: r.volume,
    "Vol MA (20)": volumeMA[i] ?? null,
    positive: r.close >= r.open,
  }));

  // --- Historical Volatility: from indicators or computed client-side ---
  const hvData = (() => {
    const hv = indicators["HV_20"];
    if (hv && hv.length > 0) {
      return hv.map((p) => ({ date: p.date.split("T")[0], "HV 20d (ann.)": +(p.value * 100).toFixed(2) }));
    }
    // fallback: compute from ohlcv
    const logRets = ohlcv.map((r, i) => (i === 0 ? null : Math.log(r.close / ohlcv[i - 1].close)));
    const rolling = computeRollingStd(logRets.map((v) => v ?? NaN), 20);
    return ohlcv.map((r, i) => ({
      date: r.date.split("T")[0],
      "HV 20d (ann.)": rolling[i] != null ? +(rolling[i]! * Math.sqrt(252) * 100).toFixed(2) : null,
    }));
  })();

  // --- ATR ---
  const atrSeries = indicators["ATR"] || [];
  const atrData = atrSeries.map((p) => ({ date: p.date.split("T")[0], ATR: +p.value.toFixed(4) }));

  // --- Rolling Returns: 5d, 20d, 60d ---
  const rollingData = ohlcv.map((r, i) => ({
    date: r.date.split("T")[0],
    "5d": i >= 5 ? +((r.close / ohlcv[i - 5].close - 1) * 100).toFixed(2) : null,
    "20d": i >= 20 ? +((r.close / ohlcv[i - 20].close - 1) * 100).toFixed(2) : null,
    "60d": i >= 60 ? +((r.close / ohlcv[i - 60].close - 1) * 100).toFixed(2) : null,
  }));

  return (
    <div className="space-y-6">
      <ChartCard
        title="Volume"
        description="Daily trading volume vs. 20-day average"
      >
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={volumeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={fmtVol} width={48} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v: unknown) => [fmtVol(v as number), ""]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Volume" isAnimationActive={false} opacity={0.6}>
              {volumeData.map((entry, i) => (
                <Cell key={i} fill={entry.positive ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="Vol MA (20)"
              stroke="#f97316"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Historical Volatility (20d, annualized)"
        description="Rolling standard deviation of log returns × √252 — higher = more volatile"
      >
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={hvData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `${v}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: unknown) => [`${v}%`, "HV 20d"]} />
            <Line
              type="monotone"
              dataKey="HV 20d (ann.)"
              stroke="#a855f7"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {atrData.length > 0 && (
        <ChartCard
          title="ATR — Average True Range"
          description="Measures daily price range volatility. Rising ATR = expanding volatility"
        >
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={atrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
              <Tooltip {...tooltipStyle} />
              <Line
                type="monotone"
                dataKey="ATR"
                stroke="#06b6d4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard
        title="Rolling Returns"
        description="Cumulative price return over the last 5, 20, and 60 trading days (%)"
      >
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={rollingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `${v}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: unknown, name: unknown) => [`${v}%`, name as string]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="5d" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="20d" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="60d" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function computeRollingMean(arr: number[], window: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

function computeRollingStd(arr: number[], window: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1).filter((v) => !isNaN(v));
    if (slice.length < 2) return null;
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    return Math.sqrt(variance);
  });
}
