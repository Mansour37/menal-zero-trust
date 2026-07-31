import clsx from "clsx";
import { Severity } from "@/lib/types";

const STYLES: Record<Severity, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border tracking-wide",
        STYLES[severity]
      )}
    >
      {severity}
    </span>
  );
}
