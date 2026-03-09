import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  OHLCVRow,
  IndicatorPoint,
  FundamentalsData,
  SignalPoint,
  PortfolioPoint,
  TradeRecord,
  TradeStats,
  RiskMetrics,
  MonteCarloResult,
  ComparisonEntry,
} from "@/types";

interface TradingState {
  activeStage: number;
  completedStages: number[];

  // Stage 1
  ticker: string | null;
  period: string;
  ohlcv: OHLCVRow[];
  indicators: Record<string, IndicatorPoint[]>;
  fundamentals: FundamentalsData | null;

  // Stage 2
  strategyName: string | null;
  strategyParams: Record<string, unknown>;
  signals: SignalPoint[];
  signalSummary: { buy_count: number; sell_count: number; hold_count: number; total: number } | null;
  mlMetrics: Record<string, unknown> | null;

  // Stage 3
  initialCapital: number;
  portfolio: PortfolioPoint[];
  benchmarkPortfolio: PortfolioPoint[];
  trades: TradeRecord[];
  tradeStats: TradeStats | null;
  dailyReturns: number[];

  // Stage 4
  riskMetrics: RiskMetrics | null;
  monteCarloResult: MonteCarloResult | null;

  // Comparison
  comparisonResults: ComparisonEntry[];

  // UI
  loading: Record<string, boolean>;
  error: string | null;

  // Actions
  setActiveStage: (stage: number) => void;
  completeStage: (stage: number) => void;
  clearDownstream: (fromStage: number) => void;
  setLoading: (key: string, value: boolean) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;

  setExploreData: (data: {
    ticker: string;
    period: string;
    ohlcv: OHLCVRow[];
    indicators: Record<string, IndicatorPoint[]>;
    fundamentals: FundamentalsData | null;
  }) => void;

  setStrategyData: (data: {
    strategyName: string;
    strategyParams: Record<string, unknown>;
    signals: SignalPoint[];
    signalSummary: { buy_count: number; sell_count: number; hold_count: number; total: number };
    mlMetrics?: Record<string, unknown> | null;
  }) => void;

  setBacktestData: (data: {
    initialCapital: number;
    portfolio: PortfolioPoint[];
    benchmarkPortfolio: PortfolioPoint[];
    trades: TradeRecord[];
    tradeStats: TradeStats;
    dailyReturns: number[];
  }) => void;

  setRiskData: (metrics: RiskMetrics) => void;
  setMonteCarloData: (result: MonteCarloResult) => void;
  addComparison: (entry: Omit<ComparisonEntry, "id">) => void;
  removeComparison: (id: string) => void;
  clearComparison: () => void;
}

const BLANK: Omit<TradingState, "loading" | "error" | keyof Pick<TradingState,
  "setActiveStage" | "completeStage" | "clearDownstream" | "setLoading" | "setError" | "clearSession" |
  "setExploreData" | "setStrategyData" | "setBacktestData" | "setRiskData" | "setMonteCarloData" |
  "addComparison" | "removeComparison" | "clearComparison"
>> = {
  activeStage: 1,
  completedStages: [],
  ticker: null,
  period: "2y",
  ohlcv: [],
  indicators: {},
  fundamentals: null,
  strategyName: null,
  strategyParams: {},
  signals: [],
  signalSummary: null,
  mlMetrics: null,
  initialCapital: 10000,
  portfolio: [],
  benchmarkPortfolio: [],
  trades: [],
  tradeStats: null,
  dailyReturns: [],
  riskMetrics: null,
  monteCarloResult: null,
  comparisonResults: [],
};

export const useStore = create<TradingState>()(
  persist(
    immer((set) => ({
      ...BLANK,
      loading: {},
      error: null,

      setActiveStage: (stage) => set((s) => { s.activeStage = stage; }),

      completeStage: (stage) => set((s) => {
        if (!s.completedStages.includes(stage)) {
          s.completedStages.push(stage);
          s.completedStages.sort();
        }
      }),

      clearDownstream: (fromStage) => set((s) => {
        s.completedStages = s.completedStages.filter((n) => n < fromStage);
        if (fromStage <= 2) { s.strategyName = null; s.signals = []; s.signalSummary = null; s.mlMetrics = null; }
        if (fromStage <= 3) { s.portfolio = []; s.trades = []; s.tradeStats = null; s.dailyReturns = []; s.benchmarkPortfolio = []; }
        if (fromStage <= 4) { s.riskMetrics = null; s.monteCarloResult = null; }
      }),

      setLoading: (key, value) => set((s) => { s.loading[key] = value; }),
      setError: (error) => set((s) => { s.error = error; }),

      clearSession: () => set((s) => {
        Object.assign(s, { ...BLANK, loading: {}, error: null });
      }),

      setExploreData: (data) => set((s) => {
        const tickerChanged = s.ticker !== data.ticker;
        s.ticker = data.ticker;
        s.period = data.period;
        s.ohlcv = data.ohlcv;
        s.indicators = data.indicators;
        s.fundamentals = data.fundamentals;
        if (tickerChanged) {
          s.completedStages = [];
          s.strategyName = null; s.signals = []; s.signalSummary = null; s.mlMetrics = null;
          s.portfolio = []; s.trades = []; s.tradeStats = null; s.dailyReturns = []; s.benchmarkPortfolio = [];
          s.riskMetrics = null; s.monteCarloResult = null;
        }
        if (!s.completedStages.includes(1)) { s.completedStages.push(1); s.completedStages.sort(); }
      }),

      setStrategyData: (data) => set((s) => {
        s.strategyName = data.strategyName;
        s.strategyParams = data.strategyParams;
        s.signals = data.signals;
        s.signalSummary = data.signalSummary;
        s.mlMetrics = data.mlMetrics || null;
        s.completedStages = s.completedStages.filter((n) => n < 2);
        s.portfolio = []; s.trades = []; s.tradeStats = null; s.dailyReturns = []; s.benchmarkPortfolio = [];
        s.riskMetrics = null; s.monteCarloResult = null;
        s.completedStages.push(2); s.completedStages.sort();
      }),

      setBacktestData: (data) => set((s) => {
        s.initialCapital = data.initialCapital;
        s.portfolio = data.portfolio;
        s.benchmarkPortfolio = data.benchmarkPortfolio;
        s.trades = data.trades;
        s.tradeStats = data.tradeStats;
        s.dailyReturns = data.dailyReturns;
        s.completedStages = s.completedStages.filter((n) => n < 3);
        s.riskMetrics = null; s.monteCarloResult = null;
        s.completedStages.push(3); s.completedStages.sort();
      }),

      setRiskData: (metrics) => set((s) => {
        s.riskMetrics = metrics;
        if (!s.completedStages.includes(4)) { s.completedStages.push(4); s.completedStages.sort(); }
      }),

      setMonteCarloData: (result) => set((s) => { s.monteCarloResult = result; }),

      addComparison: (entry) => set((s) => {
        s.comparisonResults.push({ ...entry, id: Date.now().toString() });
      }),

      removeComparison: (id) => set((s) => {
        s.comparisonResults = s.comparisonResults.filter((e) => e.id !== id);
      }),

      clearComparison: () => set((s) => { s.comparisonResults = []; }),
    })),
    {
      name: "trading-analytics-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeStage: state.activeStage,
        completedStages: state.completedStages,
        ticker: state.ticker,
        period: state.period,
        ohlcv: state.ohlcv,
        indicators: state.indicators,
        fundamentals: state.fundamentals,
        strategyName: state.strategyName,
        strategyParams: state.strategyParams,
        signals: state.signals,
        signalSummary: state.signalSummary,
        mlMetrics: state.mlMetrics,
        initialCapital: state.initialCapital,
        portfolio: state.portfolio,
        benchmarkPortfolio: state.benchmarkPortfolio,
        trades: state.trades,
        tradeStats: state.tradeStats,
        dailyReturns: state.dailyReturns,
        riskMetrics: state.riskMetrics,
        monteCarloResult: state.monteCarloResult,
        comparisonResults: state.comparisonResults,
      }),
    }
  )
);
