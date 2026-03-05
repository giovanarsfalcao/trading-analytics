"use client";

import { cn } from "@/lib/utils";
import { useStore } from "@/stores/store";
import { BarChart3, TrendingUp, RefreshCcw, ShieldAlert, FileText, Check, Lock } from "lucide-react";

const STAGES = [
  { id: 1, label: "Explore", icon: BarChart3, desc: "Price & indicators" },
  { id: 2, label: "Strategy", icon: TrendingUp, desc: "Signals & ML" },
  { id: 3, label: "Backtest", icon: RefreshCcw, desc: "Trade simulation" },
  { id: 4, label: "Risk", icon: ShieldAlert, desc: "Risk & Monte Carlo" },
  { id: 5, label: "Report", icon: FileText, desc: "Summary & export" },
] as const;

export function Sidebar() {
  const { activeStage, setActiveStage, completedStages } = useStore();

  return (
    <aside className="w-60 border-r border-border bg-card flex flex-col shrink-0">
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Trading Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Quant Research Platform</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {STAGES.map((stage) => {
          const done = completedStages.includes(stage.id);
          const active = activeStage === stage.id;
          const accessible = stage.id === 1 || completedStages.includes(stage.id - 1);
          const Icon = stage.icon;
          return (
            <button
              key={stage.id}
              onClick={() => accessible && setActiveStage(stage.id)}
              disabled={!accessible}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                active && "bg-primary/10 text-primary",
                !active && accessible && "hover:bg-accent text-foreground",
                !accessible && "opacity-35 cursor-not-allowed text-muted-foreground",
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                done && "bg-emerald-500/20 text-emerald-400",
                active && !done && "bg-primary/20 text-primary",
                !active && !done && "bg-muted text-muted-foreground",
              )}>
                {done ? <Check className="w-3.5 h-3.5" /> : !accessible ? <Lock className="w-3 h-3" /> : stage.id}
              </div>
              <div className="min-w-0">
                <p className="font-medium leading-tight">{stage.label}</p>
                <p className="text-xs text-muted-foreground truncate">{stage.desc}</p>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
