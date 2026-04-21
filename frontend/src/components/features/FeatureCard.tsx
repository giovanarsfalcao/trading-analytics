"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { IndicatorPoint } from "@/types";

interface Props {
  name: string;
  description: string;
  data?: IndicatorPoint[];
  color?: string;
}

export function FeatureCard({ name, description, data, color = "#2563eb" }: Props) {
  const chartData = data?.slice(-120) ?? [];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold">{name}</h4>
          <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
        </div>
        {chartData.length > 0 ? (
          <div className="h-[64px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[64px] flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50">No data</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
