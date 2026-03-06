"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";

const POPULAR = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY", "QQQ", "BRK-B"];
const PERIODS = ["6mo", "1y", "2y", "5y", "max"];

export function TickerSearch() {
  const { period, setExploreData, setLoading, setError } = useStore();
  const [input, setInput] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Indicator params
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStd, setBbStd] = useState(2.0);
  const [smaFast, setSmaFast] = useState(20);
  const [smaMedium, setSmaMedium] = useState(50);
  const [smaSlow, setSmaSlow] = useState(200);

  async function load(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading("explore", true);
    setError(null);
    try {
      const data = await api.explore(t, selectedPeriod, {
        rsi_period: rsiPeriod,
        macd_fast: macdFast, macd_slow: macdSlow, macd_signal: macdSignal,
        bb_period: bbPeriod, bb_std: bbStd,
        sma_fast: smaFast, sma_medium: smaMedium, sma_slow: smaSlow,
      }) as { ticker: string; ohlcv: []; indicators: Record<string, []>; fundamentals: null };
      setExploreData({
        ticker: data.ticker,
        period: selectedPeriod,
        ohlcv: data.ohlcv,
        indicators: data.indicators,
        fundamentals: data.fundamentals,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading("explore", false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Enter ticker (e.g. AAPL)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(input)}
          className="max-w-xs font-mono uppercase"
        />
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={selectedPeriod === p ? "default" : "outline"}
              onClick={() => setSelectedPeriod(p)}
              className="text-xs"
            >
              {p}
            </Button>
          ))}
        </div>
        <Button onClick={() => load(input)}>Load</Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide Settings" : "Advanced"}
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {POPULAR.map((t) => (
          <Button key={t} size="sm" variant="ghost" className="text-xs h-7 px-2.5" onClick={() => { setInput(t); load(t); }}>
            {t}
          </Button>
        ))}
      </div>

      {showAdvanced && (
        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground">Indicator Settings</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SliderField label="RSI Period" value={rsiPeriod} min={2} max={50} step={1} onChange={setRsiPeriod} />
            <SliderField label="BB Period" value={bbPeriod} min={5} max={50} step={1} onChange={setBbPeriod} />
            <SliderField label="BB Std Dev" value={bbStd} min={1} max={3.5} step={0.1} onChange={setBbStd} format={(v) => v.toFixed(1)} />
            <SliderField label="SMA Fast" value={smaFast} min={5} max={50} step={1} onChange={setSmaFast} />
            <SliderField label="SMA Medium" value={smaMedium} min={20} max={100} step={5} onChange={setSmaMedium} />
            <SliderField label="SMA Slow" value={smaSlow} min={50} max={400} step={10} onChange={setSmaSlow} />
            <SliderField label="MACD Fast" value={macdFast} min={5} max={50} step={1} onChange={setMacdFast} />
            <SliderField label="MACD Slow" value={macdSlow} min={10} max={100} step={1} onChange={setMacdSlow} />
            <SliderField label="MACD Signal" value={macdSignal} min={3} max={30} step={1} onChange={setMacdSignal} />
          </div>
        </div>
      )}
    </div>
  );
}

function SliderField({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{format ? format(value) : value}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
