"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import type { ComparisonEntry } from "@/types";

const LINE_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#ec4899", "#06b6d4"];

export function ComparisonPanel() {
  const { comparisonResults, removeComparison, clearComparison } = useStore();

  if (comparisonResults.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No strategies added. Run a backtest and click "Add to Comparison".
      </p>
    );
  }

  // Build merged time-series: align by index position (all portfolios have same date range)
  const maxLen = Math.max(...comparisonResults.map((e) => e.portfolio.length));
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, string | number> = {
      date: comparisonResults[0]?.portfolio[i]?.date.split("T")[0] ?? "",
    };
    comparisonResults.forEach((e) => {
      row[e.id] = e.portfolio[i]?.cumulative_return != null
        ? e.portfolio[i].cumulative_return * 100
        : 0;
    });
    return row;
  });

  const METRICS: Array<{ key: keyof ComparisonEntry["tradeStats"]; label: string; pct?: boolean }> = [
    { key: "total_return", label: "Total Return", pct: true },
    { key: "annualized_return", label: "Ann. Return", pct: true },
    { key: "max_drawdown", label: "Max Drawdown", pct: true },
    { key: "sharpe_ratio", label: "Sharpe" },
    { key: "win_rate", label: "Win Rate", pct: true },
    { key: "profit_factor", label: "Profit Factor" },
    { key: "total_trades", label: "Trades" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{comparisonResults.length} strategies</p>
        <Button size="sm" variant="outline" onClick={clearComparison}>Clear All</Button>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => String(v).slice(2, 7)} />
          <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 10, fill: "#71717a" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`${Number(v ?? 0).toFixed(2)}%`]}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Legend formatter={(value) => {
            const entry = comparisonResults.find((e) => e.id === value);
            return entry?.label ?? value;
          }} />
          {comparisonResults.map((entry, i) => (
            <Line
              key={entry.id}
              type="monotone"
              dataKey={entry.id}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={entry.id}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Strategy</th>
              {METRICS.map((m) => (
                <th key={m.key} className="text-right py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">
                  {m.label}
                </th>
              ))}
              <th className="py-2 px-2" />
            </tr>
          </thead>
          <tbody>
            {comparisonResults.map((entry, i) => (
              <tr key={entry.id} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium" style={{ color: LINE_COLORS[i % LINE_COLORS.length] }}>
                  {entry.label}
                </td>
                {METRICS.map((m) => {
                  const val = entry.tradeStats[m.key] as number;
                  const isReturn = m.key === "total_return" || m.key === "annualized_return";
                  return (
                    <td
                      key={m.key}
                      className={`text-right py-2 px-2 font-mono ${isReturn ? (val > 0 ? "text-emerald-400" : "text-red-400") : ""}`}
                    >
                      {m.key === "total_trades" ? val : fmt(val, { pct: m.pct })}
                    </td>
                  );
                })}
                <td className="py-2 px-2">
                  <button
                    onClick={() => removeComparison(entry.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
