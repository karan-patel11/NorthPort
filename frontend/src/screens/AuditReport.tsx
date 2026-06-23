import { useQuery } from "@tanstack/react-query";
import { FileOutput, Printer } from "lucide-react";
import { StatusPill } from "../components/StatusPill";
import { fetchDashboardSummary, fetchReport } from "../lib/api";
import { IS_DEMO_MODE, STATIC_DEMO_NOTICE } from "../lib/referenceRun";

const XML_EXPORT_PLANNED =
  "Serialization to EDGAR-conformant XML is scoped as future work pending complete source data.";

export function AuditReport() {
  const { data: dashboard } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });
  const filings = dashboard?.recent_filings ?? [];
  const latest = filings[filings.length - 1];
  const { data: report } = useQuery({
    queryKey: ["report", latest?.id],
    queryFn: () => fetchReport(latest!.id),
    enabled: Boolean(latest?.id)
  });
  const failures = Object.entries(report?.failures_by_rule ?? {}).map(([rule, items]) => ({
    rule,
    severity: items[0]?.severity ?? "error",
    count: items.length,
    message: items[0]?.message ?? "no data",
    row: items.map((item) => item.holding_id).filter(Boolean).slice(0, 3).join(", ") || "filing-level"
  }));

  if (!latest || !report) {
    return (
      <section className="mx-auto grid max-w-6xl gap-4">
        <div>
          <h1 className="font-brand text-3xl font-semibold tracking-normal">Audit Report</h1>
          <p className="mt-1 text-sm text-secondaryText">
            {IS_DEMO_MODE
              ? `${STATIC_DEMO_NOTICE} Per-filing audit reports are available when the local backend has processed a filing.`
              : "no data"}
          </p>
        </div>
        <div className="rounded-card border border-dashed border-hairline bg-surface p-8 text-sm leading-6 text-secondaryText">
          {IS_DEMO_MODE ? "Static demo uses aggregate reference metrics only." : "no report selected"}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-3xl font-semibold tracking-normal">Audit Report</h1>
          <p className="mt-1 font-mono text-sm text-secondaryText">
            {latest.id} / {latest.period}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex h-9 items-center gap-2 rounded-card border border-hairline px-3 text-sm transition hover:border-accent/50 hover:bg-raised" type="button">
            <Printer aria-hidden size={16} />
            Print
          </button>
          <PlannedXmlExport />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ReportStat label="Tier-2 Status" value={report.passed ? "Pass" : "Fail"} tone={report.passed ? "success" : "error"} />
        <ReportStat label="Tier-1" value="no data" tone="neutral" />
        <ReportStat label="Tier-2 Errors" value={String(report.errors)} tone={report.errors ? "error" : "success"} />
        <ReportStat label="Warnings" value={String(report.warnings)} tone={report.warnings ? "warning" : "success"} />
      </div>

      <div className="rounded-card border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3 text-sm font-semibold">Failures By Rule</div>
        <div className="divide-y divide-hairline">
          {failures.length ? (
            failures.map((item) => (
              <div className="grid gap-3 p-4 md:grid-cols-[120px_120px_1fr_180px]" key={item.rule}>
                <div className="font-mono text-xs text-secondaryText">{item.rule}</div>
                <StatusPill status={item.severity} />
                <div>
                  <div className="text-sm font-medium">{item.message}</div>
                  <div className="mt-1 text-xs text-secondaryText">{item.count} occurrences</div>
                </div>
                <div className="font-mono text-xs text-secondaryText">{item.row}</div>
              </div>
            ))
          ) : (
            <div className="p-4 text-sm text-secondaryText">no failures</div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlannedXmlExport() {
  return (
    <div className="grid max-w-sm gap-1 text-left sm:text-right">
      <button
        className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-card border border-hairline bg-raised/50 px-3 text-sm text-secondaryText opacity-70"
        disabled
        title={XML_EXPORT_PLANNED}
        type="button"
      >
        <FileOutput aria-hidden size={16} />
        EDGAR XML export — planned
      </button>
      <p className="text-xs leading-5 text-secondaryText">{XML_EXPORT_PLANNED}</p>
    </div>
  );
}

function ReportStat({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "error" | "neutral" }) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "error"
          ? "text-error"
          : "text-secondaryText";
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className={`mt-3 font-mono text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
