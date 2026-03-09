"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TickerSearch } from "@/components/explore/TickerSearch";
import { CandlestickChart } from "@/components/explore/CandlestickChart";
import { IndicatorPanel } from "@/components/explore/IndicatorPanel";
import { FundamentalsGrid } from "@/components/explore/FundamentalsGrid";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { SignalChart } from "@/components/strategy/SignalChart";
import { FeatureImportance } from "@/components/strategy/FeatureImportance";
import { WalkForwardTimeline } from "@/components/strategy/WalkForwardTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BacktestPanel } from "@/components/backtest/BacktestPanel";
import { RiskPanel } from "@/components/risk/RiskPanel";
import { ReportPanel } from "@/components/report/ReportPanel";
import { KPICard, fmt } from "@/components/shared/KPICard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/stores/store";

const INDICATORS = ["MACD", "RSI", "Bollinger Bands", "Stochastic", "MFI", "ATR", "VWAP"];

function ExploreStage() {
  const { ohlcv, indicators, fundamentals } = useStore();
  if (ohlcv.length === 0) return <TickerSearch />;

  return (
    <div className="space-y-6">
      <TickerSearch />
      <Tabs defaultValue="price">
        <TabsList>
          <TabsTrigger value="price">Price</TabsTrigger>
          <TabsTrigger value="indicators">Indicators</TabsTrigger>
          {fundamentals && <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>}
        </TabsList>
        <TabsContent value="price">
          <CandlestickChart data={ohlcv} />
        </TabsContent>
        <TabsContent value="indicators" className="space-y-4">
          {INDICATORS.map((name) => {
            const hasData = Object.keys(indicators).some((k) =>
              (name === "MACD" && k.startsWith("MACD")) ||
              (name === "RSI" && k === "RSI") ||
              (name === "Bollinger Bands" && k.startsWith("BB_")) ||
              (name === "Stochastic" && k.startsWith("STOCH")) ||
              (name === "MFI" && k === "MFI") ||
              (name === "ATR" && k === "ATR") ||
              (name === "VWAP" && k.startsWith("VWAP"))
            );
            if (!hasData) return null;
            return (
              <div key={name}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{name}</h3>
                <IndicatorPanel name={name} data={indicators} />
              </div>
            );
          })}
        </TabsContent>
        {fundamentals && (
          <TabsContent value="fundamentals">
            <FundamentalsGrid data={fundamentals} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StrategyStage() {
  const { signals, signalSummary, mlMetrics } = useStore();
  const ml = mlMetrics as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <StrategyForm />
      {signals.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <KPICard label="Buy Signals" value={String(signalSummary?.buy_count ?? 0)} />
            <KPICard label="Sell Signals" value={String(signalSummary?.sell_count ?? 0)} />
            <KPICard label="Hold" value={String(signalSummary?.hold_count ?? 0)} />
            <KPICard label="Total" value={String(signalSummary?.total ?? 0)} />
          </div>

          {ml && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KPICard label="Accuracy" value={fmt(ml.accuracy as number, { pct: true })} />
                <KPICard label="Precision" value={fmt(ml.precision as number, { pct: true })} />
                <KPICard label="Recall" value={fmt(ml.recall as number, { pct: true })} />
                <KPICard label="F1 Score" value={fmt(ml.f1 as number, { pct: true })} />
                {ml.roc_auc != null && <KPICard label="ROC AUC" value={fmt(ml.roc_auc as number, { pct: true })} />}
              </div>

              {ml.confusion_matrix && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Confusion Matrix (Test Set)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ConfusionMatrix matrix={ml.confusion_matrix as number[][]} />
                  </CardContent>
                </Card>
              )}

              {ml.feature_importance && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Feature Importance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FeatureImportance importance={ml.feature_importance as Record<string, number>} />
                  </CardContent>
                </Card>
              )}

              {ml.fold_results && (() => {
                const folds = ml.fold_results as Array<{ accuracy?: number; f1?: number; roc_auc?: number | null }>;
                const withAcc = folds.filter((f) => f.accuracy != null);
                const avg = (key: "accuracy" | "f1" | "roc_auc") => {
                  const vals = withAcc.map((f) => f[key]).filter((v): v is number => v != null);
                  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                };
                const avgAcc = avg("accuracy");
                const avgF1 = avg("f1");
                const avgAuc = avg("roc_auc");
                return (
                  <>
                    {avgAcc != null && (
                      <div className="grid grid-cols-3 gap-3">
                        <KPICard label="Avg Accuracy (OOS)" value={fmt(avgAcc, { pct: true })} />
                        {avgF1 != null && <KPICard label="Avg F1 (OOS)" value={fmt(avgF1, { pct: true })} />}
                        {avgAuc != null && <KPICard label="Avg ROC AUC (OOS)" value={fmt(avgAuc, { pct: true })} />}
                      </div>
                    )}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Walk-Forward Fold Timeline</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <WalkForwardTimeline
                          folds={ml.fold_results as any[]}
                          nFolds={ml.n_folds as number}
                        />
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </>
          )}

          <SignalChart signals={signals} />
        </>
      )}
    </div>
  );
}

function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const [[tn, fp], [fn, tp]] = matrix;
  const cells = [
    { label: "True Negative", value: tn, color: "text-emerald-400" },
    { label: "False Positive", value: fp, color: "text-red-400" },
    { label: "False Negative", value: fn, color: "text-red-400" },
    { label: "True Positive", value: tp, color: "text-emerald-400" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 max-w-xs">
      {cells.map((c) => (
        <div key={c.label} className="rounded-lg border border-border p-3 text-center">
          <p className={`text-xl font-bold font-mono ${c.color}`}>{c.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

const STAGES: Record<number, () => React.ReactNode> = {
  1: ExploreStage,
  2: StrategyStage,
  3: BacktestPanel,
  4: RiskPanel,
  5: ReportPanel,
};

const STAGE_TITLES = ["", "Explore", "Strategy", "Backtest", "Risk Analysis", "Report"];

export default function Dashboard() {
  const activeStage = useStore((s) => s.activeStage);
  const Stage = STAGES[activeStage];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-semibold mb-6">{STAGE_TITLES[activeStage]}</h2>
          <Stage />
        </main>
      </div>
    </div>
  );
}
