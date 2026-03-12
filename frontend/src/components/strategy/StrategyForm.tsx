"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";
import type { StrategyRegistry } from "@/types";
import { ParamSweepPanel } from "./ParamSweepPanel";

const ML_MODELS = ["Random Forest", "Gradient Boosting", "Logistic Regression"];
const DEFAULT_FEATURES = ["RSI", "MACD_HIST", "MFI", "BB_Percent"];
const EXCLUDED_FEATURES = ["Open", "High", "Low", "Close", "Volume", "ATR", "VWAP", "STOCH_K", "STOCH_D", "BB_Bandwidth"];

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

const PERIOD_BARS: Record<string, number> = {
  "6mo": 126, "1y": 252, "2y": 504, "5y": 1260, "10y": 2520,
};

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

export function StrategyForm() {
  const { ticker, period, indicators, fundamentals, setStrategyData, clearStrategyData, setLoading, setError } = useStore();
  const [activeTab, setActiveTab] = useState("rule");
  const [registry, setRegistry] = useState<StrategyRegistry>({});
  const [stratName, setStratName] = useState("");
  const [params, setParams] = useState<Record<string, number>>({});

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

  useEffect(() => {
    api.strategies().then((r) => {
      setRegistry(r);
      const first = Object.keys(r)[0];
      if (first) {
        setStratName(first);
        const defaults: Record<string, number> = {};
        Object.entries(r[first]).forEach(([k, v]) => { defaults[k] = v.default; });
        setParams(defaults);
      }
    });
  }, []);

  function onStrategyChange(name: string) {
    setStratName(name);
    const defaults: Record<string, number> = {};
    Object.entries(registry[name] || {}).forEach(([k, v]) => { defaults[k] = v.default; });
    setParams(defaults);
  }

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
    clearStrategyData();
    setActiveTab(tab);
  }

  function handleUseBest(paramKey: string, value: number) {
    setParams((prev) => ({ ...prev, [paramKey]: value }));
    clearStrategyData();
    setActiveTab("rule");
  }

  async function runRuleBased() {
    if (!ticker) return;
    setLoading("strategy", true);
    setError(null);
    try {
      const res = await api.strategy({ ticker, period, strategy_name: stratName, params }) as any;
      setStrategyData({
        strategyName: res.strategy_name,
        strategyParams: params,
        signals: res.signals,
        signalSummary: res.signal_summary,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Strategy failed");
    } finally {
      setLoading("strategy", false);
    }
  }

  async function runML() {
    if (!ticker) return;
    setLoading("strategy", true);
    setError(null);
    try {
      const fundamental_values = buildFundamentalValues();
      if (walkForward) {
        const res = await api.walkForward({
          ticker, period, model_type: modelType,
          features, train_window: trainWindow, step: wfStep,
          threshold, target_shift: targetShift,
        }) as any;
        setStrategyData({
          strategyName: res.strategy_name,
          strategyParams: { model_type: modelType, features, threshold, target_shift: targetShift },
          signals: res.signals,
          wfBaseSignals: res.base_signals || [],
          signalSummary: res.signal_summary,
          mlMetrics: { n_folds: res.n_folds, fold_results: res.fold_results },
        });
      } else {
        const res = await api.strategy({
          ticker, period, strategy_name: "ML", model_type: modelType,
          features, train_ratio: trainRatio, threshold, target_shift: targetShift,
          fundamental_values,
        }) as any;
        setStrategyData({
          strategyName: res.strategy_name,
          strategyParams: { model_type: modelType, features, train_ratio: trainRatio, threshold, target_shift: targetShift },
          signals: res.signals,
          signalSummary: res.signal_summary,
          mlMetrics: res.ml_metrics,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ML training failed");
    } finally {
      setLoading("strategy", false);
    }
  }

  const availableFeatures = Object.keys(indicators).filter(
    (k) => !EXCLUDED_FEATURES.includes(k)
  );

  const availableFundamentals = FUNDAMENTAL_FEATURES.filter(
    ({ key }) => fundamentals && (fundamentals as unknown as Record<string, number | null>)[key] != null
  );

  const estimatedFolds = Math.max(
    0, Math.floor(((PERIOD_BARS[period] ?? 504) - trainWindow) / wfStep)
  );

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
        <TabsTrigger value="rule">Rule-Based</TabsTrigger>
        <TabsTrigger value="ml">Machine Learning</TabsTrigger>
        <TabsTrigger value="sweep">Parameter Sweep</TabsTrigger>
      </TabsList>

      <TabsContent value="rule" className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Strategy Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={stratName} onValueChange={onStrategyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(registry).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            {Object.entries(registry[stratName] || {}).map(([k, spec]) => (
              <div key={k} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{spec.label}</span>
                  <span className="font-mono">{params[k]}</span>
                </div>
                <Slider
                  min={spec.min} max={spec.max} step={spec.max > 10 ? 1 : 0.1}
                  value={[params[k] ?? spec.default]}
                  onValueChange={([v]) => setParams((p) => ({ ...p, [k]: v }))}
                />
              </div>
            ))}
            <Button onClick={runRuleBased} className="w-full">Generate Signals</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ml" className="space-y-4">
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

      <TabsContent value="sweep" className="space-y-4">
        <ParamSweepPanel onUseBest={handleUseBest} />
      </TabsContent>
    </Tabs>
  );
}
