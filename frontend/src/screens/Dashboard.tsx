import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, DatabaseZap, FileCheck2, Gauge } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, XAxis, YAxis } from "recharts";
import { DataGrid } from "../components/DataGrid";
import { MetricTile } from "../components/MetricTile";
import { StatusPill } from "../components/StatusPill";
import { fetchDashboardSummary, type DashboardFiling } from "../lib/api";

type Props = {
  setScreen: (screen: "upload" | "detail") => void;
};

export function Dashboard({ setScreen }: Props) {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });
  const hasData = data?.has_data ?? false;
  const discrepancy = data?.tier2_discrepancy_rate;
  const liveRuleRates = data?.rule_flag_rates.filter((item) => item.status === "live") ?? [];
  const totalRuleFlags = liveRuleRates.reduce((sum, item) => sum + item.flagged, 0);
  const totalRuleDenominator = liveRuleRates.reduce((sum, item) => sum + (item.denominator ?? 0), 0);
  const ruleFailureRows = liveRuleRates.map((item) => ({
    ruleId: item.rule_id,
    failures: item.flagged,
    rate: item.flag_rate ?? 0
  }));

  const columns: ColumnDef<DashboardFiling>[] = [
    { header: "Filing", accessorKey: "id", cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string>()}</span> },
    { header: "Fund", accessorKey: "fund" },
    { header: "Period", accessorKey: "period", cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string>()}</span> },
    {
      header: "Holdings",
      accessorKey: "holdings",
      cell: (ctx) => <span className="block text-right font-mono tabular">{ctx.getValue<number>().toLocaleString()}</span>
    },
    {
      header: "Conformance",
      accessorKey: "conformance_percent",
      cell: (ctx) => <span className="block text-right font-mono tabular">{ctx.getValue<number>().toFixed(2)}%</span>
    },
    { header: "Status", accessorKey: "status", cell: (ctx) => <StatusPill status={ctx.getValue<DashboardFiling["status"]>()} /> }
  ];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-3xl tracking-[0.04em]">NorthPort</h1>
          <p className="mt-1 text-sm text-secondaryText">N-PORT pre-filing validation</p>
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-card bg-accent px-3 text-sm font-semibold text-white"
          onClick={() => setScreen("upload")}
          type="button"
        >
          <FileCheck2 aria-hidden size={16} />
          New filing
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={Gauge}
          label="Tier-2 discrepancy"
          value={discrepancy == null ? "no data" : `${(discrepancy * 100).toFixed(2)}%`}
          detail={hasData ? `${totalRuleFlags.toLocaleString()} rule flags` : "no real runs yet"}
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
          value={data?.filings_per_second == null ? "no data" : `${data.filings_per_second.toFixed(2)}/s`}
          detail={
            data?.peak_rss_mb_per_worker == null
              ? "no batch run yet"
              : `${data.peak_rss_mb_per_worker.toFixed(0)} MB peak RSS`
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-card border border-hairline bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tier-2 Discrepancy</h2>
            <span className="font-mono text-xs text-secondaryText">{hasData ? `${liveRuleRates.length} live rules` : "no data"}</span>
          </div>
          <div className="h-56">
            {hasData ? (
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
                    stroke="#121823"
                  >
                    <Cell fill="#EF4444" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip contentStyle={{ background: "#121823", border: "1px solid #252D3D", color: "#E6EAF0" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="no data" />
            )}
          </div>
        </div>

        <div className="rounded-card border border-hairline bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Rule Flags</h2>
            <button className="text-xs text-accent" onClick={() => setScreen("detail")} type="button">
              Open filings
            </button>
          </div>
          <div className="h-56">
            {hasData && ruleFailureRows.some((item) => item.failures > 0) ? (
              <ResponsiveContainer>
                <BarChart data={ruleFailureRows}>
                  <XAxis dataKey="ruleId" tick={{ fill: "#8A94A6", fontSize: 11 }} stroke="#252D3D" />
                  <YAxis tick={{ fill: "#8A94A6", fontSize: 11 }} stroke="#252D3D" />
                  <Tooltip contentStyle={{ background: "#121823", border: "1px solid #252D3D", color: "#E6EAF0" }} />
                  <Bar dataKey="failures" fill="#EF4444" radius={[4, 4, 0, 0]} />
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
          <span className="font-mono text-xs text-secondaryText">EDGAR-ready output gated by Tier-1 + Tier-2</span>
        </div>
        {hasData ? <DataGrid columns={columns} data={data?.recent_filings ?? []} height={214} /> : <EmptyState label="no data" />}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-card border border-dashed border-hairline bg-surface text-sm text-secondaryText">
      {label}
    </div>
  );
}
