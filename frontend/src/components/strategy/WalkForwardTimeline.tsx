"use client";

interface FoldResult {
  fold: number;
  train_start: string;
  train_end: string;
  test_start: string;
  test_end: string;
  n_train: number;
  n_test: number;
  accuracy?: number;
  f1?: number;
  roc_auc?: number | null;
}

interface Props {
  folds: FoldResult[];
  nFolds: number;
}

function toMs(iso: string) {
  return new Date(iso).getTime();
}

export function WalkForwardTimeline({ folds, nFolds }: Props) {
  if (!folds || folds.length === 0) return null;

  const allDates = folds.flatMap((f) => [
    toMs(f.train_start), toMs(f.train_end),
    toMs(f.test_start), toMs(f.test_end),
  ]);
  const minMs = Math.min(...allDates);
  const maxMs = Math.max(...allDates);
  const range = maxMs - minMs;

  function pct(ms: number) {
    return ((ms - minMs) / range) * 100;
  }

  function fmtDate(iso: string) {
    return iso.split("T")[0].slice(0, 7);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Fold Timeline</p>
        <span className="text-[10px] text-muted-foreground">Training (IS) and test (OOS) windows per fold</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{fmtDate(folds[0].train_start)}</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm bg-blue-500/60" /> Train
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm bg-emerald-500/70" /> Test (OOS)
          </span>
          <span>{nFolds} folds</span>
        </div>
        <span>{fmtDate(folds[folds.length - 1].test_end)}</span>
      </div>


      <div className="space-y-1.5">
        {folds.map((fold) => {
          const trainLeft = pct(toMs(fold.train_start));
          const trainWidth = pct(toMs(fold.train_end)) - trainLeft;
          const testLeft = pct(toMs(fold.test_start));
          const testWidth = pct(toMs(fold.test_end)) - testLeft;

          return (
            <div key={fold.fold} className="relative h-6 rounded overflow-hidden bg-muted/20">
              <div
                className="absolute h-full bg-blue-500/30 border border-blue-500/40 rounded-sm"
                style={{ left: `${trainLeft}%`, width: `${trainWidth}%` }}
                title={`Train: ${fmtDate(fold.train_start)} – ${fmtDate(fold.train_end)} (${fold.n_train} bars)`}
              />
              <div
                className="absolute h-full bg-emerald-500/50 border border-emerald-500/60 rounded-sm"
                style={{ left: `${testLeft}%`, width: `${testWidth}%` }}
                title={`Test: ${fmtDate(fold.test_start)} – ${fmtDate(fold.test_end)} (${fold.n_test} bars)`}
              />
              <span className="absolute left-1 top-1 text-[10px] text-muted-foreground leading-none">
                Fold {fold.fold}
              </span>
              {fold.accuracy != null && (
                <span className="absolute right-1 top-1 text-[10px] font-mono text-muted-foreground leading-none">
                  Acc {(fold.accuracy * 100).toFixed(0)}%
                  {fold.f1 != null && <span className="ml-1.5">F1 {(fold.f1 * 100).toFixed(0)}%</span>}
                  {fold.roc_auc != null && <span className="ml-1.5">AUC {(fold.roc_auc * 100).toFixed(0)}%</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
