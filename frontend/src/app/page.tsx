"use client";

import { useState, useEffect, useRef } from "react";
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
import { api } from "@/lib/api";
import { WelcomePage } from "@/components/welcome/WelcomePage";
import { Slider } from "@/components/ui/slider";
import type { IndicatorParams } from "@/components/explore/TickerSearch";

const INDICATORS = ["MACD", "RSI", "Bollinger Bands", "MFI"];

function SliderField({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const fmt = (v: number) => format ? format(v) : v;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono font-medium text-foreground">{fmt(value)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]: number[]) => onChange(v)} />
      <div className="flex justify-between text-[10px] text-muted-foreground/50 font-mono">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

const INDICATOR_PARAMS: Record<string, (params: IndicatorParams, set: <K extends keyof IndicatorParams>(k: K, v: IndicatorParams[K]) => void) => React.ReactNode> = {
  MACD: (p, s) => (
    <div className="grid grid-cols-3 gap-6 mb-4">
      <SliderField label="Fast" value={p.macd_fast} min={5} max={50} step={1} onChange={(v) => s("macd_fast", v)} />
      <SliderField label="Slow" value={p.macd_slow} min={10} max={100} step={1} onChange={(v) => s("macd_slow", v)} />
      <SliderField label="Signal" value={p.macd_signal} min={3} max={30} step={1} onChange={(v) => s("macd_signal", v)} />
    </div>
  ),
  RSI: (p, s) => (
    <div className="grid grid-cols-3 gap-6 mb-4">
      <SliderField label="Period" value={p.rsi_period} min={2} max={50} step={1} onChange={(v) => s("rsi_period", v)} />
    </div>
  ),
  "Bollinger Bands": (p, s) => (
    <div className="grid grid-cols-3 gap-6 mb-4">
      <SliderField label="Period" value={p.bb_period} min={5} max={50} step={1} onChange={(v) => s("bb_period", v)} />
      <SliderField label="Std Dev" value={p.bb_std} min={1} max={3.5} step={0.1} onChange={(v) => s("bb_std", v)} format={(v) => v.toFixed(1)} />
    </div>
  ),
};

function ExploreStage() {
  const { ticker, period, ohlcv, indicators, fundamentals, setExploreData, setLoading, setError } = useStore();
  const [params, setParams] = useState<IndicatorParams>({
    rsi_period: 14, macd_fast: 12, macd_slow: 26, macd_signal: 9,
    bb_period: 20, bb_std: 2.0, sma_fast: 20, sma_medium: 50, sma_slow: 200,
  });
  const isFirstRender = useRef(true);

  const set = <K extends keyof IndicatorParams>(key: K, val: IndicatorParams[K]) =>
    setParams((prev: IndicatorParams) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!ticker) return;
    const timer = setTimeout(async () => {
      setLoading("explore", true);
      try {
        const data = await api.explore(ticker, period, params) as {
          ticker: string; ohlcv: []; indicators: Record<string, []>; fundamentals: null;
        };
        setExploreData({ ticker: data.ticker, period, ohlcv: data.ohlcv, indicators: data.indicators, fundamentals: data.fundamentals });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to refresh indicators");
      } finally {
        setLoading("explore", false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [params]);

  if (ohlcv.length === 0) return <TickerSearch indicatorParams={params} />;

  return (
    <div className="space-y-6">
      <TickerSearch indicatorParams={params} />
      <Tabs defaultValue="price">
        <TabsList>
          <TabsTrigger value="price">Price</TabsTrigger>
          <TabsTrigger value="indicators">Technical Indicators</TabsTrigger>
          {fundamentals && <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>}
        </TabsList>
        <TabsContent value="price">
          <CandlestickChart data={ohlcv} />
        </TabsContent>
        <TabsContent value="indicators" className="space-y-6">
          {INDICATORS.map((name) => {
            const hasData = Object.keys(indicators).some((k) =>
              (name === "MACD" && k.startsWith("MACD")) ||
              (name === "RSI" && k === "RSI") ||
              (name === "Bollinger Bands" && k.startsWith("BB_")) ||
              (name === "MFI" && k === "MFI")
            );
            if (!hasData) return null;
            const paramControls = INDICATOR_PARAMS[name];
            return (
              <div key={name}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{name}</h3>
                {paramControls && paramControls(params, set)}
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
  const welcomeDismissed = useStore((s) => s.welcomeDismissed);
  const Stage = STAGES[activeStage];

  if (!welcomeDismissed) return <WelcomePage />;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-semibold mb-6">{STAGE_TITLES[activeStage]}</h2>
          <Stage />
          <p className="mt-10 text-center text-xs text-muted-foreground/40">
            © {new Date().getFullYear()} Giovana Falcao
          </p>
        </main>
      </div>
    </div>
  );
}
