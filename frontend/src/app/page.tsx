"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TickerSearch } from "@/components/explore/TickerSearch";
import { CandlestickChart } from "@/components/explore/CandlestickChart";
import { IndicatorPanel } from "@/components/explore/IndicatorPanel";
import { FundamentalsGrid } from "@/components/explore/FundamentalsGrid";
import { MarketStatsPanel } from "@/components/explore/MarketStatsPanel";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { SignalChart } from "@/components/strategy/SignalChart";
import { FeatureImportance } from "@/components/strategy/FeatureImportance";
import { WalkForwardComparisonChart } from "@/components/strategy/WalkForwardComparisonChart";
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
  const { ticker, period, interval, ohlcv, indicators, fundamentals, setExploreData, setLoading, setError } = useStore();
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
        const data = await api.explore(ticker, period, interval, params) as {
          ticker: string; ohlcv: []; indicators: Record<string, []>; fundamentals: null;
        };
        setExploreData({ ticker: data.ticker, period, interval, ohlcv: data.ohlcv, indicators: data.indicators, fundamentals: data.fundamentals });
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
          <TabsTrigger value="market-stats">Market Stats</TabsTrigger>
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
        <TabsContent value="market-stats">
          <MarketStatsPanel ohlcv={ohlcv} indicators={indicators} />
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
  const { signals, wfBaseSignals, signalSummary, mlMetrics, ohlcv } = useStore();
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
                <KPICard label="Accuracy" value={fmt(ml.accuracy as number, { pct: true })} description="How often was the model correct overall?" />
                <KPICard label="Precision" value={fmt(ml.precision as number, { pct: true })} description="Of all buy signals, how many were right?" />
                <KPICard label="Recall" value={fmt(ml.recall as number, { pct: true })} description="Of all actual buy opportunities, how many were caught?" />
                <KPICard label="F1 Score" value={fmt(ml.f1 as number, { pct: true })} description="Balance between precision and recall" />
                {ml.roc_auc != null && <KPICard label="ROC AUC" value={fmt(ml.roc_auc as number, { pct: true })} description="How well does the model separate Long vs Short? (1.0 = perfect)" />}
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
                        <KPICard label="Avg Accuracy (OOS)" value={fmt(avgAcc, { pct: true })} description="Average out-of-sample accuracy across all folds" />
                        {avgF1 != null && <KPICard label="Avg F1 (OOS)" value={fmt(avgF1, { pct: true })} description="Average F1 score across all folds" />}
                        {avgAuc != null && <KPICard label="Avg ROC AUC (OOS)" value={fmt(avgAuc, { pct: true })} description="Average ability to separate Long vs Short, out-of-sample" />}
                      </div>
                    )}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Walk-Forward vs Base ML</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <WalkForwardComparisonChart
                          wfSignals={signals}
                          baseSignals={wfBaseSignals}
                          ohlcv={ohlcv}
                          folds={ml.fold_results as any[]}
                        />
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

          {!ml?.fold_results && <SignalChart signals={signals} />}
        </>
      )}
    </div>
  );
}

function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const [[tn, fp], [fn, tp]] = matrix;
  const total = tn + fp + fn + tp;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-lg">
        Shows how the model performed on the held-out test set. Rows = what actually happened,
        columns = what the model predicted. Green cells are correct predictions, red cells are mistakes.
      </p>
      <div className="flex gap-4 items-start">
        {/* Matrix */}
        <div className="flex flex-col gap-1">
          {/* Column headers */}
          <div className="flex">
            <div className="w-24" />
            <div className="flex gap-1">
              <div className="w-28 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Predicted Short</div>
              <div className="w-28 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Predicted Long</div>
            </div>
          </div>
          {/* Row: Actual Short */}
          <div className="flex items-center gap-1">
            <div className="w-24 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-2">Actual Short</div>
            <div className="w-28 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-xl font-bold font-mono text-emerald-400">{tn}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">True Negative</p>
            </div>
            <div className="w-28 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
              <p className="text-xl font-bold font-mono text-red-400">{fp}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">False Positive</p>
            </div>
          </div>
          {/* Row: Actual Long */}
          <div className="flex items-center gap-1">
            <div className="w-24 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pr-2">Actual Long</div>
            <div className="w-28 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
              <p className="text-xl font-bold font-mono text-red-400">{fn}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">False Negative</p>
            </div>
            <div className="w-28 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p className="text-xl font-bold font-mono text-emerald-400">{tp}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">True Positive</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 pt-6 text-[10px] text-muted-foreground">
          <div><span className="text-emerald-400 font-semibold">TP</span> — correctly predicted Long (profit captured)</div>
          <div><span className="text-emerald-400 font-semibold">TN</span> — correctly predicted Short (loss avoided)</div>
          <div><span className="text-red-400 font-semibold">FP</span> — predicted Long, market went Short (bad trade entered)</div>
          <div><span className="text-red-400 font-semibold">FN</span> — predicted Short, market went Long (missed opportunity)</div>
          {total > 0 && (
            <div className="pt-1 border-t border-border">
              Accuracy: <span className="text-foreground font-mono">{(((tp + tn) / total) * 100).toFixed(1)}%</span>
              {" "}({tp + tn} of {total} correct)
            </div>
          )}
        </div>
      </div>
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
