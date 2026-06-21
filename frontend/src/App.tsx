import {
  Activity,
  BarChart3,
  ClipboardList,
  FileCheck2,
  FileText,
  Gauge,
  Layers3,
  Settings,
  ShieldCheck,
  Upload,
  Workflow
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Dashboard } from "./screens/Dashboard";
import { UploadScreen } from "./screens/UploadScreen";
import { FilingDetail } from "./screens/FilingDetail";
import { AuditReport } from "./screens/AuditReport";
import { BatchMonitor } from "./screens/BatchMonitor";
import { RulesRegistry } from "./screens/RulesRegistry";
import { fetchDashboardSummary } from "./lib/api";

type ScreenId = "dashboard" | "upload" | "detail" | "report" | "batch" | "rules" | "settings";

const screens = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "detail", label: "Filings", icon: FileText },
  { id: "report", label: "Reports", icon: ClipboardList },
  { id: "batch", label: "Batch", icon: Workflow },
  { id: "rules", label: "Rules", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings }
] satisfies { id: ScreenId; label: string; icon: typeof BarChart3 }[];

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("dashboard");
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });
  const ActiveScreen = useMemo(() => {
    switch (screen) {
      case "upload":
        return <UploadScreen />;
      case "detail":
        return <FilingDetail />;
      case "report":
        return <AuditReport />;
      case "batch":
        return <BatchMonitor />;
      case "rules":
        return <RulesRegistry />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <Dashboard setScreen={setScreen} />;
    }
  }, [screen]);

  return (
    <div className="min-h-screen bg-base text-primaryText">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-hairline bg-surface md:block">
          <div className="flex h-14 items-center border-b border-hairline px-4">
            <div className="font-brand text-2xl tracking-[0.08em] text-primaryText">NorthPort</div>
          </div>
          <nav className="space-y-1 p-3">
            {screens.map((item) => {
              const Icon = item.icon;
              const active = item.id === screen;
              return (
                <button
                  className={`flex h-9 w-full items-center gap-3 rounded-card px-3 text-left text-sm transition ${
                    active ? "bg-raised text-primaryText" : "text-secondaryText hover:bg-raised/70 hover:text-primaryText"
                  }`}
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  type="button"
                >
                  <Icon aria-hidden size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-hairline bg-surface px-4">
            <div className="flex items-center gap-3 md:hidden">
              <Layers3 aria-hidden className="text-accent" size={18} />
              <div className="font-brand text-xl tracking-[0.08em]">NorthPort</div>
            </div>
            <div className="hidden items-center gap-2 text-sm text-secondaryText md:flex">
              <Activity aria-hidden size={16} />
              <span>Pre-filing validation</span>
            </div>
            <div className="flex items-center gap-4">
              <TopStat
                icon={Gauge}
                label="Conformance"
                value={data?.conformance_percent == null ? "no data" : `${data.conformance_percent.toFixed(2)}%`}
              />
              <TopStat icon={FileCheck2} label="Ready" value={data?.has_data ? String(data.passed_filings) : "no data"} />
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto px-4 py-4 lg:px-6">{ActiveScreen}</main>

          <div className="grid grid-cols-7 border-t border-hairline bg-surface md:hidden">
            {screens.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`flex h-12 items-center justify-center ${screen === item.id ? "text-accent" : "text-secondaryText"}`}
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  title={item.label}
                  type="button"
                >
                  <Icon aria-hidden size={18} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopStat({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden className="text-secondaryText" size={15} />
      <span className="hidden text-xs text-secondaryText sm:inline">{label}</span>
      <span className="font-mono text-sm font-semibold tabular">{value}</span>
    </div>
  );
}

function SettingsScreen() {
  return (
    <section className="mx-auto grid max-w-5xl gap-4">
      <div>
        <h1 className="font-brand text-3xl tracking-[0.04em]">Settings</h1>
        <p className="mt-1 text-sm text-secondaryText">Schema pin, worker pool, and export defaults.</p>
      </div>
      <div className="grid gap-3 rounded-card border border-hairline bg-surface p-4">
        <label className="grid gap-2 text-sm">
          <span className="text-secondaryText">Pinned schema path</span>
          <input
            className="h-9 rounded-card border border-hairline bg-base px-3 font-mono text-sm text-primaryText"
            defaultValue="northport/backend/schemas/sec_nport.xsd"
          />
        </label>
        <label className="flex items-center justify-between gap-4 border-t border-hairline pt-3 text-sm">
          <span>Fail Tier-2 when Tier-1 schema is unavailable</span>
          <input className="h-4 w-4 accent-accent" defaultChecked type="checkbox" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-secondaryText">Worker processes</span>
          <input className="w-28 accent-accent" defaultValue={4} max={16} min={1} type="range" />
        </label>
      </div>
    </section>
  );
}
