import { Inbox, type LucideIcon } from "lucide-react";

interface Props {
  message: string;
  hint?: string;
  icon?: LucideIcon;
}

export default function EmptyState({ message, hint, icon: Icon = Inbox }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-[var(--ink-faint)] fade-up">
      <div className="relative mb-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
          <Icon size={22} className="opacity-60" strokeWidth={1.6} />
        </div>
        <span className="absolute -right-1 -bottom-1 w-3 h-3 rounded-full bg-[var(--ok)] opacity-70" />
      </div>
      <p className="text-sm text-center max-w-sm text-[var(--ink-muted)] leading-relaxed">{message}</p>
      {hint && <p className="text-xs text-center max-w-sm mt-2 text-[var(--ink-faint)]">{hint}</p>}
    </div>
  );
}