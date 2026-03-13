"use client";

interface AnnualReturn {
  year: number;
  return: number;
}

interface Props {
  data: AnnualReturn[];
}

export function AnnualReturnsTable({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Annual Returns</p>
        <span className="text-[10px] text-muted-foreground">Year-by-year performance breakdown</span>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Year</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Return</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground w-1/2">Bar</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const pct = row.return * 100;
              const positive = pct >= 0;
              const barWidth = Math.min(Math.abs(pct) * 2, 100);
              return (
                <tr key={row.year} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.year}</td>
                  <td className={`px-3 py-2 text-right font-mono font-medium ${positive ? "text-green-400" : "text-red-400"}`}>
                    {positive ? "+" : ""}{pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center h-3">
                      <div
                        className={`h-full rounded-sm ${positive ? "bg-green-500/60" : "bg-red-500/60"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
