export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export type FilingStatus = "pass" | "warn" | "fail";

export type DashboardFiling = {
  id: string;
  fund: string;
  period: string;
  holdings: number;
  errors: number;
  warnings: number;
  conformance_percent: number;
  status: FilingStatus;
};

export type DashboardSummary = {
  has_data: boolean;
  total_filings: number;
  passed_filings: number;
  failed_filings: number;
  total_holdings: number;
  open_errors: number;
  warnings: number;
  conformance_percent: number | null;
  tier2_discrepancy_rate: number | null;
  rule_flag_rates: RuleFlagRate[];
  filings_per_second: number | null;
  holdings_per_second: number | null;
  peak_rss_mb_per_worker: number | null;
  recent_filings: DashboardFiling[];
};

export type BatchResult = {
  elapsed_seconds: number;
  worker_count: number | null;
  total_filings: number;
  passed_filings: number;
  failed_filings: number;
  cache_hits: number;
  total_holdings: number;
  filings_per_second: number;
  holdings_per_second: number;
  peak_rss_mb_per_worker: number | null;
  rule_flag_rates: RuleFlagRate[];
  results: Array<{
    path: string;
    holdings: number;
    errors: number;
    warnings: number;
    passed: boolean;
    elapsed_seconds: number;
    holdings_per_second?: number;
    peak_rss_mb?: number;
    cache_hit?: boolean;
  }>;
};

export type RuleRow = {
  rule_id: string;
  description: string;
  severity: "error" | "warning";
  spec_clause: string;
  schema_elements: string[];
  scope: "holding" | "filing";
  status: "live" | "cut" | "no_data";
};

export type RuleFlagRate = {
  rule_id: string;
  description: string;
  severity: "error" | "warning";
  scope: "holding" | "filing";
  status: "live" | "cut" | "no_data";
  schema_elements: string[];
  flagged: number;
  denominator: number | null;
  flag_rate: number | null;
};

export type HoldingApiRow = {
  holding_id: string;
  issuer_name: string;
  identifiers: {
    lei?: string | null;
    cusip?: string | null;
    isin?: string | null;
    ticker?: string | null;
    other?: string | null;
  };
  security_category: string;
  currency?: string | null;
  value_usd?: string | null;
  percent_of_net_assets: string;
  liquidity_classification?: string | null;
};

export type HoldingsResponse = {
  total: number;
  offset: number;
  limit: number;
  rows: HoldingApiRow[];
};

export type FilingReport = {
  status: string;
  passed: boolean;
  errors: number;
  warnings: number;
  failures_by_rule: Record<string, Array<{ message: string; severity: "error" | "warning"; holding_id?: string }>>;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export async function fetchDashboardSummary() {
  return getJson<DashboardSummary>("/dashboard");
}

export async function fetchLatestBatch() {
  return getJson<{ has_data: boolean; batch: BatchResult | null }>("/batch/latest");
}

export async function fetchRules() {
  return getJson<{ rules: RuleRow[] }>("/rules");
}

export async function fetchHoldings(filingId: string) {
  return getJson<HoldingsResponse>(`/filings/${filingId}/holdings?limit=500`);
}

export async function fetchReport(filingId: string) {
  return getJson<FilingReport>(`/filings/${filingId}/report`);
}

export async function uploadFiling(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/filings`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<{ id: string; status: string }>;
}
