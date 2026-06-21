import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Download, PanelRightOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { DataGrid } from "../components/DataGrid";
import { fetchDashboardSummary, fetchHoldings, type HoldingApiRow } from "../lib/api";

export function FilingDetail() {
  const [selected, setSelected] = useState<HoldingApiRow | null>(null);
  const { data: dashboard } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });
  const latest = dashboard?.recent_filings[0];
  const { data: holdings } = useQuery({
    queryKey: ["holdings", latest?.id],
    queryFn: () => fetchHoldings(latest!.id),
    enabled: Boolean(latest?.id)
  });
  const rows = holdings?.rows ?? [];
  const active = selected ?? rows[0] ?? null;

  const columns = useMemo<ColumnDef<HoldingApiRow>[]>(
    () => [
      {
        header: "Holding",
        accessorKey: "holding_id",
        cell: (ctx) => (
          <button className="font-mono text-xs text-accent" onClick={() => setSelected(ctx.row.original)} type="button">
            {ctx.getValue<string>()}
          </button>
        )
      },
      { header: "Issuer", accessorKey: "issuer_name" },
      {
        header: "CUSIP",
        accessorFn: (row) => row.identifiers.cusip ?? "",
        cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string>()}</span>
      },
      { header: "Category", accessorKey: "security_category" },
      { header: "Currency", accessorKey: "currency", cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string | null>() ?? "no data"}</span> },
      {
        header: "USD Value",
        accessorKey: "value_usd",
        cell: (ctx) => {
          const value = ctx.getValue<string | null>();
          return <span className="block text-right font-mono tabular">{value == null ? "no data" : `$${Number(value).toLocaleString()}`}</span>;
        }
      },
      {
        header: "% NAV",
        accessorKey: "percent_of_net_assets",
        cell: (ctx) => <span className="block text-right font-mono tabular">{Number(ctx.getValue<string>()).toFixed(3)}%</span>
      }
    ],
    []
  );

  if (!latest) {
    return <NoData title="Filing Detail" />;
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-3xl tracking-[0.04em]">Filing Detail</h1>
          <p className="mt-1 font-mono text-sm text-secondaryText">
            {latest.id} / {latest.period}
          </p>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-card border border-hairline px-3 text-sm" type="button">
          <Download aria-hidden size={16} />
          XML
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Summary label="Series" value={latest.fund} />
        <Summary label="Status" value={latest.status} />
        <Summary label="Errors" value={String(latest.errors)} />
        <Summary label="Holdings" value={latest.holdings.toLocaleString()} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <DataGrid columns={columns} data={rows} height={520} />
        <aside className="rounded-card border border-hairline bg-surface">
          <div className="flex items-center gap-2 border-b border-hairline p-3">
            <PanelRightOpen aria-hidden className="text-secondaryText" size={16} />
            <h2 className="text-sm font-semibold">Source Trace</h2>
          </div>
          {active ? (
            <div className="text-sm">
              <div className="p-4">
                <div className="font-mono text-xs text-secondaryText">{active.holding_id}</div>
                <div className="mt-1 font-semibold">{active.issuer_name}</div>
              </div>
              <Trace label="CUSIP" value={active.identifiers.cusip ?? "no data"} />
              <Trace label="Currency" value={active.currency ?? "no data"} />
              <Trace label="Liquidity" value={active.liquidity_classification ?? "no data"} />
            </div>
          ) : (
            <div className="p-4 text-sm text-secondaryText">no holdings</div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className="mt-3 font-mono text-lg font-semibold tabular">{value}</div>
    </div>
  );
}

function Trace({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-hairline p-4">
      <div className="mb-2 font-mono text-xs text-secondaryText">{label}</div>
      <div className="text-sm text-primaryText">{value}</div>
    </div>
  );
}

function NoData({ title }: { title: string }) {
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="font-brand text-3xl tracking-[0.04em]">{title}</h1>
        <p className="mt-1 text-sm text-secondaryText">no data</p>
      </div>
      <div className="rounded-card border border-dashed border-hairline bg-surface p-8 text-sm text-secondaryText">no filing selected</div>
    </section>
  );
}
