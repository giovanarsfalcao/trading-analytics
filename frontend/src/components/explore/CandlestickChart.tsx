"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import type { OHLCVRow } from "@/types";

interface Props {
  data: OHLCVRow[];
  height?: number;
}

function fmtPrice(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVolume(v: number) {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toString();
}

// Returns a lightweight-charts compatible time value.
// Daily data: "YYYY-MM-DD" string. Intraday data: Unix timestamp in seconds.
function toChartTime(dateStr: string): string | number {
  if (dateStr.length > 10 && dateStr.includes("T")) {
    return Math.floor(new Date(dateStr).getTime() / 1000);
  }
  return dateStr.slice(0, 10);
}

export function CandlestickChart({ data, height = 450 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;

    const isIntraday = data.length > 0 && data[0].date.length > 10 && data[0].date.includes("T");

    const chart = createChart(ref.current, {
      height,
      layout: { background: { color: "transparent" }, textColor: "#a1a1aa" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: { mode: 1 },
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    candles.setData(data.map((d) => ({
      time: toChartTime(d.date) as any,
      open: d.open, high: d.high, low: d.low, close: d.close,
    })));

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    volume.setData(data.map((d) => ({
      time: toChartTime(d.date) as any,
      value: d.volume,
      color: d.close >= d.open ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
    })));

    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Build a chartTime → OHLCVRow lookup for tooltip
    const byTime: Record<string | number, OHLCVRow> = {};
    for (const d of data) byTime[toChartTime(d.date)] = d;

    chart.subscribeCrosshairMove((param) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (!param.time || !param.point) {
        tooltip.style.display = "none";
        return;
      }

      const row = byTime[param.time as string | number];
      const dateStr = isIntraday
        ? new Date((param.time as number) * 1000).toISOString().replace("T", " ").slice(0, 16)
        : param.time as string;
      if (!row) { tooltip.style.display = "none"; return; }

      const isUp = row.close >= row.open;
      const color = isUp ? "#22c55e" : "#ef4444";

      tooltip.style.display = "block";
      tooltip.innerHTML = `
        <div style="color:#a1a1aa;font-size:10px;margin-bottom:4px">${dateStr}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:11px">
          <span style="color:#a1a1aa">O</span><span style="color:${color};font-family:monospace">${fmtPrice(row.open)}</span>
          <span style="color:#a1a1aa">H</span><span style="color:${color};font-family:monospace">${fmtPrice(row.high)}</span>
          <span style="color:#a1a1aa">L</span><span style="color:${color};font-family:monospace">${fmtPrice(row.low)}</span>
          <span style="color:#a1a1aa">C</span><span style="color:${color};font-family:monospace">${fmtPrice(row.close)}</span>
        </div>
        <div style="margin-top:4px;font-size:10px;color:#a1a1aa">Vol <span style="color:#e4e4e7;font-family:monospace">${fmtVolume(row.volume)}</span></div>
      `;
    });

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [data, height]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Price</p>
        <span className="text-[10px] text-muted-foreground">OHLCV · hover for details</span>
      </div>
    <div style={{ position: "relative" }}>
      <div ref={ref} className="w-full" />
      <div
        ref={tooltipRef}
        style={{
          display: "none",
          position: "absolute",
          top: 8,
          left: 8,
          padding: "8px 10px",
          background: "rgba(20,20,20,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6,
          pointerEvents: "none",
          zIndex: 10,
          backdropFilter: "blur(4px)",
        }}
      />
    </div>
    </div>
  );
}
