"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  RefreshCcw,
  ShieldAlert,
  FileText,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/stores/store";

const STAGES = [
  {
    number: 1,
    name: "Explore",
    icon: BarChart3,
    description: "Fetch OHLCV data, indicators & fundamentals for any ticker",
  },
  {
    number: 2,
    name: "Strategy",
    icon: TrendingUp,
    description: "Apply rule-based or ML strategies to generate trade signals",
  },
  {
    number: 3,
    name: "Backtest",
    icon: RefreshCcw,
    description: "Simulate historical performance with realistic position sizing",
  },
  {
    number: 4,
    name: "Risk",
    icon: ShieldAlert,
    description: "Analyze Sharpe, VaR, drawdown & run Monte Carlo simulations",
  },
  {
    number: 5,
    name: "Report",
    icon: FileText,
    description: "Review the full summary and export results as CSV",
  },
];

export function WelcomePage() {
  const dismissWelcome = useStore((s) => s.dismissWelcome);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % STAGES.length);
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  function handleHover(index: number) {
    setPaused(true);
    setActiveIndex(index);
  }

  function handleLeave() {
    setPaused(false);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background px-6">
      {/* Hero */}
      <div className="mb-16 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight">Trading Analytics</span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          From raw data to risk-adjusted insights
        </h1>
        <p className="text-lg text-muted-foreground">
          A quantitative research platform built around a 5-stage workflow.
        </p>
      </div>

      {/* Workflow strip */}
      <div className="mb-16 flex items-start gap-2">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = i === activeIndex;
          return (
            <div key={stage.number} className="flex items-start gap-2">
              <div
                onMouseEnter={() => handleHover(i)}
                onMouseLeave={handleLeave}
                className={`
                  w-44 cursor-default rounded-xl border p-4 transition-all duration-300
                  ${isActive
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                    : "border-border bg-card"
                  }
                `}
              >
                <div className={`mb-3 flex items-center gap-2 transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {stage.number}. {stage.name}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed transition-colors duration-300 ${isActive ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {stage.description}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <ChevronRight className="mt-5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <Button size="lg" onClick={dismissWelcome} className="gap-2 px-8 text-base">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">
        Search for any ticker to begin — e.g. AAPL, NVDA, SPY
      </p>
    </div>
  );
}
