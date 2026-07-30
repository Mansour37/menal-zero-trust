"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ScrollText, AlertTriangle, LogOut, Shield } from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/",        label: "Vue d ensemble", icon: LayoutDashboard },
  { href: "/logs",    label: "Logs API",        icon: ScrollText },
  { href: "/alerts",  label: "Alertes",         icon: AlertTriangle },
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
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700 flex items-center gap-2">
        <Shield className="text-blue-400" size={22} />
        <span className="font-bold text-sm leading-tight">
          MENAL<br />
          <span className="text-gray-400 font-normal text-xs">Zero Trust</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
              pathname === href
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
