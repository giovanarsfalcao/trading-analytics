"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TickerSearch } from "@/components/explore/TickerSearch";
import { CandlestickChart } from "@/components/explore/CandlestickChart";
import { IndicatorPanel } from "@/components/explore/IndicatorPanel";
import { FundamentalsGrid } from "@/components/explore/FundamentalsGrid";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { SignalChart } from "@/components/strategy/SignalChart";
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
          {mlMetrics && (
            <div className="grid grid-cols-3 gap-3">
              <KPICard label="Accuracy" value={fmt((mlMetrics as Record<string, number>).accuracy, { pct: true })} />
              <KPICard label="Precision" value={fmt((mlMetrics as Record<string, number>).precision, { pct: true })} />
              <KPICard label="Recall" value={fmt((mlMetrics as Record<string, number>).recall, { pct: true })} />
            </div>
          )}
          <SignalChart signals={signals} />
        </>
      )}
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
