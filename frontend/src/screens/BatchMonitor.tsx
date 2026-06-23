import { useQuery } from "@tanstack/react-query";
import { Cpu, DatabaseZap, Gauge, MemoryStick } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricTile } from "../components/MetricTile";
import { StatusPill } from "../components/StatusPill";
import { fetchLatestBatch } from "../lib/api";
import { IS_DEMO_MODE, STATIC_DEMO_NOTICE } from "../lib/referenceRun";

export function BatchMonitor() {
  const { data } = useQuery({ queryKey: ["batch-latest"], queryFn: fetchLatestBatch });
  const batch = data?.batch ?? null;
  const hasData = Boolean(data?.has_data && batch);
  const samples =
    batch?.results.map((result, index) => ({
      label: String(index + 1),
      filings: result.elapsed_seconds > 0 ? 1 / result.elapsed_seconds : 0,
      holdings: result.holdings_per_second ?? 0,
      memory: result.peak_rss_mb ?? null,
      path: result.path,
      status: result.passed ? "pass" : "fail"
    })) ?? [];

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="font-brand text-3xl font-semibold tracking-normal">Batch Monitor</h1>
        <p className="mt-1 font-mono text-sm text-secondaryText">
          {IS_DEMO_MODE ? "static reference run" : hasData ? "latest measured run" : "no runs yet"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={Gauge}
          label="Progress"
          value={hasData ? "complete" : "no data"}
          detail={hasData ? `${batch?.passed_filings ?? 0} / ${batch?.total_filings ?? 0} passed` : "no batch run yet"}
        />
        <MetricTile
          icon={DatabaseZap}
          label="Throughput"
          value={hasData && batch ? formatHoldingsThroughput(batch.holdings_per_second) : "no data"}
          detail={IS_DEMO_MODE ? "audited reference run" : hasData ? `${(batch?.filings_per_second ?? 0).toFixed(2)} filings/sec` : "measured after run"}
        />
        <MetricTile
          icon={Cpu}
          label="Workers"
          value={hasData ? (batch?.worker_count == null ? (IS_DEMO_MODE ? "not recorded" : "measured") : String(batch.worker_count)) : "no data"}
          detail="process pool"
        />
        <MetricTile
          icon={MemoryStick}
          label="MB/Worker"
          value={batch?.peak_rss_mb_per_worker == null ? "no data" : batch.peak_rss_mb_per_worker.toFixed(0)}
          detail="peak RSS"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame title="Throughput">
          {IS_DEMO_MODE ? (
            <EmptyChart label="aggregate reference metric" />
          ) : hasData ? (
            <ResponsiveContainer>
              <AreaChart data={samples}>
                <CartesianGrid stroke="#2A3443" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11 }} stroke="#2A3443" />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} stroke="#2A3443" />
                <Tooltip contentStyle={{ background: "#0F141C", border: "1px solid #2A3443", color: "#F1F5F9" }} />
                <Area dataKey="filings" fill="#38BDF8" fillOpacity={0.22} stroke="#38BDF8" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="no data" />
          )}
        </ChartFrame>
        <ChartFrame title="Memory Per Worker">
          {IS_DEMO_MODE ? (
            <EmptyChart label="aggregate reference metric" />
          ) : hasData && samples.some((sample) => sample.memory != null) ? (
            <ResponsiveContainer>
              <LineChart data={samples}>
                <CartesianGrid stroke="#2A3443" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11 }} stroke="#2A3443" />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} stroke="#2A3443" />
                <Tooltip contentStyle={{ background: "#0F141C", border: "1px solid #2A3443", color: "#F1F5F9" }} />
                <Line dataKey="memory" dot={false} stroke="#14B8A6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="no data" />
          )}
        </ChartFrame>
      </div>

      <div className="rounded-card border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3 text-sm font-semibold">Per-Filing Status</div>
        {IS_DEMO_MODE ? (
          <div className="p-6 text-sm leading-6 text-secondaryText">{STATIC_DEMO_NOTICE} Per-filing timing samples are local-run data.</div>
        ) : hasData ? (
          <div className="grid gap-px bg-hairline p-px sm:grid-cols-2 lg:grid-cols-4">
            {samples.map((sample) => (
              <div className="bg-surface p-3" key={sample.path}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{sample.path}</div>
                    <div className="mt-1 text-xs text-secondaryText">{sample.holdings.toFixed(0)} holdings/sec</div>
                  </div>
                  <StatusPill status={sample.status as "pass" | "fail"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-secondaryText">no runs yet</div>
        )}
      </div>
    </section>
  );
}

function formatHoldingsThroughput(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K holdings/sec` : `${value.toFixed(0)} holdings/sec`;
}

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-card border border-dashed border-hairline text-sm text-secondaryText">
      {label}
    </div>
  );
}
