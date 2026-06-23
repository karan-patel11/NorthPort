import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { DataGrid } from "../components/DataGrid";
import { StatusPill } from "../components/StatusPill";
import { fetchRules, type RuleRow } from "../lib/api";
import { IS_DEMO_MODE } from "../lib/referenceRun";

export function RulesRegistry() {
  const { data } = useQuery({ queryKey: ["rules"], queryFn: fetchRules });
  const rules = data?.rules ?? [];
  const liveCount = rules.filter((rule) => rule.status === "live").length;
  const cutCount = rules.filter((rule) => rule.status === "cut").length;
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
        <h1 className="font-brand text-3xl font-semibold tracking-normal">Rules Registry</h1>
        <p className="mt-1 text-sm text-secondaryText">
          Tier-2 traceability. {liveCount} live rules, {cutCount} cut rule.{" "}
          {IS_DEMO_MODE ? "Static demo copy is audited against backend LIVE_RULES." : "Live data is pulled from FastAPI."}
        </p>
      </div>
      <DataGrid columns={columns} data={rules} height={360} />
    </section>
  );
}
