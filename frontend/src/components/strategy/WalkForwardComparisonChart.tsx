"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceArea,
} from "recharts";
import type { SignalPoint, OHLCVRow } from "@/types";

interface FoldResult {
  fold: number;
  test_start: string;
  test_end: string;
  accuracy?: number;
  f1?: number;
}

interface Props {
  wfSignals: SignalPoint[];
  baseSignals: SignalPoint[];
  ohlcv: OHLCVRow[];
  folds: FoldResult[];
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

export function WalkForwardComparisonChart({ wfSignals, baseSignals, ohlcv, folds }: Props) {
  if (!ohlcv || ohlcv.length < 2 || !wfSignals || wfSignals.length === 0) return null;

  // Build close price lookup
  const closeByDate: Record<string, number> = {};
  for (const row of ohlcv) {
    closeByDate[row.date.split("T")[0]] = row.close;
  }

  // Compute cumulative returns series for a set of signals
  function computeCumReturn(signals: SignalPoint[]): Record<string, number> {
    const byDate: Record<string, number> = {};
    for (const s of signals) {
      byDate[s.date.split("T")[0]] = s.signal;
    }
    const dates = ohlcv.map((r) => r.date.split("T")[0]);
    let cum = 1;
    const result: Record<string, number> = {};
    for (let i = 1; i < dates.length; i++) {
      const d = dates[i];
      const prev = dates[i - 1];
      const close = closeByDate[d];
      const prevClose = closeByDate[prev];
      if (close == null || prevClose == null || prevClose === 0) {
        result[d] = cum;
        continue;
      }
      const dailyRet = (close - prevClose) / prevClose;
      const sig = byDate[prev] ?? 0; // use previous day's signal
      cum *= 1 + sig * dailyRet;
      result[d] = cum;
    }
    return result;
  }

  const wfCum = computeCumReturn(wfSignals);
  const baseCum = baseSignals.length > 0 ? computeCumReturn(baseSignals) : null;

  // Buy & Hold cumulative
  const bhCum: Record<string, number> = {};
  let bh = 1;
  for (let i = 1; i < ohlcv.length; i++) {
    const d = ohlcv[i].date.split("T")[0];
    const prev = ohlcv[i - 1];
    if (prev.close > 0) bh *= ohlcv[i].close / prev.close;
    bhCum[d] = bh;
  }

  // Build chart data — dates covered by WF signals (test periods)
  const wfDates = new Set(wfSignals.map((s) => s.date.split("T")[0]));
  const chartData = ohlcv
    .slice(1)
    .filter((r) => {
      const d = r.date.split("T")[0];
      return wfCum[d] != null || bhCum[d] != null;
    })
    .map((r) => {
      const d = r.date.split("T")[0];
      return {
        date: d,
        "Walk-Forward": wfDates.has(d) && wfCum[d] != null ? +((wfCum[d] - 1) * 100).toFixed(2) : undefined,
        "Base ML": baseCum && baseCum[d] != null ? +((baseCum[d] - 1) * 100).toFixed(2) : undefined,
        "Buy & Hold": bhCum[d] != null ? +((bhCum[d] - 1) * 100).toFixed(2) : undefined,
      };
    });

  if (chartData.length === 0) return null;

  // Date range for ReferenceArea clamping
  const firstDate = chartData[0].date;
  const lastDate = chartData[chartData.length - 1].date;

  function clamp(d: string) {
    return d < firstDate ? firstDate : d > lastDate ? lastDate : d;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Cumulative Return Comparison</span>
        <span className="text-[10px]">OOS periods shaded</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

          {folds.map((fold) => (
            <ReferenceArea
              key={fold.fold}
              x1={clamp(fold.test_start.split("T")[0])}
              x2={clamp(fold.test_end.split("T")[0])}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2 2"
              label={{ value: `F${fold.fold}`, position: "insideTopLeft", fontSize: 9, fill: "#52525b" }}
            />
          ))}

          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
          />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: unknown, name: unknown) => { const n = v as number; return [`${n > 0 ? "+" : ""}${n.toFixed(2)}%`, name as string]; }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          <Line
            type="monotone"
            dataKey="Buy & Hold"
            stroke="#52525b"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 4"
            isAnimationActive={false}
            connectNulls
          />
          {baseCum && (
            <Line
              type="monotone"
              dataKey="Base ML"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            type="monotone"
            dataKey="Walk-Forward"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {folds.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          Walk-Forward generates signals only during OOS (shaded) periods — each fold trains on
          preceding bars and tests on the next window. Base ML uses a single 80/20 split.
        </p>
      )}
    </div>
  );
}
