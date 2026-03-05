export interface OHLCVRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPoint {
  date: string;
  value: number;
}

export interface FundamentalsData {
  name: string | null;
  sector: string | null;
  industry: string | null;
  pe: number | null;
  forward_pe: number | null;
  market_cap: number | null;
  revenue: number | null;
  eps: number | null;
  dividend_yield: number | null;
  high_52w: number | null;
  low_52w: number | null;
  beta: number | null;
  profit_margin: number | null;
  roe: number | null;
  roa: number | null;
  debt_to_equity: number | null;
  revenue_growth: number | null;
  gross_margins: number | null;
  current_ratio: number | null;
  price_to_book: number | null;
  ev_to_ebitda: number | null;
}

export interface SignalPoint {
  date: string;
  signal: number;
  price: number;
}

export interface PortfolioPoint {
  date: string;
  value: number;
  cumulative_return: number;
}

export interface TradeRecord {
  entry_date: string;
  exit_date: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  shares: number;
  return_pct: number;
  holding_days: number;
  pnl: number;
  commission_entry: number;
  commission_exit: number;
}

export interface TradeStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  profit_factor: number;
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  max_drawdown_duration_days: number;
  sharpe_ratio: number;
}

export interface RiskMetrics {
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  var_95: number;
  var_99: number;
  cvar_95: number;
  calmar_ratio: number;
  annualized_return: number;
  annualized_volatility: number;
  beta: number | null;
  alpha: number | null;
  information_ratio: number | null;
}

export interface MonteCarloResult {
  percentiles: Array<{ level: number; values: number[] }>;
  median_path: number[];
  probability_of_loss: number;
  expected_value: number;
  median_value: number;
  best_case: number;
  worst_case: number;
  final_values_histogram: number[];
}

export interface StrategyParam {
  label: string;
  min: number;
  max: number;
  default: number;
}

export interface StrategyRegistry {
  [name: string]: { [param: string]: StrategyParam };
}
