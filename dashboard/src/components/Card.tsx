import clsx from "clsx";
import type { ReactNode } from "react";

interface Props {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Card({ title, action, children, className, noPadding }: Props) {
  return (
    <div className={clsx("bg-[var(--surface)] rounded-xl border border-[var(--border)]", className)}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
          {action}
        </div>
      )}
      <div className={noPadding ? undefined : "p-5"}>{children}</div>
    </div>
  );
}
