import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function MetricTile({ label, value, detail, icon: Icon }: Props) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-secondaryText">{label}</span>
        <Icon aria-hidden className="text-secondaryText" size={17} />
      </div>
      <div className="mt-4 font-mono text-2xl font-semibold tabular text-primaryText">{value}</div>
      <div className="mt-1 text-xs text-secondaryText">{detail}</div>
    </div>
  );
}
