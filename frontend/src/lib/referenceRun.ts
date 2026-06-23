import type { BatchResult, DashboardSummary, FilingReport, HoldingsResponse, RuleRow } from "./api";

export const IS_DEMO_MODE = ["1", "true", "yes"].includes(String(import.meta.env.VITE_DEMO_MODE ?? "").toLowerCase());

export const STATIC_DEMO_NOTICE =
  "Live validation runs locally. This is a static demo of a real GCAP 2025Q4 reference run.";

export const GCAP_REFERENCE_RUN = {
  label: "validated on a real GCAP 2025Q4 slice",
  filings: 4024,
  holdings: 1300501,
  passed: 3585,
  failed: 439,
  errors: 11632,
  warnings: 1079,
  holdingsPerSecond: 6712.33,
  peakRssMbPerWorker: 668.41,
  periodEnd: "2025-12-31",
  fxNote:
    "Non-USD valuations use currency_value / exchange_rate and reconcile against ECB quarter-end reference rates for 31 Dec 2025."
} as const;

export const GCAP_REFERENCE_PASS_RATE_PERCENT = (GCAP_REFERENCE_RUN.passed / GCAP_REFERENCE_RUN.filings) * 100;

export const REFERENCE_RULES = [
  {
    rule_id: "NP-ID-001",
    description: "At least one recognized identifier is present for non-cash holdings.",
    severity: "error",
    spec_clause: "Form N-PORT Part C holding identifiers. GCAP maps issuer_lei and issuer_cusip to issuer-level elements.",
    schema_elements: ["issuerLei", "issuerCusip", "identifierIsin", "identifierTicker", "otherIdentifier", "assetCat"],
    scope: "holding",
    status: "live"
  },
  {
    rule_id: "NP-ID-002",
    description: "LEI, CUSIP, and ISIN identifiers satisfy their published checksum/format rules.",
    severity: "error",
    spec_clause: "Form N-PORT Part C identifier elements. GCAP issuer_lei/issuer_cusip are issuer-level.",
    schema_elements: ["issuerLei", "issuerCusip", "identifierIsin"],
    scope: "holding",
    status: "live"
  },
  {
    rule_id: "NP-REF-001",
    description: "Currency is a valid ISO 4217 code and USD value is computed from currency amount plus exchange rate.",
    severity: "error",
    spec_clause: "Form N-PORT Part C value elements: currencyCode, currencyValue/exchangeRate, valUSD.",
    schema_elements: ["currencyCode", "currencyValue", "exchangeRate", "valUSD"],
    scope: "holding",
    status: "live"
  },
  {
    rule_id: "NP-REF-002",
    description: "Fair-value hierarchy level is one of the permitted levels.",
    severity: "error",
    spec_clause: "Form N-PORT Part C fair value hierarchy element: fairValueLevel.",
    schema_elements: ["fairValueLevel"],
    scope: "holding",
    status: "live"
  },
  {
    rule_id: "NP-LIQ-001",
    description: "Cut: GCAP .dta slice has no liquidity classification field.",
    severity: "error",
    spec_clause:
      "No verified GCAP column maps to the N-PORT liquidityClassification element. is_restricted_security is a different concept and is not used as a substitute.",
    schema_elements: ["liquidityClassification"],
    scope: "holding",
    status: "cut"
  },
  {
    rule_id: "NP-DER-001",
    description: "Derivative category is consistent with payoff profile when derivative fields are available.",
    severity: "error",
    spec_clause: "Form N-PORT derivative branch reduced to verified GCAP fields payoffProfile and derivativeCategory.",
    schema_elements: ["payoffProfile", "derivativeCategory"],
    scope: "holding",
    status: "live"
  },
  {
    rule_id: "NP-NAV-002",
    description: "Net assets are non-zero before percent-of-net-assets reconciliation.",
    severity: "error",
    spec_clause: "Form N-PORT fundInfo/netAssets must be non-zero for pctVal reconciliation.",
    schema_elements: ["netAssets"],
    scope: "filing",
    status: "live"
  },
  {
    rule_id: "NP-NAV-001",
    description: "Percent-of-net-assets values reconcile to total net assets within tolerance.",
    severity: "warning",
    spec_clause: "Form N-PORT Part C pctVal/currencyValue reconciled to fundInfo/netAssets.",
    schema_elements: ["pctVal", "valUSD", "netAssets"],
    scope: "filing",
    status: "live"
  }
] satisfies RuleRow[];

export const DEMO_DASHBOARD_SUMMARY: DashboardSummary = {
  has_data: true,
  total_filings: GCAP_REFERENCE_RUN.filings,
  passed_filings: GCAP_REFERENCE_RUN.passed,
  failed_filings: GCAP_REFERENCE_RUN.failed,
  total_holdings: GCAP_REFERENCE_RUN.holdings,
  open_errors: GCAP_REFERENCE_RUN.errors,
  warnings: GCAP_REFERENCE_RUN.warnings,
  conformance_percent: GCAP_REFERENCE_PASS_RATE_PERCENT,
  tier2_discrepancy_rate: null,
  rule_flag_rates: [],
  filings_per_second: null,
  holdings_per_second: GCAP_REFERENCE_RUN.holdingsPerSecond,
  peak_rss_mb_per_worker: GCAP_REFERENCE_RUN.peakRssMbPerWorker,
  recent_filings: []
};

export const DEMO_LATEST_BATCH: { has_data: true; batch: BatchResult } = {
  has_data: true,
  batch: {
    elapsed_seconds: GCAP_REFERENCE_RUN.holdings / GCAP_REFERENCE_RUN.holdingsPerSecond,
    worker_count: null,
    total_filings: GCAP_REFERENCE_RUN.filings,
    passed_filings: GCAP_REFERENCE_RUN.passed,
    failed_filings: GCAP_REFERENCE_RUN.failed,
    cache_hits: 0,
    total_holdings: GCAP_REFERENCE_RUN.holdings,
    filings_per_second: 0,
    holdings_per_second: GCAP_REFERENCE_RUN.holdingsPerSecond,
    peak_rss_mb_per_worker: GCAP_REFERENCE_RUN.peakRssMbPerWorker,
    rule_flag_rates: [],
    results: []
  }
};

export const DEMO_HOLDINGS_RESPONSE: HoldingsResponse = {
  total: 0,
  offset: 0,
  limit: 500,
  rows: []
};

export const DEMO_FILING_REPORT: FilingReport = {
  status: "static-demo",
  passed: false,
  errors: GCAP_REFERENCE_RUN.errors,
  warnings: GCAP_REFERENCE_RUN.warnings,
  failures_by_rule: {}
};
