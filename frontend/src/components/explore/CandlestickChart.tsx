"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import type { OHLCVRow } from "@/types";

interface Props {
  data: OHLCVRow[];
  height?: number;
}

export function CandlestickChart({ data, height = 450 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;

    const chart = createChart(ref.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: "#a1a1aa" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    candles.setData(data.map((d) => ({
      time: d.date.split("T")[0] as string & { __brand: "date" },
      open: d.open, high: d.high, low: d.low, close: d.close,
    })));

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volume.setData(data.map((d) => ({
      time: d.date.split("T")[0] as string & { __brand: "date" },
      value: d.volume,
      color: d.close >= d.open ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
    })));

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height]);

  return <div ref={ref} className="w-full" />;
}
