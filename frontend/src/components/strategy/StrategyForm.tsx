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

const ML_MODELS = ["Random Forest", "Gradient Boosting", "Logistic Regression"];
const DEFAULT_FEATURES = ["RSI", "MACD_HIST", "MFI", "BB_Percent", "STOCH_K"];

export function StrategyForm() {
  const { ticker, period, indicators, setStrategyData, setLoading, setError } = useStore();
  const [registry, setRegistry] = useState<StrategyRegistry>({});
  const [stratName, setStratName] = useState("");
  const [params, setParams] = useState<Record<string, number>>({});

  // ML state
  const [modelType, setModelType] = useState(ML_MODELS[0]);
  const [features, setFeatures] = useState<string[]>(DEFAULT_FEATURES);
  const [trainRatio, setTrainRatio] = useState(0.8);
  const [threshold, setThreshold] = useState(0.55);
  const [targetShift, setTargetShift] = useState(1);
  // Walk-forward state
  const [walkForward, setWalkForward] = useState(false);
  const [trainWindow, setTrainWindow] = useState(504);
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
          signalSummary: res.signal_summary,
          mlMetrics: { n_folds: res.n_folds, fold_results: res.fold_results },
        });
      } else {
        const res = await api.strategy({
          ticker, period, strategy_name: "ML", model_type: modelType,
          features, train_ratio: trainRatio, threshold, target_shift: targetShift,
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
    (k) => !["Open", "High", "Low", "Close", "Volume"].includes(k)
  );

  return (
    <Tabs defaultValue="rule" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rule">Rule-Based</TabsTrigger>
        <TabsTrigger value="ml">Machine Learning</TabsTrigger>
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
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Select value={modelType} onValueChange={setModelType}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ML_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={walkForward}
                  onChange={(e) => setWalkForward(e.target.checked)}
                  className="rounded"
                />
                Walk-Forward
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Features</label>
              <div className="flex flex-wrap gap-1">
                {availableFeatures.map((f) => (
                  <Button
                    key={f} size="sm" variant={features.includes(f) ? "default" : "outline"}
                    className="text-xs h-6 px-2"
                    onClick={() => setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            {walkForward ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Train Window</span><span>{trainWindow}d</span></div>
                  <Slider min={126} max={756} step={63} value={[trainWindow]} onValueChange={([v]) => setTrainWindow(v)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Step Size</span><span>{wfStep}d</span></div>
                  <Slider min={21} max={126} step={21} value={[wfStep]} onValueChange={([v]) => setWfStep(v)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Threshold</span><span>{threshold}</span></div>
                  <Slider min={0.5} max={0.7} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Train Ratio</span><span>{trainRatio}</span></div>
                  <Slider min={0.6} max={0.9} step={0.05} value={[trainRatio]} onValueChange={([v]) => setTrainRatio(v)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Threshold</span><span>{threshold}</span></div>
                  <Slider min={0.5} max={0.7} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Horizon</span><span>{targetShift}d</span></div>
                  <Slider min={1} max={20} step={1} value={[targetShift]} onValueChange={([v]) => setTargetShift(v)} />
                </div>
              </div>
            )}

            <Button onClick={runML} className="w-full">
              {walkForward ? "Run Walk-Forward" : "Train Model"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
