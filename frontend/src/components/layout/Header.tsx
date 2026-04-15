"use client";

import { useStore } from "@/stores/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Header() {
  const { ticker, signalName, loading, error, clearSession } = useStore();
  const isLoading = Object.values(loading).some(Boolean);

  return (
    <header className="h-14 border-b border-border bg-card px-6 flex items-center gap-4 shrink-0">
      {ticker && (
        <Badge variant="secondary" className="text-sm font-mono">
          {ticker}
        </Badge>
      )}
      {signalName && (
        <Badge variant="outline" className="text-xs">
          {signalName}
        </Badge>
      )}
      <div className="flex-1" />
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      )}
      {error && <p className="text-xs text-red-400 truncate max-w-md">{error}</p>}
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={clearSession}
      >
        Clear Session
      </Button>
    </header>
  );
}
