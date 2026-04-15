"use client";

import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/stores/store";

export function FeaturesPanel() {
  const markFeaturesVisited = useStore((s) => s.markFeaturesVisited);

  useEffect(() => {
    markFeaturesVisited();
  }, [markFeaturesVisited]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Feature Engineering</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Placeholder — this is where engineered features (labels, transforms, feature
        importance) will be configured before signal generation.
      </CardContent>
    </Card>
  );
}
