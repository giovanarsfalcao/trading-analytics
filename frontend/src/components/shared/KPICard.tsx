"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  description?: string;
  className?: string;
}

export function KPICard({ label, value, delta, deltaType = "neutral", description, className }: KPICardProps) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {delta && (
          <p className={cn(
            "text-xs mt-1",
            deltaType === "positive" && "text-emerald-400",
            deltaType === "negative" && "text-red-400",
            deltaType === "neutral" && "text-muted-foreground",
          )}>
            {delta}
          </p>
        )}
        {description && (
          <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function fmt(value: number | null | undefined, opts?: { pct?: boolean; bn?: boolean; prefix?: string }): string {
  if (value == null || isNaN(value)) return "N/A";
  if (opts?.bn) return `${opts.prefix || ""}${(value / 1e9).toFixed(2)}B`;
  if (opts?.pct) return `${(value * 100).toFixed(2)}%`;
  return `${opts?.prefix || ""}${value.toFixed(2)}`;
}
