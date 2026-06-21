import { useQuery } from "@tanstack/react-query";
import { Cpu, DatabaseZap, Gauge, MemoryStick } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricTile } from "../components/MetricTile";
import { StatusPill } from "../components/StatusPill";
import { fetchLatestBatch } from "../lib/api";

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
        <h1 className="font-brand text-3xl tracking-[0.04em]">Batch Monitor</h1>
        <p className="mt-1 font-mono text-sm text-secondaryText">{hasData ? "latest measured run" : "no runs yet"}</p>
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
          label="Filings/Sec"
          value={hasData ? (batch?.filings_per_second ?? 0).toFixed(2) : "no data"}
          detail={hasData ? `${(batch?.holdings_per_second ?? 0).toFixed(0)} holdings/sec` : "measured after run"}
        />
        <MetricTile icon={Cpu} label="Workers" value={hasData ? "measured" : "no data"} detail="process pool" />
        <MetricTile
          icon={MemoryStick}
          label="MB/Worker"
          value={batch?.peak_rss_mb_per_worker == null ? "no data" : batch.peak_rss_mb_per_worker.toFixed(0)}
          detail="peak RSS"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame title="Throughput">
          {hasData ? (
            <ResponsiveContainer>
              <AreaChart data={samples}>
                <CartesianGrid stroke="#252D3D" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8A94A6", fontSize: 11 }} stroke="#252D3D" />
                <YAxis tick={{ fill: "#8A94A6", fontSize: 11 }} stroke="#252D3D" />
                <Tooltip contentStyle={{ background: "#121823", border: "1px solid #252D3D", color: "#E6EAF0" }} />
                <Area dataKey="filings" fill="#3B82F6" fillOpacity={0.22} stroke="#3B82F6" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartFrame>
        <ChartFrame title="Memory Per Worker">
          {hasData && samples.some((sample) => sample.memory != null) ? (
            <ResponsiveContainer>
              <LineChart data={samples}>
                <CartesianGrid stroke="#252D3D" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8A94A6", fontSize: 11 }} stroke="#252D3D" />
                <YAxis tick={{ fill: "#8A94A6", fontSize: 11 }} stroke="#252D3D" />
                <Tooltip contentStyle={{ background: "#121823", border: "1px solid #252D3D", color: "#E6EAF0" }} />
                <Line dataKey="memory" dot={false} stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartFrame>
      </div>

      <div className="rounded-card border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3 text-sm font-semibold">Per-Filing Status</div>
        {hasData ? (
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

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center rounded-card border border-dashed border-hairline text-sm text-secondaryText">
      no data
    </div>
  );
}
