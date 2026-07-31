"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ScrollText, AlertTriangle, LogOut, Shield,
  Radar, Siren, Target, Bug, KeyRound,
} from "lucide-react";
import clsx from "clsx";

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
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-slate-700/60 flex items-center gap-2.5">
        <Shield className="text-blue-400" size={24} />
        <span className="font-bold text-sm leading-tight">
          MENAL SOC<br />
          <span className="text-slate-400 font-normal text-xs">Zero Trust</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                      active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
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

      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
