"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { BottomNav, TopBar } from "@/components/Navigation";
import { isLoggedIn, tryRestoreSession, logout, getMyProfile } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";
import { ScheduleTimetable, ScheduleBuilder } from "@/components/ScheduleBoard";
import { PauseScheduler } from "@/components/PauseScheduler";

// My Agenda — reuses the REAL schedule components (live data, all strategies,
// past + upcoming slots). ScheduleTimetable = read-only programme for everyone;
// ScheduleBuilder = admin editing (slots / credit / hybrid + per-user credit
// windows). Premium teal accent applied via CSS-var override that works in BOTH
// light and dark (only the accent shifts; surfaces/text inherit the app theme).

export default function MyAgendaPage() {
  const router = useRouter();
  const { rtl, t } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.replace("/login"); return; }
      }
      setAuthed(true);
      getMyProfile().then(({ data }) => { if (data?.profile?.role === "admin") setIsAdmin(true); }).catch(() => {});
    }
    init();
  }, []);

  if (!authed) return null;

  return (
    <div className={`agenda-premium${rtl ? " rtl" : ""}`} dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: 90 }}>
      <style>{`
        /* Premium teal accent — light + dark safe: only the accent shifts to teal,
           every surface/border/text keeps the app theme so it adapts to both modes. */
        .agenda-premium{ --accent-green:#08DDB8; --accent-green-soft:rgba(8,221,184,.14); --primary-light:#08DDB8; }
        .agenda-premium h1,.agenda-premium h2,.agenda-premium h3{ font-family:'Inter Tight','Inter',system-ui,sans-serif; letter-spacing:-.02em; }
      `}</style>
      <TopBar onLogout={() => { logout(); router.replace("/login"); }} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <CalendarClock size={22} color="var(--primary-light)" />
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("nav.myAgenda")}</h1>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          {t("myAgenda.subtitle")}
        </p>

        {/* Real, live programme (read-only) — reflects the active strategy + past/upcoming slots */}
        <ScheduleTimetable />

        {/* Admin: full editor — slots / credit / hybrid + per-user credit windows */}
        {isAdmin && <ScheduleBuilder />}

        {/* Admin: time moderation — emergency / scheduled pause (moved from Community) */}
        {isAdmin && <PauseScheduler />}
      </main>
      <BottomNav />
    </div>
  );
}
