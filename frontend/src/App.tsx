import {
  Activity,
  Anchor,
  BarChart3,
  ClipboardList,
  FileCheck2,
  FileText,
  Gauge,
  Settings,
  ShieldCheck,
  Upload,
  Workflow
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { fetchDashboardSummary } from "./lib/api";
import { IS_DEMO_MODE, STATIC_DEMO_NOTICE } from "./lib/referenceRun";

type AppRoute = "home" | "dashboard";
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

const DashboardScreen = lazy(() => import("./screens/Dashboard").then((module) => ({ default: module.Dashboard })));
const UploadScreen = lazy(() => import("./screens/UploadScreen").then((module) => ({ default: module.UploadScreen })));
const FilingDetailScreen = lazy(() => import("./screens/FilingDetail").then((module) => ({ default: module.FilingDetail })));
const AuditReportScreen = lazy(() => import("./screens/AuditReport").then((module) => ({ default: module.AuditReport })));
const BatchMonitorScreen = lazy(() => import("./screens/BatchMonitor").then((module) => ({ default: module.BatchMonitor })));
const RulesRegistryScreen = lazy(() => import("./screens/RulesRegistry").then((module) => ({ default: module.RulesRegistry })));
const HomePage = lazy(() => import("./screens/HomePage").then((module) => ({ default: module.HomePage })));

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname));
  const [screen, setScreen] = useState<ScreenId>("dashboard");

  const navigate = useCallback((nextRoute: AppRoute) => {
    const nextPath = nextRoute === "dashboard" ? "/dashboard" : "/";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (route === "home") {
    return (
      <Suspense fallback={<PageLoading />}>
        <HomePage onLaunchDashboard={() => navigate("dashboard")} />
      </Suspense>
    );
  }

  return <DashboardShell onOpenHome={() => navigate("home")} screen={screen} setScreen={setScreen} />;
}

function DashboardShell({
  onOpenHome,
  screen,
  setScreen
}: {
  onOpenHome: () => void;
  screen: ScreenId;
  setScreen: (screen: ScreenId) => void;
}) {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });
  const summarySource = IS_DEMO_MODE ? "reference run" : "current session";
  const passRateTitle =
    data?.has_data && data.total_filings > 0
      ? `${data.passed_filings.toLocaleString()} passed / ${data.total_filings.toLocaleString()} total filings in the ${summarySource}.`
      : `No filings in the ${summarySource}.`;
  const ActiveScreen = useMemo(() => {
    switch (screen) {
      case "upload":
        return <UploadScreen />;
      case "detail":
        return <FilingDetailScreen />;
      case "report":
        return <AuditReportScreen />;
      case "batch":
        return <BatchMonitorScreen />;
      case "rules":
        return <RulesRegistryScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen setScreen={setScreen} />;
    }
  }, [screen]);

  return (
    <div className="min-h-screen bg-base text-primaryText">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-hairline bg-surface md:block">
          <div className="flex h-14 items-center border-b border-hairline px-4">
            <button
              className="flex h-9 items-center gap-2 rounded-card px-2 text-left font-brand text-xl font-semibold tracking-normal text-primaryText transition hover:bg-raised/70"
              onClick={onOpenHome}
              type="button"
            >
              <Anchor aria-hidden className="text-accent" size={18} />
              <span>NorthPort</span>
            </button>
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
              <button className="flex h-9 items-center gap-2 rounded-card px-2" onClick={onOpenHome} type="button">
                <Anchor aria-hidden className="text-accent" size={18} />
                <span className="font-brand text-lg font-semibold tracking-normal">NorthPort</span>
              </button>
            </div>
            <div className="hidden items-center gap-2 text-sm text-secondaryText md:flex">
              <Activity aria-hidden size={16} />
              <span>Pre-filing validation</span>
            </div>
            <div className="flex items-center gap-4">
              <TopStat
                icon={Gauge}
                label={`Pass rate — ${summarySource}`}
                value={data?.conformance_percent == null ? "no data" : `${data.conformance_percent.toFixed(2)}%`}
                title={passRateTitle}
              />
              <TopStat
                icon={FileCheck2}
                label={`Passed — ${summarySource}`}
                value={data?.has_data ? data.passed_filings.toLocaleString() : "no data"}
                title={
                  data?.has_data
                    ? `${data.passed_filings.toLocaleString()} filings with zero error-level validation findings in the ${summarySource}.`
                    : `No filings in the ${summarySource}.`
                }
              />
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto px-4 py-4 lg:px-6">
            <Suspense fallback={<ScreenLoading />}>{ActiveScreen}</Suspense>
          </main>

          <div className="grid grid-cols-7 border-t border-hairline bg-surface md:hidden">
            {screens.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`flex h-12 items-center justify-center ${screen === item.id ? "text-accent" : "text-secondaryText"}`}
                  key={item.id}
                  aria-label={item.label}
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

function routeFromPath(pathname: string): AppRoute {
  return pathname.startsWith("/dashboard") ? "dashboard" : "home";
}

function PageLoading() {
  return <div className="min-h-screen bg-base text-primaryText" />;
}

function ScreenLoading() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-card border border-dashed border-hairline bg-surface text-sm text-secondaryText">
      loading
    </div>
  );
}

function TopStat({ icon: Icon, label, value, title }: { icon: typeof Gauge; label: string; value: string; title?: string }) {
  return (
    <div className="flex items-center gap-2" title={title}>
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
        <h1 className="font-brand text-3xl font-semibold tracking-normal">Settings</h1>
        <p className="mt-1 text-sm text-secondaryText">Schema pin, worker pool, and validation defaults.</p>
      </div>
      {IS_DEMO_MODE && (
        <div className="rounded-card border border-warning/25 bg-warning/10 p-4 text-sm leading-6 text-warning">{STATIC_DEMO_NOTICE}</div>
      )}
      <div className="grid gap-3 rounded-card border border-hairline bg-surface p-4 shadow-panel">
        <label className="grid gap-2 text-sm">
          <span className="text-secondaryText">Pinned schema path</span>
          <input
            className="h-9 rounded-card border border-hairline bg-base px-3 font-mono text-sm text-primaryText"
            defaultValue="backend/schemas/nport/eis_NPORT_Filer.xsd"
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
