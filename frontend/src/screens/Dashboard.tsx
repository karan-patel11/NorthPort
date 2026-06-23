import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Database,
  DatabaseZap,
  FileCheck2,
  FileInput,
  FileOutput,
  Gauge,
  LockKeyhole,
  Network,
  ShieldCheck
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis } from "recharts";
import { DataGrid } from "../components/DataGrid";
import { MetricTile } from "../components/MetricTile";
import { StatusPill } from "../components/StatusPill";
import { fetchDashboardSummary, fetchRules, type DashboardFiling, type RuleRow } from "../lib/api";
import { GCAP_REFERENCE_RUN, IS_DEMO_MODE, STATIC_DEMO_NOTICE } from "../lib/referenceRun";

type Props = {
  setScreen: (screen: "upload" | "detail" | "rules" | "batch") => void;
};

const acceptedSources = ["CSV", "JSON", "Stata .dta"];

const pipelineStages = [
  {
    title: "ingestion",
    detail: "CSV, JSON, or GCAP DTA is mapped into NorthPort's internal filing model.",
    icon: FileInput
  },
  {
    title: "Tier-1",
    detail: "Pinned SEC v1.13 XSD checks structure, types, and cardinality with network access disabled.",
    icon: Network
  },
  {
    title: "Tier-2",
    detail: "NorthPort's internal holdings rules check identifiers, reference data, derivatives, and NAV reconciliation.",
    icon: ShieldCheck
  },
  {
    title: "verdict",
    detail: "Zero errors produce a passing verdict; errors and warnings remain visible for review.",
    icon: FileOutput
  }
];

export function Dashboard({ setScreen }: Props) {
  const { data, isError } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });
  const rulesQuery = useQuery({ queryKey: ["rules"], queryFn: fetchRules });
  const hasData = data?.has_data ?? false;
  const discrepancy = data?.tier2_discrepancy_rate;
  const rules = rulesQuery.data?.rules ?? [];
  const liveRules = rules.filter((rule) => rule.status === "live");
  const cutRules = rules.filter((rule) => rule.status === "cut");
  const liveRuleRates = data?.rule_flag_rates.filter((item) => item.status === "live") ?? [];
  const totalRuleFlags = liveRuleRates.reduce((sum, item) => sum + item.flagged, 0);
  const totalRuleDenominator = liveRuleRates.reduce((sum, item) => sum + (item.denominator ?? 0), 0);
  const ruleFailureRows = liveRuleRates.map((item) => ({
    ruleId: item.rule_id,
    failures: item.flagged,
    rate: item.flag_rate ?? 0
  }));
  const discrepancyValue = IS_DEMO_MODE
    ? "not audited"
    : discrepancy == null
      ? "no data"
      : `${(discrepancy * 100).toFixed(2)}%`;
  const discrepancyDetail = IS_DEMO_MODE
    ? "rule-level denominator not in reference summary"
    : hasData
      ? `${totalRuleFlags.toLocaleString()} rule flags`
      : "no real runs yet";
  const throughputValue =
    data?.holdings_per_second == null
      ? data?.filings_per_second == null
        ? "no data"
        : `${data.filings_per_second.toFixed(2)} filings/sec`
      : formatHoldingsThroughput(data.holdings_per_second);
  const throughputDetail =
    data?.peak_rss_mb_per_worker == null
      ? "no batch run yet"
      : `${data.peak_rss_mb_per_worker.toFixed(0)} MB peak RSS per worker`;

  const columns: ColumnDef<DashboardFiling>[] = [
    { header: "Filing", accessorKey: "id", cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string>()}</span> },
    { header: "Fund", accessorKey: "fund" },
    { header: "Period", accessorKey: "period", cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string>()}</span> },
    {
      header: "Holdings",
      accessorKey: "holdings",
      cell: (ctx) => <span className="block text-right font-mono tabular">{ctx.getValue<number>().toLocaleString()}</span>
    },
    { header: "Status", accessorKey: "status", cell: (ctx) => <StatusPill status={ctx.getValue<DashboardFiling["status"]>()} /> }
  ];

  return (
    <section className="mx-auto grid max-w-7xl gap-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="rounded-card border border-hairline bg-surface p-5 shadow-panel">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.08em] text-secondaryText">
            <LockKeyhole aria-hidden className="text-accent" size={14} />
            SEC Form N-PORT pre-filing validation
          </div>
          <h1 className="mt-4 font-brand text-4xl font-semibold tracking-normal text-primaryText">NorthPort</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-secondaryText">
            NorthPort is a two-tier SEC Form N-PORT pre-filing validation system whose deliverable is a validation verdict:
            pass or fail, with errors and warnings for review. It does not file to EDGAR; a human submits through the SEC
            workflow. It is not SEC-certified. The backend compiles the pinned SEC N-PORT v1.13 XSD bundle for Tier-1 XML
            checks and runs NorthPort internal data-quality rules for Tier-2 holdings checks. EDGAR-conformant XML
            serialization is planned future work pending complete source data.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {acceptedSources.map((source) => (
              <span className="rounded border border-hairline bg-base px-2.5 py-1 font-mono text-xs text-primaryText" key={source}>
                {source}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-card bg-accent px-3 text-sm font-semibold text-[#080B10] transition hover:bg-accent/90"
              onClick={() => setScreen("upload")}
              type="button"
            >
              <FileCheck2 aria-hidden size={16} />
              New filing
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-card border border-hairline px-3 text-sm text-primaryText transition hover:border-accent/50 hover:bg-raised"
              onClick={() => setScreen("rules")}
              type="button"
            >
              <ShieldCheck aria-hidden size={16} />
              Rules
            </button>
          </div>
        </div>

        <div className="rounded-card border border-hairline bg-surface p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">Reference run</div>
              <div className="mt-1 text-sm font-semibold">{GCAP_REFERENCE_RUN.label}</div>
            </div>
            <BadgeCheck aria-hidden className="text-success" size={18} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ReferenceStat label="filings" value={GCAP_REFERENCE_RUN.filings.toLocaleString()} />
            <ReferenceStat label="holdings" value={`${(GCAP_REFERENCE_RUN.holdings / 1_000_000).toFixed(1)}M+`} />
            <ReferenceStat label="reference passed" value={GCAP_REFERENCE_RUN.passed.toLocaleString()} tone="success" />
            <ReferenceStat label="reference failed" value={GCAP_REFERENCE_RUN.failed.toLocaleString()} tone="error" />
            <ReferenceStat label="errors" value={GCAP_REFERENCE_RUN.errors.toLocaleString()} tone="error" />
            <ReferenceStat label="warnings" value={GCAP_REFERENCE_RUN.warnings.toLocaleString()} tone="warning" />
          </div>
          <div className="mt-4 grid gap-2 border-t border-hairline pt-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-secondaryText">throughput</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular">
                {(GCAP_REFERENCE_RUN.holdingsPerSecond / 1000).toFixed(1)}K holdings/sec
              </div>
            </div>
            <div>
              <div className="text-xs text-secondaryText">peak RSS</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular">
                {GCAP_REFERENCE_RUN.peakRssMbPerWorker.toFixed(0)} MB/worker
              </div>
            </div>
          </div>
        </div>
      </div>

      {isError && (
        <div className="rounded-card border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          Backend unavailable. Static reference evidence remains visible; live dashboard data will appear when the API responds.
        </div>
      )}

      {IS_DEMO_MODE && (
        <div className="rounded-card border border-warning/25 bg-warning/10 p-3 text-sm leading-6 text-warning">
          {STATIC_DEMO_NOTICE} Uploads, row-level drilldown, and live validation actions are available when the local FastAPI backend is running.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={Gauge}
          label="Tier-2 discrepancy"
          value={discrepancyValue}
          detail={discrepancyDetail}
        />
        <MetricTile
          icon={FileCheck2}
          label="Processed"
          value={hasData ? String(data?.total_filings ?? 0) : "no data"}
          detail={hasData ? `${(data?.total_holdings ?? 0).toLocaleString()} holdings` : "waiting for EDGAR/GCAP input"}
        />
        <MetricTile
          icon={AlertTriangle}
          label="Open Errors"
          value={hasData ? String(data?.open_errors ?? 0) : "no data"}
          detail={hasData ? `${data?.warnings ?? 0} warnings` : "no validation report yet"}
        />
        <MetricTile
          icon={DatabaseZap}
          label="Throughput"
          value={throughputValue}
          detail={throughputDetail}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TierCard
          icon={Network}
          title="Tier-1: XSD schema conformance"
          detail="The schema tier compiles the pinned SEC N-PORT v1.13 bundle and checks XML structure, field types, and cardinality. It uses local schema imports with network access disabled for reproducibility, and the schema includes later regulatory sections such as 18f-4 derivatives exposure and VaR."
        />
        <TierCard
          icon={ShieldCheck}
          title="Tier-2: NorthPort data-quality rules"
          detail="The business tier runs NorthPort's own holdings and filing checks. These rules are informed by the schema and GCAP mapping, but they are internal quality gates rather than SEC mandates or certification."
        />
      </div>

      <PipelineStepper />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <RuleInventory rules={liveRules} cutRules={cutRules} isLoading={rulesQuery.isLoading} isError={rulesQuery.isError} />
        <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
          <div className="flex items-center gap-2">
            <Database aria-hidden className="text-accent" size={16} />
            <h2 className="text-sm font-semibold">Fail-Closed Data Handling</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-secondaryText">
            When the GCAP source lacks currency, currency value, or a usable non-USD exchange rate, NorthPort records the
            computed USD value as no data and lets the validation rules flag the gap. It does not fabricate source values.
          </p>
          <div className="mt-4 rounded border border-hairline bg-base p-3 font-mono text-xs leading-6 text-secondaryText">
            value_usd = currency_value / exchange_rate
            <br />
            missing input = no data
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tier-2 Discrepancy</h2>
            <span className="font-mono text-xs text-secondaryText">
              {IS_DEMO_MODE ? "aggregate only" : hasData ? `${liveRuleRates.length} live rules` : "no data"}
            </span>
          </div>
          <div className="h-56">
            {IS_DEMO_MODE ? (
              <EmptyState label="not in static demo" />
            ) : hasData ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Flagged", value: totalRuleFlags },
                      { name: "Unflagged", value: Math.max(totalRuleDenominator - totalRuleFlags, 0) }
                    ]}
                    innerRadius={64}
                    outerRadius={86}
                    dataKey="value"
                    stroke="#0F141C"
                  >
                    <Cell fill="#F87171" />
                    <Cell fill="#22C55E" />
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0F141C", border: "1px solid #2A3443", color: "#F1F5F9" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="no data" />
            )}
          </div>
        </div>

        <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Rule Flags</h2>
            <button
              className="text-xs text-accent disabled:cursor-not-allowed disabled:text-secondaryText"
              disabled={IS_DEMO_MODE}
              onClick={() => setScreen("detail")}
              title={IS_DEMO_MODE ? STATIC_DEMO_NOTICE : undefined}
              type="button"
            >
              Open filings
            </button>
          </div>
          <div className="h-56">
            {IS_DEMO_MODE ? (
              <EmptyState label="not in static demo" />
            ) : hasData && ruleFailureRows.some((item) => item.failures > 0) ? (
              <ResponsiveContainer>
                <BarChart data={ruleFailureRows}>
                  <XAxis dataKey="ruleId" tick={{ fill: "#94A3B8", fontSize: 11 }} stroke="#2A3443" />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} stroke="#2A3443" />
                  <Tooltip contentStyle={{ background: "#0F141C", border: "1px solid #2A3443", color: "#F1F5F9" }} />
                  <Bar dataKey="failures" fill="#F87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label={hasData ? "no failures" : "no data"} />
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Filings</h2>
          <span className="font-mono text-xs text-secondaryText">validation verdict from Tier-1 + Tier-2</span>
        </div>
        {IS_DEMO_MODE ? (
          <StaticAggregateNote />
        ) : hasData ? (
          <DataGrid columns={columns} data={data?.recent_filings ?? []} height={214} />
        ) : (
          <EmptyState label="no data" />
        )}
      </div>
    </section>
  );
}

function formatHoldingsThroughput(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K holdings/sec` : `${value.toFixed(0)} holdings/sec`;
}

function ReferenceStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "error" }) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "error" ? "text-error" : "text-primaryText";
  return (
    <div className="rounded border border-hairline bg-base p-3">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className={`mt-2 font-mono text-lg font-semibold tabular ${color}`}>{value}</div>
    </div>
  );
}

function TierCard({ icon: Icon, title, detail }: { icon: typeof Network; title: string; detail: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="flex items-center gap-2">
        <Icon aria-hidden className="text-accent" size={17} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-secondaryText">{detail}</p>
    </div>
  );
}

function PipelineStepper() {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Filing Pipeline</h2>
        <span className="font-mono text-xs text-secondaryText">ingestion → Tier-1 → Tier-2 → validation verdict</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {pipelineStages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div className="relative overflow-hidden rounded-card border border-hairline bg-base p-4" key={stage.title}>
              <span className="stage-progress" aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <Icon aria-hidden className="text-accent" size={18} />
                {index < pipelineStages.length - 1 && <ArrowRight aria-hidden className="hidden text-secondaryText lg:block" size={15} />}
              </div>
              <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-secondaryText">0{index + 1}</div>
              <div className="mt-2 text-sm font-semibold">{stage.title}</div>
              <p className="mt-2 text-xs leading-5 text-secondaryText">{stage.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RuleInventory({
  rules,
  cutRules,
  isLoading,
  isError
}: {
  rules: RuleRow[];
  cutRules: RuleRow[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Live Rules Inventory</h2>
          <p className="mt-1 text-xs text-secondaryText">
            {IS_DEMO_MODE ? "Static demo copy audited against backend registry." : "Pulled from the backend registry."}
          </p>
        </div>
        <span className="font-mono text-xs text-secondaryText">{rules.length ? `${rules.length} live` : "no data"}</span>
      </div>
      {isError ? (
        <div className="rounded border border-warning/25 bg-warning/10 p-3 text-sm text-warning">rules unavailable</div>
      ) : isLoading ? (
        <div className="rounded border border-hairline bg-base p-3 text-sm text-secondaryText">loading registry</div>
      ) : (
        <div className="divide-y divide-hairline">
          {rules.map((rule) => (
            <div className="grid gap-3 py-3 md:grid-cols-[108px_98px_1fr]" key={rule.rule_id}>
              <div className="font-mono text-xs text-primaryText">{rule.rule_id}</div>
              <StatusPill status={rule.severity} />
              <div className="text-sm leading-5 text-secondaryText">{rule.description}</div>
            </div>
          ))}
        </div>
      )}
      {cutRules.length > 0 && (
        <div className="mt-4 rounded border border-warning/25 bg-warning/10 p-3 text-sm leading-6 text-warning">
          Known coverage gap: {cutRules.map((rule) => rule.rule_id).join(", ")} is cut because the verified GCAP DTA slice has no
          liquidity-classification field.
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-card border border-dashed border-hairline bg-surface text-sm text-secondaryText">
      {label}
    </div>
  );
}

function StaticAggregateNote() {
  return (
    <div className="rounded-card border border-hairline bg-surface p-5 text-sm leading-6 text-secondaryText shadow-panel">
      The Vercel demo shows audited aggregate metrics from the GCAP 2025Q4 reference run. Row-level filing drilldown is live-backend
      functionality and is available in local mode.
    </div>
  );
}
