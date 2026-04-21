"use client";

import { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid,
} from "recharts";
import { IndicatorPanel } from "@/components/explore/IndicatorPanel";
import { MarketStatsPanel } from "@/components/explore/MarketStatsPanel";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";
import type { IndicatorPoint } from "@/types";
import type { IndicatorParams } from "@/components/explore/TickerSearch";

const INDICATORS = ["MACD", "RSI", "Bollinger Bands", "MFI"];

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
};

// ── Quant Charts ────────────────────────────────────────────────

function MomentumChart({ indicators }: { indicators: Record<string, IndicatorPoint[]> }) {
  const m21 = indicators["momentum_21d"] || [];
  const m252 = indicators["momentum_252_21d"] || [];
  if (m21.length === 0 && m252.length === 0) return null;

  const longer = m252.length > m21.length ? m252 : m21;
  const merged = longer.map((p, i) => ({
    date: p.date.split("T")[0],
    "21d": m21[i]?.value,
    "252-21d": m252[i]?.value,
  }));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Momentum</p>
        <span className="text-[10px] text-muted-foreground">Short-term (21d) · Long-term (252-21d)</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => v != null ? `${(v * 100).toFixed(1)}%` : ""} />
          <ReferenceLine y={0} stroke="#71717a" strokeDasharray="4 4" opacity={0.5} />
          <Line type="monotone" dataKey="21d" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="252-21d" stroke="#22c55e" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function VolatilityChart({ indicators }: { indicators: Record<string, IndicatorPoint[]> }) {
  const vr = indicators["vol_ratio"] || [];
  const hv = indicators["HV_20"] || [];
  if (vr.length === 0 && hv.length === 0) return null;

  const vrData = vr.map((p) => ({ date: p.date.split("T")[0], value: p.value }));
  const hvData = hv.map((p) => ({ date: p.date.split("T")[0], value: p.value }));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Volatility Ratio</p>
          <span className="text-[10px] text-muted-foreground">5d std / 20d std · above 1 = expanding</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={vrData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
            <Tooltip {...tooltipStyle} />
            <ReferenceLine y={1} stroke="#71717a" strokeDasharray="4 4" opacity={0.5} />
            <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Historical Volatility (20d)</p>
          <span className="text-[10px] text-muted-foreground">Annualized · higher = riskier</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={hvData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip {...tooltipStyle} formatter={(v: number | undefined) => v != null ? `${(v * 100).toFixed(1)}%` : ""} />
            <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AutocorrChart({ indicators }: { indicators: Record<string, IndicatorPoint[]> }) {
  const ac = indicators["autocorr_20"] || [];
  if (ac.length === 0) return null;

  const data = ac.map((p) => ({ date: p.date.split("T")[0], value: p.value }));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Return Autocorrelation (20d)</p>
        <span className="text-[10px] text-muted-foreground">Positive = trending · Negative = mean-reverting</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
          <Tooltip {...tooltipStyle} />
          <ReferenceLine y={0} stroke="#71717a" strokeDasharray="4 4" opacity={0.5} />
          <ReferenceLine y={0.45} stroke="#ef4444" strokeDasharray="4 4" opacity={0.3} />
          <ReferenceLine y={-0.45} stroke="#ef4444" strokeDasharray="4 4" opacity={0.3} />
          <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function IlliquidityChart({ indicators }: { indicators: Record<string, IndicatorPoint[]> }) {
  const il = indicators["illiquidity"] || [];
  if (il.length === 0) return null;

  const data = il.map((p) => ({ date: p.date.split("T")[0], value: p.value }));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Amihud Illiquidity (20d)</p>
        <span className="text-[10px] text-muted-foreground">Price impact per unit volume · higher = harder to trade</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "#71717a" }} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Slider helper ───────────────────────────────────────────────

function SliderField({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const fmt = (v: number) => format ? format(v) : String(v);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono font-medium text-foreground">{fmt(value)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]: number[]) => onChange(v)} />
      <div className="flex justify-between text-[10px] text-muted-foreground/50 font-mono">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

const INDICATOR_PARAMS: Record<string, (params: IndicatorParams, set: <K extends keyof IndicatorParams>(k: K, v: IndicatorParams[K]) => void) => React.ReactNode> = {
  MACD: (p, s) => (
    <div className="grid grid-cols-3 gap-6 mb-4">
      <SliderField label="Fast" value={p.macd_fast} min={5} max={50} step={1} onChange={(v) => s("macd_fast", v)} />
      <SliderField label="Slow" value={p.macd_slow} min={10} max={100} step={1} onChange={(v) => s("macd_slow", v)} />
      <SliderField label="Signal" value={p.macd_signal} min={3} max={30} step={1} onChange={(v) => s("macd_signal", v)} />
    </div>
  ),
  RSI: (p, s) => (
    <div className="grid grid-cols-3 gap-6 mb-4">
      <SliderField label="Period" value={p.rsi_period} min={2} max={50} step={1} onChange={(v) => s("rsi_period", v)} />
    </div>
  ),
  "Bollinger Bands": (p, s) => (
    <div className="grid grid-cols-3 gap-6 mb-4">
      <SliderField label="Period" value={p.bb_period} min={5} max={50} step={1} onChange={(v) => s("bb_period", v)} />
      <SliderField label="Std Dev" value={p.bb_std} min={1} max={3.5} step={0.1} onChange={(v) => s("bb_std", v)} format={(v) => v.toFixed(1)} />
    </div>
  ),
};

// ── Main Panel ──────────────────────────────────────────────────

interface PanelProps {
  indicators: Record<string, IndicatorPoint[]>;
}

export function PriceDerivedPanel({ indicators }: PanelProps) {
  const { ticker, period, interval, ohlcv, setExploreData, setLoading, setError } = useStore();
  const [params, setParams] = useState<IndicatorParams>({
    rsi_period: 14, macd_fast: 12, macd_slow: 26, macd_signal: 9,
    bb_period: 20, bb_std: 2.0, sma_fast: 20, sma_medium: 50, sma_slow: 200,
  });
  const isFirstRender = useRef(true);

  const set = <K extends keyof IndicatorParams>(key: K, val: IndicatorParams[K]) =>
    setParams((prev: IndicatorParams) => ({ ...prev, [key]: val }));

  // Re-fetch indicators when tech indicator params change
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!ticker) return;
    const timer = setTimeout(async () => {
      setLoading("explore", true);
      try {
        const data = await api.explore(ticker, period, interval, params) as {
          ticker: string; ohlcv: []; indicators: Record<string, []>; fundamentals: null;
        };
        setExploreData({ ticker: data.ticker, period, interval, ohlcv: data.ohlcv, indicators: data.indicators, fundamentals: data.fundamentals });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to refresh indicators");
      } finally {
        setLoading("explore", false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [params]);

  return (
    <div className="space-y-8">
      {/* Quant Features — full charts, no parameters to adjust */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Quant Features
        </p>
        <div className="space-y-6">
          <MomentumChart indicators={indicators} />
          <VolatilityChart indicators={indicators} />
          <AutocorrChart indicators={indicators} />
          <IlliquidityChart indicators={indicators} />
        </div>
      </div>

      {/* Technical Indicators — full interactive charts with parameter sliders */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Technical Indicators
        </p>
        <div className="space-y-6">
          {INDICATORS.map((name) => {
            const hasData = Object.keys(indicators).some((k) =>
              (name === "MACD" && k.startsWith("MACD")) ||
              (name === "RSI" && k === "RSI") ||
              (name === "Bollinger Bands" && k.startsWith("BB_")) ||
              (name === "MFI" && k === "MFI")
            );
            if (!hasData) return null;
            const paramControls = INDICATOR_PARAMS[name];
            return (
              <div key={name}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{name}</h3>
                {paramControls && paramControls(params, set)}
                <IndicatorPanel name={name} data={indicators} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Market Stats */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Market Stats
        </p>
        <MarketStatsPanel ohlcv={ohlcv} indicators={indicators} />
      </div>
    </div>
  );
}
