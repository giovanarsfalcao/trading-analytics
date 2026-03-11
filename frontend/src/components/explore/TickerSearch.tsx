"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";

const POPULAR = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY", "QQQ", "BRK-B"];
const PERIODS = ["6mo", "1y", "2y", "5y", "max"];

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
  const { period, setExploreData, setLoading, setError } = useStore();
  const [input, setInput] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  async function load(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading("explore", true);
    setError(null);
    try {
      const data = await api.explore(t, selectedPeriod, indicatorParams) as {
        ticker: string; ohlcv: []; indicators: Record<string, []>; fundamentals: null;
      };
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
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {POPULAR.map((t) => (
          <Button key={t} size="sm" variant="ghost" className="text-xs h-7 px-2.5" onClick={() => { setInput(t); load(t); }}>
            {t}
          </Button>
        ))}
      </div>
    </div>
  );
}
