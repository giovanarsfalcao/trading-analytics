"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TradeRecord } from "@/types";

interface Props {
  trades: TradeRecord[];
}

export function TradeTable({ trades }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Trade Details ({trades.length} trades)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Entry</TableHead>
                <TableHead className="text-xs">Exit</TableHead>
                <TableHead className="text-xs">Dir</TableHead>
                <TableHead className="text-xs text-right">Entry $</TableHead>
                <TableHead className="text-xs text-right">Exit $</TableHead>
                <TableHead className="text-xs text-right">Return</TableHead>
                <TableHead className="text-xs text-right">Days</TableHead>
                <TableHead className="text-xs text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t, i) => (
                <TableRow key={i} className="text-xs font-mono">
                  <TableCell>{t.entry_date.split("T")[0]}</TableCell>
                  <TableCell>{t.exit_date.split("T")[0]}</TableCell>
                  <TableCell className={t.direction === "long" ? "text-emerald-400" : "text-red-400"}>
                    {t.direction.toUpperCase()}
                  </TableCell>
                  <TableCell className="text-right">${t.entry_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${t.exit_price.toFixed(2)}</TableCell>
                  <TableCell className={cn("text-right", t.return_pct > 0 ? "text-emerald-400" : "text-red-400")}>
                    {(t.return_pct * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">{t.holding_days}</TableCell>
                  <TableCell className={cn("text-right", t.pnl > 0 ? "text-emerald-400" : "text-red-400")}>
                    ${t.pnl.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
