"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/stores/store";
import { api } from "@/lib/api";

const ML_MODELS = ["Random Forest", "Gradient Boosting", "Logistic Regression"];

const ALL_FEATURES = [
  "momentum_21d", "momentum_252_21d", "vol_ratio", "HV_20", "illiquidity", "autocorr_20",
  "RSI", "MACD_HIST", "ATR", "BB_Percent", "MFI", "Volume_Ratio",
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
  const { ticker, period, interval, ohlcv, indicators, setSignalsData, setLoading, setError } = useStore();

  const [modelType, setModelType] = useState(ML_MODELS[0]);
  const [trainRatio, setTrainRatio] = useState(0.8);
  const [threshold, setThreshold] = useState(0.55);
  const [targetShift, setTargetShift] = useState(1);
  const [walkForward, setWalkForward] = useState(false);
  const [trainWindow, setTrainWindow] = useState(252);
  const [wfStep, setWfStep] = useState(63);

  const availableFeatures = ALL_FEATURES.filter((f) => Object.keys(indicators).includes(f));

  async function runML() {
    if (!ticker) return;
    setLoading("signals", true);
    setError(null);
    try {
      if (walkForward) {
        const res = await api.walkForward({
          ticker, period, interval, model_type: modelType,
          features: availableFeatures, train_window: trainWindow, step: wfStep,
          threshold, target_shift: targetShift,
        }) as any;
        setSignalsData({
          signalName: res.signal_name,
          signalParams: { model_type: modelType, features: availableFeatures, threshold, target_shift: targetShift, train_window: trainWindow, wf_step: wfStep, is_walk_forward: true },
          signals: res.signals,
          wfBaseSignals: res.base_signals || [],
          signalSummary: res.signal_summary,
          mlMetrics: { n_folds: res.n_folds, fold_results: res.fold_results },
        });
      } else {
        const res = await api.signals({
          ticker, period, interval, model_type: modelType,
          features: availableFeatures, train_ratio: trainRatio, threshold, target_shift: targetShift,
        }) as any;
        setSignalsData({
          signalName: res.signal_name,
          signalParams: { model_type: modelType, features: availableFeatures, train_ratio: trainRatio, threshold, target_shift: targetShift },
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

  const totalBars = ohlcv.length || 504;
  const estimatedFolds = Math.max(0, Math.floor((totalBars - trainWindow) / wfStep));
  const foldColor = estimatedFolds >= 3 ? "text-emerald-400" : estimatedFolds >= 1 ? "text-amber-400" : "text-red-400";
  const foldHint = estimatedFolds === 0
    ? "IS window too large — reduce it or choose a longer period"
    : `~${estimatedFolds} fold${estimatedFolds !== 1 ? "s" : ""} expected`;

  return (
    <div className="space-y-4">
      {/* Supervised Learning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Supervised Learning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: model + params */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Model</p>
                <Select value={modelType} onValueChange={setModelType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ML_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {!walkForward ? (
                <div className="space-y-3">
                  <ParamCard label="In-Sample Ratio" description="Share of data for training." value={`${Math.round(trainRatio * 100)}%`}>
                    <Slider min={0.6} max={0.9} step={0.05} value={[trainRatio]} onValueChange={([v]) => setTrainRatio(v)} />
                  </ParamCard>
                  <ParamCard label="Signal Threshold" description="Min model confidence for a signal." value={threshold.toFixed(2)}>
                    <Slider min={0.5} max={0.7} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                  </ParamCard>
                  <ParamCard label="Prediction Horizon" description="Days ahead to predict." value={`${targetShift}d`}>
                    <Slider min={1} max={20} step={1} value={[targetShift]} onValueChange={([v]) => setTargetShift(v)} />
                  </ParamCard>
                </div>
              ) : (
                <div className="space-y-3">
                  <ParamCard label="Signal Threshold" description="Min model confidence for a signal." value={threshold.toFixed(2)}>
                    <Slider min={0.5} max={0.7} step={0.01} value={[threshold]} onValueChange={([v]) => setThreshold(v)} />
                  </ParamCard>
                  <ParamCard label="Prediction Horizon" description="Days ahead to predict." value={`${targetShift}d`}>
                    <Slider min={1} max={20} step={1} value={[targetShift]} onValueChange={([v]) => setTargetShift(v)} />
                  </ParamCard>
                </div>
              )}
            </div>

            {/* Right: walk-forward config */}
            <div className={`rounded-lg border p-4 space-y-4 transition-colors ${walkForward ? "border-primary/40 bg-primary/5" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Walk-Forward Validation</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] text-muted-foreground">{walkForward ? "ON" : "OFF"}</span>
                  <input type="checkbox" checked={walkForward} onChange={(e) => setWalkForward(e.target.checked)} className="rounded" />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Trains on rolling windows and tests on unseen periods. More realistic than a single split.
              </p>

              {walkForward && (
                <div className="space-y-3">
                  <ParamCard label="IS Window (Training)" description="Bars per training window." value={`${trainWindow}d`}>
                    <Slider min={63} max={504} step={63} value={[trainWindow]} onValueChange={([v]) => setTrainWindow(v)} />
                  </ParamCard>
                  <ParamCard label="OOS Step (Test)" description="Bars per test window." value={`${wfStep}d`}>
                    <Slider min={21} max={126} step={21} value={[wfStep]} onValueChange={([v]) => setWfStep(v)} />
                  </ParamCard>
                  <p className={`text-xs font-medium ${foldColor}`}>{foldHint}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Features ({availableFeatures.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableFeatures.map((f) => (
                <span key={f} className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{f}</span>
              ))}
            </div>
          </div>

          <Button onClick={runML} className="w-full">
            {walkForward ? "Run Walk-Forward" : "Train Model"}
          </Button>
        </CardContent>
      </Card>

      {/* Unsupervised Learning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Unsupervised Learning</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          HMM regime detection and clustering — coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
