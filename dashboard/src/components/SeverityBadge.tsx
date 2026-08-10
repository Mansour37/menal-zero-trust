import clsx from "clsx";
import { Severity } from "@/lib/types";

const STYLES: Record<Severity, string> = {
  CRITICAL: "bg-[var(--sev-critical-bg)] text-[var(--sev-critical)] border-l-[var(--sev-critical)]",
  HIGH: "bg-[var(--sev-high-bg)] text-[var(--sev-high)] border-l-[var(--sev-high)]",
  MEDIUM: "bg-[var(--sev-medium-bg)] text-[var(--sev-medium)] border-l-[var(--sev-medium)]",
  LOW: "bg-[var(--sev-low-bg)] text-[var(--sev-low)] border-l-[var(--sev-low)]",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide border-l-2",
        STYLES[severity]
      )}
    >
      {severity}
    </span>
  );
}
