"use client";

import { KPICard, fmt } from "@/components/shared/KPICard";
import type { FundamentalsData } from "@/types";

interface Props {
  data: FundamentalsData;
}

function Section({ title, question, children }: { title: string; question: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{question}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}

export function FundamentalsGrid({ data }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{data.name}</h3>
        <p className="text-sm text-muted-foreground">{data.sector} &middot; {data.industry}</p>
      </div>

      <Section title="Company" question="What is the company worth?">
        <KPICard label="Market Cap" value={fmt(data.market_cap, { bn: true, prefix: "$" })} description="total company value" />
        <KPICard label="EPS" value={fmt(data.eps, { prefix: "$" })} description="earnings per share" />
        <KPICard label="Rev. Growth" value={fmt(data.revenue_growth, { pct: true })} description="year-over-year revenue" />
        <KPICard label="D/E" value={fmt(data.debt_to_equity)} description="debt vs. equity" />
      </Section>

      <Section title="vs. Market" question="How does it compare to the market?">
        <KPICard label="P/E (TTM)" value={fmt(data.pe)} description="price / earnings (trailing)" />
        <KPICard label="Forward P/E" value={fmt(data.forward_pe)} description="price / future earnings" />
        <KPICard label="P/B" value={fmt(data.price_to_book)} description="price / book value" />
        <KPICard label="EV/EBITDA" value={fmt(data.ev_to_ebitda)} description="enterprise valuation" />
        <KPICard label="Beta" value={fmt(data.beta)} description="volatility vs. market" />
        <KPICard label="52W High" value={fmt(data.high_52w, { prefix: "$" })} description="52-week peak price" />
        <KPICard label="52W Low" value={fmt(data.low_52w, { prefix: "$" })} description="52-week lowest price" />
      </Section>

      <Section title="Returns" question="What does it return to investors?">
        <KPICard label="Profit Margin" value={fmt(data.profit_margin, { pct: true })} description="net profit as % of revenue" />
        <KPICard label="ROE" value={fmt(data.roe, { pct: true })} description="return on equity" />
        <KPICard label="ROA" value={fmt(data.roa, { pct: true })} description="return on assets" />
        <KPICard label="Gross Margin" value={fmt(data.gross_margins, { pct: true })} description="gross profit as % of revenue" />
        <KPICard label="Div. Yield" value={fmt(data.dividend_yield, { pct: true })} description="annual dividend %" />
      </Section>
    </div>
  );
}
