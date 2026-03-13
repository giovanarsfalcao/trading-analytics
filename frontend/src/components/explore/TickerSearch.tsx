"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";

const POPULAR = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY", "QQQ", "BRK-B"];

const INTERVALS = [
  { label: "1m",  value: "1m" },
  { label: "5m",  value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H",  value: "1h" },
  { label: "1D",  value: "1d" },
];

// Valid periods per yfinance interval constraint
const INTERVAL_PERIODS: Record<string, { label: string; value: string }[]> = {
  "1m":  [{ label: "1D", value: "1d" }, { label: "5D", value: "5d" }, { label: "7D", value: "7d" }],
  "5m":  [{ label: "1D", value: "1d" }, { label: "5D", value: "5d" }, { label: "1M", value: "1mo" }, { label: "2M", value: "2mo" }],
  "15m": [{ label: "1D", value: "1d" }, { label: "5D", value: "5d" }, { label: "1M", value: "1mo" }, { label: "2M", value: "2mo" }],
  "30m": [{ label: "1D", value: "1d" }, { label: "5D", value: "5d" }, { label: "1M", value: "1mo" }, { label: "2M", value: "2mo" }],
  "1h":  [{ label: "1M", value: "1mo" }, { label: "3M", value: "3mo" }, { label: "6M", value: "6mo" }, { label: "1Y", value: "1y" }, { label: "2Y", value: "2y" }],
  "1d":  [{ label: "6M", value: "6mo" }, { label: "1Y", value: "1y" }, { label: "2Y", value: "2y" }, { label: "5Y", value: "5y" }, { label: "MAX", value: "max" }],
};

export interface IndicatorParams {
  rsi_period: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  bb_period: number;
  bb_std: number;
  sma_fast: number;
  sma_medium: number;
  sma_slow: number;
}

interface Props {
  indicatorParams: IndicatorParams;
}

export function TickerSearch({ indicatorParams }: Props) {
  const { period, interval, setExploreData, setLoading, setError } = useStore();
  const [input, setInput] = useState("");
  const [selectedInterval, setSelectedInterval] = useState(interval);
  const periodOptions = INTERVAL_PERIODS[selectedInterval] ?? INTERVAL_PERIODS["1d"];
  const defaultPeriod = periodOptions.find((p) => p.value === period) ? period : periodOptions[Math.floor(periodOptions.length / 2)].value;
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  function handleIntervalChange(iv: string) {
    setSelectedInterval(iv);
    const options = INTERVAL_PERIODS[iv] ?? INTERVAL_PERIODS["1d"];
    // pick middle option as sensible default
    setSelectedPeriod(options[Math.floor(options.length / 2)].value);
  }

  async function load(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading("explore", true);
    setError(null);
    try {
      const data = await api.explore(t, selectedPeriod, selectedInterval, indicatorParams) as {
        ticker: string; ohlcv: []; indicators: Record<string, []>; fundamentals: null;
      };
      setExploreData({
        ticker: data.ticker,
        period: selectedPeriod,
        interval: selectedInterval,
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
      {/* Ticker input row */}
      <div className="flex gap-2">
        <Input
          placeholder="Ticker (e.g. AAPL)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(input)}
          className="max-w-xs font-mono uppercase"
        />
        <Button onClick={() => load(input)}>Load</Button>
      </div>

      {/* Timeframe controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Interval segmented control */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Interval</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {INTERVALS.map((iv, i) => (
              <button
                key={iv.value}
                onClick={() => handleIntervalChange(iv.value)}
                className={[
                  "px-3 py-1.5 text-xs font-mono font-medium transition-colors",
                  i > 0 && "border-l border-border",
                  selectedInterval === iv.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
                ].filter(Boolean).join(" ")}
              >
                {iv.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border hidden sm:block" />

        {/* Range segmented control */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Range</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {periodOptions.map((p, i) => (
              <button
                key={p.value}
                onClick={() => setSelectedPeriod(p.value)}
                className={[
                  "px-3 py-1.5 text-xs font-mono font-medium transition-colors",
                  i > 0 && "border-l border-border",
                  selectedPeriod === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
                ].filter(Boolean).join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Popular tickers */}
      <div className="flex gap-1.5 flex-wrap">
        {POPULAR.map((t) => (
          <button
            key={t}
            onClick={() => { setInput(t); load(t); }}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
