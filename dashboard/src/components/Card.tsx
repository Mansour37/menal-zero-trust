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
    <div className={clsx("bg-white rounded-xl border border-gray-200", className)}>
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {action}
        </div>
      )}
      <div className={noPadding ? undefined : "p-5"}>{children}</div>
    </div>
  );
}
