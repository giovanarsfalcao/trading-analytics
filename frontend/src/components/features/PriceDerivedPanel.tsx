"use client";

import { FeatureCard } from "./FeatureCard";
import type { IndicatorPoint } from "@/types";

const QUANT_FEATURES = [
  { key: "momentum_21d", name: "Momentum (21d)", description: "Short-term trend — how much did the price change in the last month?", color: "#2563eb" },
  { key: "momentum_252_21d", name: "Momentum (252-21d)", description: "Long-term trend minus recent noise (Jegadeesh & Titman factor)", color: "#2563eb" },
  { key: "vol_ratio", name: "Volatility Ratio", description: "Is volatility expanding or contracting? (5d std / 20d std)", color: "#a855f7" },
  { key: "HV_20", name: "Historical Volatility", description: "Annualized 20-day price volatility from log returns", color: "#a855f7" },
  { key: "illiquidity", name: "Amihud Illiquidity", description: "Price impact per unit volume — how hard is it to trade?", color: "#06b6d4" },
  { key: "autocorr_20", name: "Autocorrelation (20d)", description: "Does the market trend or mean-revert? Positive = trending", color: "#06b6d4" },
];

const TECH_FEATURES = [
  { key: "RSI", name: "RSI (14d)", description: "Momentum oscillator 0-100. Above 70 = overbought, below 30 = oversold", color: "#22c55e" },
  { key: "MACD_HIST", name: "MACD Histogram", description: "Trend momentum: EMA(12)-EMA(26) minus signal line", color: "#22c55e" },
  { key: "ATR", name: "ATR (14d)", description: "Average daily price range including gaps — measures volatility", color: "#f97316" },
  { key: "BB_Percent", name: "Bollinger %B", description: "Where is price relative to its bands? >1 = above, <0 = below", color: "#f97316" },
  { key: "MFI", name: "MFI (14d)", description: "Volume-weighted RSI — buying vs selling pressure", color: "#ef4444" },
  { key: "Volume_Ratio", name: "Volume Ratio", description: "Today's volume vs 20-day average. >1 = above average activity", color: "#ef4444" },
];

interface Props {
  indicators: Record<string, IndicatorPoint[]>;
}

export function PriceDerivedPanel({ indicators }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Quant Features
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUANT_FEATURES.map((f) => (
            <FeatureCard
              key={f.key}
              name={f.name}
              description={f.description}
              data={indicators[f.key]}
              color={f.color}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Technical Indicators
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TECH_FEATURES.map((f) => (
            <FeatureCard
              key={f.key}
              name={f.name}
              description={f.description}
              data={indicators[f.key]}
              color={f.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
