"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

const COOKIE_NAME = "tenant-filter";

const OPTIONS = [
  { value: "", label: "Toutes les apps" },
  { value: "menal", label: "MENAL" },
  { value: "elson", label: "Elson" },
];

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

// Filtre visible sur Vue d ensemble, Detections, Incidents, Couverture — les
// seules vues dont l API accepte ?tenant= (voir siem.py, limites documentees
// en tete de fichier : overview/vulnerabilities/alertes/logs restent globaux,
// les tables sources n ont pas encore de colonne service).
export default function TenantFilter() {
  const router = useRouter();
  const [tenant, setTenant] = useState("");

  useEffect(() => {
    setTenant(readCookie(COOKIE_NAME));
  }, []);

  function onChange(next: string) {
    setTenant(next);
    if (next) {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } else {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    }
    // Les pages concernees sont des Server Components qui lisent ce cookie a
    // chaque rendu : refresh() re-execute leur fetch sans rechargement complet.
    router.refresh();
  }

  return (
    <div className="px-3 mb-1">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)] mb-1.5">
        <Building2 size={12} /> Application
      </label>
      <select
        value={tenant}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg text-sm bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
