import {
  Anchor,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  DatabaseZap,
  FileCheck2,
  FileInput,
  FileOutput,
  FileSearch,
  GitBranch,
  Layers3,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow
} from "lucide-react";
import { GCAP_REFERENCE_RUN } from "../lib/referenceRun";

type Props = {
  onLaunchDashboard: () => void;
};

const checkSteps = [
  {
    title: "Is the report built correctly?",
    label: "Tier-1 / XSD",
    detail: "NorthPort checks the filing structure against the SEC's published Form N-PORT template.",
    icon: Network
  },
  {
    title: "Does the information make sense?",
    label: "Tier-2 / holdings rules",
    detail: "It checks holdings data for missing identifiers, bad currencies, missing values, and totals that do not reconcile.",
    icon: ShieldCheck
  }
] satisfies { title: string; label: string; detail: string; icon: typeof Network }[];

const pipelineStages = [
  { title: "ingestion", detail: "CSV, JSON, or GCAP Stata input", icon: FileInput },
  { title: "schema check", detail: "SEC N-PORT v1.13 XSD structure", icon: Network },
  { title: "data-quality check", detail: "NorthPort rules over holdings", icon: ShieldCheck },
  { title: "verdict", detail: "pass, errors, and warnings", icon: FileOutput }
] satisfies { title: string; detail: string; icon: typeof FileInput }[];

const audienceGroups = [
  {
    title: "ETF issuers",
    detail: "Check N-PORT holding data before a filing package moves to final review.",
    icon: Building2
  },
  {
    title: "Mutual fund sponsors",
    detail: "Run the same readiness checks across registered fund portfolios, not only ETFs.",
    icon: FileCheck2
  },
  {
    title: "Asset managers",
    detail: "Monitor reporting quality across many funds, series, and holdings feeds.",
    icon: Workflow
  },
  {
    title: "Fund administrators",
    detail: "Validate client data before handing exceptions back to fund teams.",
    icon: ClipboardCheck
  },
  {
    title: "Compliance and reporting teams",
    detail: "Review rule failures, warnings, and filing readiness in one audit trail.",
    icon: ShieldCheck
  },
  {
    title: "Data operations teams",
    detail: "Catch bad identifiers, currencies, fair-value levels, and missing values early.",
    icon: DatabaseZap
  },
  {
    title: "Portfolio accounting teams",
    detail: "Spot NAV and percent-of-assets reconciliation problems before sign-off.",
    icon: Database
  },
  {
    title: "Auditors, consultants, and regtech vendors",
    detail: "Use NorthPort as a deterministic validation layer in review or reporting workflows.",
    icon: FileSearch
  }
] satisfies { title: string; detail: string; icon: typeof Building2 }[];

const useCases = [
  "Pre-filing readiness checks",
  "Holdings data-quality review",
  "Identifier and reference-data validation",
  "NAV and percentage reconciliation",
  "Exception reports for compliance review",
  "Batch review across multiple funds",
  "Audit trail for rule failures",
  "Handoff support before human EDGAR filing"
] as const;

const stackGroups = [
  {
    title: "Backend",
    items: ["Python", "FastAPI", "lxml", "pydantic v2", "pandas", "pyreadstat", "multiprocessing", "SQLite"]
  },
  {
    title: "Frontend",
    items: ["React", "TypeScript", "Vite", "Tailwind CSS"]
  },
  {
    title: "Data",
    items: ["SEC N-PORT v1.13 XSD schema set", "GCAP 2025Q4 holdings", "Stata .dta"]
  }
] satisfies { title: string; items: string[] }[];

export function HomePage({ onLaunchDashboard }: Props) {
  return (
    <div className="home-page min-h-screen bg-base text-primaryText">
      <header className="relative z-20 border-b border-hairline bg-base/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card border border-hairline bg-surface text-accent shadow-panel">
              <Anchor aria-hidden size={19} />
            </div>
            <div>
              <div className="font-brand text-lg font-semibold tracking-normal">NorthPort</div>
              <div className="hidden text-xs text-secondaryText sm:block">SEC Form N-PORT pre-filing validation</div>
            </div>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-card bg-accent px-3 text-sm font-semibold text-[#080B10] transition hover:bg-accent/90"
            onClick={onLaunchDashboard}
            type="button"
          >
            <BarChart3 aria-hidden size={16} />
            <span>Open Dashboard</span>
          </button>
        </div>
      </header>

      <main>
        <section className="home-hero relative overflow-hidden border-b border-hairline px-4 py-10 sm:px-6 lg:px-8">
          <HeroDepthAnchor />
          <div className="home-hero-content relative z-10 mx-auto flex max-w-7xl flex-col justify-center gap-7">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-card border border-hairline bg-surface/80 px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-secondaryText">
                <BadgeCheck aria-hidden className="text-teal" size={14} />
                Data-quality validation tool
              </div>
              <h1 className="mt-5 font-brand text-4xl font-semibold tracking-normal text-primaryText">NorthPort</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-secondaryText">
                Mutual funds file detailed reports about what they own to the U.S. securities regulator, the SEC.
                Those reports are huge and easy to get wrong. NorthPort checks a fund's report before it is filed and
                flags problems so they can be fixed first.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-secondaryText">
                It checks missing information, bad data, and formatting that breaks the SEC's rules. It does not file
                anything itself; a person still submits the report.
              </p>
              <div className="mt-4 max-w-2xl rounded-card border border-hairline bg-surface/85 px-3 py-2 text-sm leading-6 text-secondaryText shadow-panel">
                <span className="font-semibold text-primaryText">Not SEC-certified</span> — NorthPort does not file to EDGAR. It
                implements the SEC's published v1.13 schema and adds its own data-quality checks; a person submits the filing.
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  className="inline-flex h-11 items-center gap-2 rounded-card bg-accent px-4 text-sm font-semibold text-[#080B10] transition hover:bg-accent/90"
                  onClick={onLaunchDashboard}
                  type="button"
                >
                  <Workflow aria-hidden size={17} />
                  <span>Launch NorthPort</span>
                  <ArrowRight aria-hidden size={16} />
                </button>
                <a
                  className="inline-flex h-11 items-center gap-2 rounded-card border border-hairline bg-surface/80 px-4 text-sm font-semibold text-primaryText transition hover:border-accent/50 hover:bg-raised"
                  href="#proof"
                >
                  <FileCheck2 aria-hidden size={17} />
                  <span>View Evidence</span>
                </a>
              </div>
              <div className="mt-6 rounded-card border border-hairline bg-surface/85 p-3 font-mono text-xs leading-6 text-secondaryText sm:hidden">
                <span className="text-primaryText">{GCAP_REFERENCE_RUN.filings.toLocaleString()}</span> filings /{" "}
                <span className="text-primaryText">{(GCAP_REFERENCE_RUN.holdings / 1_000_000).toFixed(1)}M+</span> holdings /{" "}
                <span className="text-error">~{Math.round(GCAP_REFERENCE_RUN.errors / 100) / 10}K</span> error-level issues
              </div>
            </div>
            <div className="hidden gap-3 sm:grid sm:grid-cols-3">
              <HeroStat label="filings checked" value={GCAP_REFERENCE_RUN.filings.toLocaleString()} />
              <HeroStat label="holdings scanned" value={`${(GCAP_REFERENCE_RUN.holdings / 1_000_000).toFixed(1)}M+`} />
              <HeroStat label="error-level issues" value={`~${Math.round(GCAP_REFERENCE_RUN.errors / 100) / 10}K`} tone="error" />
            </div>
          </div>
        </section>

        <section className="border-b border-hairline px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-secondaryText">
                <CheckCircle2 aria-hidden className="text-teal" size={15} />
                Two checks, plain English
              </div>
              <h2 className="mt-3 font-brand text-3xl font-semibold tracking-normal">What it checks</h2>
              <p className="mt-3 text-sm leading-6 text-secondaryText">
                Catching filing errors before submission can save a fund from rejected filings and compliance problems.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {checkSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article className="rounded-card border border-hairline bg-surface p-5 shadow-panel" key={step.title}>
                    <div className="flex items-center justify-between gap-3">
                      <Icon aria-hidden className="text-accent" size={20} />
                      <span className="font-mono text-xs uppercase tracking-[0.08em] text-secondaryText">{step.label}</span>
                    </div>
                    <h3 className="mt-5 text-base font-semibold text-primaryText">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-secondaryText">{step.detail}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-reveal border-b border-hairline bg-surface/35 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-secondaryText">
                  <Building2 aria-hidden className="text-gold" size={15} />
                  Who can use it
                </div>
                <h2 className="mt-3 font-brand text-3xl font-semibold tracking-normal">
                  Where NorthPort fits
                </h2>
                <p className="mt-3 text-sm leading-6 text-secondaryText">
                  A tool like NorthPort would fit anywhere fund holdings data is prepared, checked, reviewed, or handed off before
                  SEC Form N-PORT submission.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {audienceGroups.map((group) => {
                  const Icon = group.icon;
                  return (
                    <article className="rounded-card border border-hairline bg-base p-4 shadow-panel" key={group.title}>
                      <Icon aria-hidden className="text-accent" size={18} />
                      <h3 className="mt-4 text-sm font-semibold text-primaryText">{group.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-secondaryText">{group.detail}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-card border border-hairline bg-base p-4 shadow-panel">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck aria-hidden className="text-teal" size={17} />
                Main use cases
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {useCases.map((useCase) => (
                  <div className="rounded border border-hairline bg-surface px-3 py-2 text-xs leading-5 text-secondaryText" key={useCase}>
                    {useCase}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="home-reveal border-b border-hairline bg-surface/35 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-secondaryText">
                  <GitBranch aria-hidden className="text-gold" size={15} />
                  Filing pipeline
                </div>
                <h2 className="mt-3 font-brand text-3xl font-semibold tracking-normal">From source file to verdict</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-secondaryText">
                The output is a validation verdict with errors and warnings for review, not an automated SEC submission.
              </p>
            </div>
            <div className="mt-7 grid gap-3 lg:grid-cols-4">
              {pipelineStages.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <article className="relative overflow-hidden rounded-card border border-hairline bg-base p-4" key={stage.title}>
                    <span className="stage-progress" aria-hidden />
                    <div className="flex items-center justify-between gap-3">
                      <Icon aria-hidden className="text-accent" size={18} />
                      <span className="font-mono text-xs text-secondaryText">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-sm font-semibold text-primaryText">{stage.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-secondaryText">{stage.detail}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="home-reveal border-b border-hairline px-4 py-14 sm:px-6 lg:px-8" id="proof">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)]">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-secondaryText">
                <Database aria-hidden className="text-teal" size={15} />
                Proof it is real
              </div>
              <h2 className="mt-3 font-brand text-3xl font-semibold tracking-normal">Validated against real fund-holdings data</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-secondaryText">
                The latest GCAP reference run checked {GCAP_REFERENCE_RUN.holdings.toLocaleString()} real holdings across{" "}
                {GCAP_REFERENCE_RUN.filings.toLocaleString()} filings. It found {GCAP_REFERENCE_RUN.errors.toLocaleString()}{" "}
                error-level data issues and {GCAP_REFERENCE_RUN.warnings.toLocaleString()} warnings.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ProofMetric label="passed filings" value={GCAP_REFERENCE_RUN.passed.toLocaleString()} tone="success" />
                <ProofMetric label="failed filings" value={GCAP_REFERENCE_RUN.failed.toLocaleString()} tone="error" />
                <ProofMetric label="errors" value={GCAP_REFERENCE_RUN.errors.toLocaleString()} tone="error" />
                <ProofMetric label="warnings" value={GCAP_REFERENCE_RUN.warnings.toLocaleString()} tone="warning" />
              </div>
            </div>
            <aside className="rounded-card border border-hairline bg-surface p-5 shadow-panel">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden className="text-accent" size={18} />
                <h3 className="text-sm font-semibold">Rigor note</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-secondaryText">
                NorthPort implements the SEC's published Form N-PORT v1.13 schema checks and adds internal
                data-quality rules. It is not SEC-certified and does not file to EDGAR. EDGAR XML serialization is
                planned future work.
              </p>
            </aside>
          </div>
        </section>

        <section className="home-reveal px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-secondaryText">
                  <Layers3 aria-hidden className="text-accent" size={15} />
                  True stack
                </div>
                <h2 className="mt-3 font-brand text-3xl font-semibold tracking-normal">Built as deterministic validation software</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-secondaryText">
                The product technology is schema validation, explicit rules, and typed data processing.
              </p>
            </div>
            <div className="mt-7 grid gap-3 lg:grid-cols-3">
              {stackGroups.map((group) => (
                <article className="rounded-card border border-hairline bg-surface p-5 shadow-panel" key={group.title}>
                  <h3 className="text-sm font-semibold text-primaryText">{group.title}</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <span className="rounded border border-hairline bg-base px-2.5 py-1 font-mono text-xs text-primaryText" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-card border border-hairline bg-base p-4 text-sm text-secondaryText">
              <Sparkles aria-hidden className="shrink-0 text-gold" size={18} />
              <span>Built with AI-assisted development (Claude &amp; Codex) as development tooling, not as a runtime product capability.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function HeroDepthAnchor() {
  return (
    <div className="hero-depth-scene" aria-hidden>
      <div className="hero-depth-object">
        <div className="hero-depth-plane hero-depth-plane-back" />
        <div className="hero-depth-plane hero-depth-plane-mid" />
        <div className="hero-depth-plane hero-depth-plane-front" />
        <div className="hero-depth-anchor">
          <Anchor size={98} strokeWidth={1.25} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "error" }) {
  const toneClass = tone === "error" ? "text-error" : "text-primaryText";
  return (
    <div className="rounded-card border border-hairline bg-surface/85 p-4 shadow-panel">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular ${toneClass}`}>{value}</div>
    </div>
  );
}

function ProofMetric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "error"
          ? "text-error"
          : "text-primaryText";
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="text-xs uppercase tracking-[0.08em] text-secondaryText">{label}</div>
      <div className={`mt-3 font-mono text-xl font-semibold tabular ${toneClass}`}>{value}</div>
    </div>
  );
}
