"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ScrollText, AlertTriangle, LogOut, Shield,
  Radar, Siren, Target, Bug, KeyRound, HeartPulse,
} from "lucide-react";
import clsx from "clsx";
import ThemeToggle from "@/components/ThemeToggle";
import TenantFilter from "@/components/TenantFilter";

const navGroups = [
  {
    label: "Surveillance",
    items: [
      { href: "/",       label: "Vue d ensemble", icon: LayoutDashboard },
      { href: "/logs",   label: "Logs API",       icon: ScrollText },
      { href: "/alerts", label: "Alertes API",    icon: AlertTriangle },
    ],
  },
  {
    label: "Détection & analyse",
    items: [
      { href: "/detections",     label: "Détections Sigma",  icon: Radar },
      { href: "/incidents",      label: "Incidents",         icon: Siren },
      { href: "/coverage",       label: "Couverture ATT&CK", icon: Target },
      { href: "/vulnerabilities", label: "Vulnérabilités",   icon: Bug },
      { href: "/rules",           label: "Santé des règles", icon: HeartPulse },
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
    <aside className="w-64 min-h-screen bg-[var(--surface)] border-r border-[var(--border)] text-[var(--ink)] flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center gap-2.5">
        {/* Emplacement logo : pictogramme generique en attente du fichier reel (voir memoire project_menal_dashboard_redesign) */}
        <Shield className="text-[var(--accent)]" size={24} />
        <span className="font-bold text-sm leading-tight">
          MENAL SOC<br />
          <span className="text-[var(--ink-faint)] font-normal text-xs">Zero Trust</span>
        </span>
      </div>

      <div className="pt-4">
        <TenantFilter />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-5 space-y-1 border-t border-[var(--border)] pt-3">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-[var(--ink-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
