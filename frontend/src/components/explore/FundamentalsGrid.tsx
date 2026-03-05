"use client";

import { KPICard, fmt } from "@/components/shared/KPICard";
import type { FundamentalsData } from "@/types";

interface Props {
  data: FundamentalsData;
}

export function FundamentalsGrid({ data }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{data.name}</h3>
        <p className="text-sm text-muted-foreground">{data.sector} &middot; {data.industry}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard label="Market Cap" value={fmt(data.market_cap, { bn: true, prefix: "$" })} />
        <KPICard label="P/E (TTM)" value={fmt(data.pe)} />
        <KPICard label="Forward P/E" value={fmt(data.forward_pe)} />
        <KPICard label="EPS" value={fmt(data.eps, { prefix: "$" })} />
        <KPICard label="P/B" value={fmt(data.price_to_book)} />
        <KPICard label="EV/EBITDA" value={fmt(data.ev_to_ebitda)} />
        <KPICard label="Div. Yield" value={fmt(data.dividend_yield, { pct: true })} />
        <KPICard label="Beta" value={fmt(data.beta)} />
        <KPICard label="52W High" value={fmt(data.high_52w, { prefix: "$" })} />
        <KPICard label="52W Low" value={fmt(data.low_52w, { prefix: "$" })} />
        <KPICard label="Profit Margin" value={fmt(data.profit_margin, { pct: true })} />
        <KPICard label="ROE" value={fmt(data.roe, { pct: true })} />
        <KPICard label="ROA" value={fmt(data.roa, { pct: true })} />
        <KPICard label="D/E" value={fmt(data.debt_to_equity)} />
        <KPICard label="Rev. Growth" value={fmt(data.revenue_growth, { pct: true })} />
        <KPICard label="Gross Margin" value={fmt(data.gross_margins, { pct: true })} />
      </div>
    </div>
  );
}
