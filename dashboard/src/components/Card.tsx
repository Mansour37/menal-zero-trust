import clsx from "clsx";
import type { ReactNode } from "react";

interface Props {
  title?: string;
  overline?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  hover?: boolean;
  /** Élévation au repos plus marquée (--shadow-md), pour les cartes "hero"
   *  (visualisation principale d'une page) plutôt que les tuiles de routine. */
  elevated?: boolean;
}

export default function Card({ title, overline, action, children, className, noPadding, hover, elevated }: Props) {
  return (
    <section className={clsx("card-surface", hover && "card-surface-hover", elevated && "shadow-[var(--shadow-md)]", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div>
            {overline && <p className="label-overline mb-0.5">{overline}</p>}
            <h3 className="text-[13.5px] font-bold text-[var(--ink)] tracking-tight">{title}</h3>
          </div>
          {action}
        </div>
      )}
      <div className={clsx(noPadding ? undefined : "p-5", title && "pt-4")}>{children}</div>
    </section>
  );
}