"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/stores/store";
import { PriceDerivedPanel } from "./PriceDerivedPanel";
import { FundamentalsGrid } from "@/components/explore/FundamentalsGrid";

export function FeaturesPanel() {
  const markFeaturesVisited = useStore((s) => s.markFeaturesVisited);
  const indicators = useStore((s) => s.indicators);
  const fundamentals = useStore((s) => s.fundamentals);

  useEffect(() => {
    markFeaturesVisited();
  }, [markFeaturesVisited]);

  const hasIndicators = Object.keys(indicators).length > 0;

  if (!hasIndicators) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Load a ticker in the Explore stage first to see available features.
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="price-derived">
      <TabsList>
        <TabsTrigger value="price-derived">Price-Derived</TabsTrigger>
        <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
        <TabsTrigger value="macro">Macro</TabsTrigger>
        <TabsTrigger value="alternative">Alternative</TabsTrigger>
      </TabsList>

      <TabsContent value="price-derived">
        <PriceDerivedPanel indicators={indicators} />
      </TabsContent>

      <TabsContent value="fundamentals">
        {fundamentals ? (
          <FundamentalsGrid data={fundamentals} />
        ) : (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No fundamental data available for this ticker.
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="macro">
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Macro indicators — coming soon.
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="alternative">
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Alternative data sources — coming soon.
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
