"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";

const ML_MODELS = ["Random Forest", "Gradient Boosting", "Logistic Regression"];
const DEFAULT_FEATURES = ["RSI", "MACD_HIST", "MFI", "BB_Percent"];
const EXCLUDED_FEATURES = ["Open", "High", "Low", "Close", "Volume", "ATR", "VWAP", "STOCH_K", "STOCH_D", "BB_Bandwidth"];
const MARKET_STATS_FEATURES = ["Volume_Ratio", "HV_20"];

const FUNDAMENTAL_FEATURES: { key: string; label: string }[] = [
  { key: "pe", label: "P/E" },
  { key: "forward_pe", label: "Fwd P/E" },
  { key: "beta", label: "Beta" },
  { key: "eps", label: "EPS" },
  { key: "dividend_yield", label: "Div. Yield" },
  { key: "profit_margin", label: "Profit Margin" },
  { key: "roe", label: "ROE" },
  { key: "roa", label: "ROA" },
  { key: "debt_to_equity", label: "D/E" },
  { key: "revenue_growth", label: "Rev. Growth" },
  { key: "gross_margins", label: "Gross Margin" },
  { key: "current_ratio", label: "Current Ratio" },
  { key: "price_to_book", label: "P/B" },
  { key: "ev_to_ebitda", label: "EV/EBITDA" },
];


interface ParamCardProps {
  label: string;
  description: string;
  value: string;
  children: React.ReactNode;
}

function ParamCard({ label, description, value, children }: ParamCardProps) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{description}</p>
        </div>
        <span className="text-sm font-mono font-semibold text-primary shrink-0">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function SignalsForm() {
  const { ticker, period, interval, ohlcv, indicators, fundamentals, setSignalsData, clearSignalsData, setLoading, setError } = useStore();
  const [activeTab, setActiveTab] = useState("supervised");

  // ML state
  const [modelType, setModelType] = useState(ML_MODELS[0]);
  const [features, setFeatures] = useState<string[]>(DEFAULT_FEATURES);
  const [fundFeatures, setFundFeatures] = useState<string[]>([]);
  const [trainRatio, setTrainRatio] = useState(0.8);
  const [threshold, setThreshold] = useState(0.55);
  const [targetShift, setTargetShift] = useState(1);
  // Walk-forward state
  const [walkForward, setWalkForward] = useState(false);
  const [trainWindow, setTrainWindow] = useState(252);
  const [wfStep, setWfStep] = useState(63);

  function toggleFeature(f: string) {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }

  function toggleFundFeature(key: string) {
    setFundFeatures((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  }

  function buildFundamentalValues(): Record<string, number> | undefined {
    if (!fundamentals || fundFeatures.length === 0) return undefined;
    const result: Record<string, number> = {};
    for (const key of fundFeatures) {
      const val = (fundamentals as unknown as Record<string, number | null>)[key];
      if (val != null && !isNaN(val)) result[key] = val;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  function handleTabChange(tab: string) {
    clearSignalsData();
    setActiveTab(tab);
  }

  async function runML() {
    if (!ticker) return;
    setLoading("signals", true);
    setError(null);
    try {
      const fundamental_values = buildFundamentalValues();
      if (walkForward) {
        const res = await api.walkForward({
          ticker, period, interval, model_type: modelType,
          features, train_window: trainWindow, step: wfStep,
          threshold, target_shift: targetShift,
        }) as any;
        setSignalsData({
          signalName: res.signal_name,
          signalParams: { model_type: modelType, features, threshold, target_shift: targetShift, train_window: trainWindow, wf_step: wfStep, is_walk_forward: true },
          signals: res.signals,
          wfBaseSignals: res.base_signals || [],
          signalSummary: res.signal_summary,
          mlMetrics: { n_folds: res.n_folds, fold_results: res.fold_results },
        });
      } else {
        const res = await api.signals({
          ticker, period, interval, model_type: modelType,
          features, train_ratio: trainRatio, threshold, target_shift: targetShift,
          fundamental_values,
        }) as any;
        setSignalsData({
          signalName: res.signal_name,
          signalParams: { model_type: modelType, features, train_ratio: trainRatio, threshold, target_shift: targetShift },
          signals: res.signals,
          signalSummary: res.signal_summary,
          mlMetrics: res.ml_metrics,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ML training failed");
    } finally {
      setLoading("signals", false);
    }
  }

  const availableFeatures = Object.keys(indicators).filter(
    (k) => !EXCLUDED_FEATURES.includes(k) && !MARKET_STATS_FEATURES.includes(k)
  );

  const availableMarketStats = MARKET_STATS_FEATURES.filter(
    (k) => Object.keys(indicators).includes(k)
  );

  const availableFundamentals = FUNDAMENTAL_FEATURES.filter(
    ({ key }) => fundamentals && (fundamentals as unknown as Record<string, number | null>)[key] != null
  );

  const totalBars = ohlcv.length || 504;
  const estimatedFolds = Math.max(0, Math.floor((totalBars - trainWindow) / wfStep));

  const foldColor =
    estimatedFolds >= 3 ? "text-emerald-400" :
    estimatedFolds >= 1 ? "text-amber-400" :
    "text-red-400";

  const foldHint =
    estimatedFolds === 0
      ? "IS window too large for the selected period — reduce it or choose a longer period"
      : `~${estimatedFolds} fold${estimatedFolds !== 1 ? "s" : ""} expected`;

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList>
        <TabsTrigger value="supervised">Supervised Learning</TabsTrigger>
        <TabsTrigger value="unsupervised">Unsupervised Learning</TabsTrigger>
      </TabsList>

      <TabsContent value="supervised" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">ML Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Model selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Model</p>
              <Select value={modelType} onValueChange={setModelType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ML_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Walk-Forward toggle block */}
            <div className={`rounded-lg border p-4 space-y-1 transition-colors ${walkForward ? "border-primary/40 bg-primary/5" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Walk-Forward Validation (WFA)</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] text-muted-foreground">{walkForward ? "ON" : "OFF"}</span>
                  <input
                    type="checkbox"
                    checked={walkForward}
                    onChange={(e) => setWalkForward(e.target.checked)}
                    className="rounded"
                  />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Trains on rolling IS windows and tests on unseen OOS periods.
                Detects overfitting — if IS and OOS performance are similar, the model generalizes well.
                <span className="block mt-0.5 opacity-60">IS = In-Sample (Training) · OOS = Out-of-Sample (Validation)</span>
              </p>
            </div>

            {/* Parameters */}
            {walkForward ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ParamCard
                    label="IS Window (Training)"
                    description="Number of historical bars per training window (In-Sample)."
                    value={`${trainWindow}d`}
                  >
                    <Slider min={63} max={504} step={63} value={[trainWindow]} onValueChange={([v]) => setTrainWindow(v)} />
                  </ParamCard>
                  <ParamCard
                    label="OOS Step (Test Window)"
                    description="How far the window advances after each fold (Out-of-Sample)."
                    value={`${wfStep}d`}
                  >
                    <Slider min={21} max={126} step={21} value={[wfStep]} onValueChange={([v]) => setWfStep(v)} />
                  </ParamCard>
                  <ParamCard
                    label="Signal Threshold"
                    description="Minimum model confidence to generate a signal. Higher = fewer but stronger signals."
                    value={threshold.toFixed(2)}
                  >
                    <Slider min={0.5} max={0.7} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                  </ParamCard>
                  <ParamCard
                    label="Prediction Horizon"
                    description="How many days ahead the model predicts price direction."
                    value={`${targetShift}d`}
                  >
                    <Slider min={1} max={20} step={1} value={[targetShift]} onValueChange={([v]) => setTargetShift(v)} />
                  </ParamCard>
                </div>
                <p className={`text-xs font-medium ${foldColor}`}>{foldHint}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ParamCard
                  label="In-Sample Ratio"
                  description="Share of data used for training. The remainder is held out as out-of-sample validation."
                  value={`${Math.round(trainRatio * 100)}%`}
                >
                  <Slider min={0.6} max={0.9} step={0.05} value={[trainRatio]} onValueChange={([v]) => setTrainRatio(v)} />
                </ParamCard>
                <ParamCard
                  label="Signal Threshold"
                  description="Minimum model confidence to generate a buy or sell signal. Higher = fewer but stronger signals."
                  value={threshold.toFixed(2)}
                >
                  <Slider min={0.5} max={0.7} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                </ParamCard>
                <ParamCard
                  label="Prediction Horizon"
                  description="How many days ahead the model predicts price direction."
                  value={`${targetShift}d`}
                >
                  <Slider min={1} max={20} step={1} value={[targetShift]} onValueChange={([v]) => setTargetShift(v)} />
                </ParamCard>
              </div>
            )}

            {/* Feature selection */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Technical Indicators</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableFeatures.map((f) => (
                    <Button
                      key={f} size="sm" variant={features.includes(f) ? "default" : "outline"}
                      className="text-xs h-6 px-2"
                      onClick={() => toggleFeature(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>

              {availableMarketStats.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Market Stats</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Volume and volatility context features derived from market microstructure.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableMarketStats.map((f) => (
                      <Button
                        key={f} size="sm" variant={features.includes(f) ? "default" : "outline"}
                        className="text-xs h-6 px-2"
                        onClick={() => toggleFeature(f)}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {availableFundamentals.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Fundamentals</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Current snapshot values — used as constant features across all training bars.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableFundamentals.map(({ key, label }) => (
                      <Button
                        key={key} size="sm" variant={fundFeatures.includes(key) ? "default" : "outline"}
                        className="text-xs h-6 px-2"
                        onClick={() => toggleFundFeature(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button onClick={runML} className="w-full">
              {walkForward ? "Run Walk-Forward" : "Train Model"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="unsupervised" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Unsupervised Learning</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Placeholder — clustering and regime detection will live here.
          </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  );
}
