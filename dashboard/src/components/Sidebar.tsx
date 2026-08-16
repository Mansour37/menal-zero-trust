"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ScrollText, AlertTriangle, LogOut,
  Radar, Siren, Target, Bug, KeyRound, HeartPulse, ChevronRight, Bell,
} from "lucide-react";
import clsx from "clsx";
import ThemeToggle from "@/components/ThemeToggle";
import TenantFilter from "@/components/TenantFilter";

const navGroups = [
  {
    label: "Surveillance",
    items: [
      { href: "/",       label: "Vue d'ensemble", icon: LayoutDashboard },
      { href: "/logs",   label: "Logs API",        icon: ScrollText },
      { href: "/alerts", label: "Alertes API",     icon: AlertTriangle },
    ],
  },
  {
    label: "Détection & analyse",
    items: [
      { href: "/detections",      label: "Détections Sigma",  icon: Radar },
      { href: "/incidents",       label: "Incidents",         icon: Siren },
      { href: "/coverage",        label: "Couverture ATT&CK", icon: Target },
      { href: "/vulnerabilities", label: "Vulnérabilités",    icon: Bug },
      { href: "/rules",           label: "Santé des règles",  icon: HeartPulse },
    ],
  },
  {
    label: "Compte",
    items: [
      { href: "/settings/security", label: "Sécurité (MFA)", icon: KeyRound },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 min-h-screen bg-[var(--surface)] border-r border-[var(--border)] text-[var(--ink)] flex flex-col shrink-0">
      {/* Marque + environnement */}
      <div className="px-4 pt-5 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute -inset-1 rounded-xl bg-[var(--accent-grad)] opacity-30 blur-[6px]" />
            <div className="relative w-9 h-9 rounded-xl bg-[var(--accent-grad)] flex items-center justify-center shadow-[var(--shadow-accent)] p-1.5">
              <img src="/logo-shield.png" alt="MENAL" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[13px] tracking-tight">MENAL Sentinel</p>
            <p className="text-[10px] text-[var(--ink-faint)] font-medium">Zero Trust SOC</p>
          </div>
          <span className="ml-auto pill bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border)]">
            RECETTE
          </span>
        </div>
      </div>

      {/* Filtre d'application */}
      <div className="pt-4">
        <TenantFilter />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="label-overline px-2.5 mb-1.5">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx("nav-item group", active && "nav-item-active")}
                  >
                    <Icon size={16} strokeWidth={2} />
                    <span className="flex-1">{label}</span>
                    <ChevronRight
                      size={13}
                      className={clsx(
                        "text-[var(--ink-faint)] transition-transform",
                        active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                      )}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pied : compte + thème */}
      <div className="border-t border-[var(--border)] px-2.5 pt-3 pb-4 space-y-1">
        <ThemeToggle />
        <div className="flex items-center gap-2.5 px-2 py-2 mt-1">
          <div className="relative w-7 h-7 rounded-full bg-[var(--surface-3)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
            <span className="mono text-[10px] font-bold text-[var(--accent)]">SA</span>
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">Analyste sécurité</p>
            <p className="text-[10px] text-[var(--ink-faint)]">v0.1.0</p>
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="relative w-7 h-7 rounded-lg flex items-center justify-center text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition shrink-0"
          >
            <Bell size={15} strokeWidth={2} />
            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--sev-critical)] ring-2 ring-[var(--surface)]" />
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-[var(--ink-faint)]"
        >
          <LogOut size={16} />
          <span className="flex-1">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}