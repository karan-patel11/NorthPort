import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { DataGrid } from "../components/DataGrid";
import { StatusPill } from "../components/StatusPill";
import { fetchRules, type RuleRow } from "../lib/api";

export function RulesRegistry() {
  const { data } = useQuery({ queryKey: ["rules"], queryFn: fetchRules });
  const columns: ColumnDef<RuleRow>[] = [
    { header: "Rule", accessorKey: "rule_id", cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string>()}</span> },
    { header: "Scope", accessorKey: "scope" },
    { header: "Severity", accessorKey: "severity", cell: (ctx) => <StatusPill status={ctx.getValue<"error" | "warning">()} /> },
    {
      header: "Schema Elements",
      accessorKey: "schema_elements",
      cell: (ctx) => <span className="font-mono text-xs">{ctx.getValue<string[]>().join(", ")}</span>
    },
    { header: "SEC Field Citation", accessorKey: "spec_clause" },
    {
      header: "Status",
      accessorKey: "status",
      cell: (ctx) => {
        const status = ctx.getValue<RuleRow["status"]>();
        const color = status === "live" ? "text-success" : "text-secondaryText";
        return <span className={`font-mono text-xs ${color}`}>{status}</span>;
      }
    }
  ];

  return (
    <section className="mx-auto grid max-w-6xl gap-4">
      <div>
        <h1 className="font-brand text-3xl tracking-[0.04em]">Rules Registry</h1>
        <p className="mt-1 text-sm text-secondaryText">Tier-2 traceability</p>
      </div>
      <DataGrid columns={columns} data={data?.rules ?? []} height={360} />
    </section>
  );
}
