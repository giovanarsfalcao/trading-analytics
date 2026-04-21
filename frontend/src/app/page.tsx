"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TickerSearch } from "@/components/explore/TickerSearch";
import { CandlestickChart } from "@/components/explore/CandlestickChart";
import { SignalsForm } from "@/components/signals/SignalsForm";
import { SignalChart } from "@/components/signals/SignalChart";
import { FeatureImportance } from "@/components/signals/FeatureImportance";
import { WalkForwardComparisonChart } from "@/components/signals/WalkForwardComparisonChart";
import { WalkForwardTimeline } from "@/components/signals/WalkForwardTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BacktestPanel } from "@/components/backtest/BacktestPanel";
import { RiskPanel } from "@/components/risk/RiskPanel";
import { ReportPanel } from "@/components/report/ReportPanel";
import { FeaturesPanel } from "@/components/features/FeaturesPanel";
import { KPICard, fmt } from "@/components/shared/KPICard";
import { useStore } from "@/stores/store";
import { WelcomePage } from "@/components/welcome/WelcomePage";

function ExploreStage() {
  const { ohlcv } = useStore();

  if (ohlcv.length === 0) {
    return (
      <div className="space-y-6">
        <TickerSearch />
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Search for a ticker above (e.g. AAPL, NVDA, SPY) to load its price chart.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TickerSearch />
      <CandlestickChart data={ohlcv} />
    </div>
  );
}

function SignalsStage() {
  const { signals, wfBaseSignals, signalSummary, mlMetrics, ohlcv } = useStore();
  const ml = mlMetrics as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <SignalsForm />
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
  2: FeaturesPanel,
  3: SignalsStage,
  4: BacktestPanel,
  5: RiskPanel,
  6: ReportPanel,
};

const STAGE_TITLES = ["", "Explore", "Features", "Signals", "Backtest", "Risk Analysis", "Report"];

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
