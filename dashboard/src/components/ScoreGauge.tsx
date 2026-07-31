import clsx from "clsx";
import { Severity } from "@/lib/types";

const BAR_COLOR: Record<Severity, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-slate-400",
};

export default function ScoreGauge({ score, severity }: { score: number; severity: Severity }) {
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all", BAR_COLOR[severity])}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums w-6 text-right text-gray-600">{score}</span>
    </div>
  );
}
