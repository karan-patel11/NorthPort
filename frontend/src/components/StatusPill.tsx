import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";
import type { FilingStatus } from "../lib/api";

type Props = {
  status: FilingStatus | "error" | "warning";
};

const styles = {
  pass: "bg-success/10 text-success border-success/20",
  warn: "bg-warning/10 text-warning border-warning/20",
  fail: "bg-error/10 text-error border-error/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error: "bg-error/10 text-error border-error/20"
};

const labels = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
  warning: "Warning",
  error: "Error"
};

export function StatusPill({ status }: Props) {
  const Icon = status === "pass" ? CheckCircle2 : status === "fail" || status === "error" ? XCircle : TriangleAlert;

  return (
    <span
      className={`inline-flex min-w-[72px] items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold uppercase leading-none ${styles[status]}`}
    >
      <Icon aria-hidden size={13} strokeWidth={2} />
      {labels[status]}
    </span>
  );
}
