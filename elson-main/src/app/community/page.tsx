"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { BottomNav, TopBar } from "@/components/Navigation";
import { isLoggedIn, tryRestoreSession, logout, markCommunityRead } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";
import CommunityImmersive from "@/components/CommunityImmersive";

// Community = the immersive scroller by DEFAULT, but BOUNDED between the top navbar
// and the bottom navbar (both stay visible). Premium teal accent (same language as
// My Agenda), theme-aware light + dark.
export default function CommunityPage() {
  const router = useRouter();
  const { rtl } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.replace("/login"); return; }
      }
      setAuthed(true);
      markCommunityRead().catch(() => {}); // clears the +N badge
    }
    init();
  }, []);

  if (!authed) return null;

  return (
    <div className={`community-premium${rtl ? " rtl" : ""}`} dir={rtl ? "rtl" : "ltr"} style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-dark)" }}>
      <style>{`
        /* Premium teal accent — same language as My Agenda. Light + dark safe: only
           the accent shifts to teal; every surface/border/text keeps the app theme. */
        .community-premium{ --accent-green:#08DDB8; --accent-green-soft:rgba(8,221,184,.14); --primary-light:#08DDB8; }
        .community-premium h1,.community-premium h2,.community-premium h3{ font-family:'Inter Tight','Inter',system-ui,sans-serif; letter-spacing:-.02em; }
      `}</style>
      <TopBar onLogout={() => { logout(); router.replace("/login"); }} />

      {/* Preview video banner — tap to open the 9:16 player */}
      <button onClick={() => setVideoOpen(true)} style={{
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        width: "calc(100% - 24px)", margin: "10px auto 2px", padding: "11px 14px",
        borderRadius: 14, cursor: "pointer", textAlign: rtl ? "right" : "left",
        background: "linear-gradient(100deg, var(--accent-green-soft), transparent)",
        border: "1px solid var(--accent-green-soft)", color: "var(--text-primary)",
      }}>
        <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--accent-green)", color: "#03110d" }}>
          <Play size={17} fill="currentColor" />
        </span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: "0.92rem", fontWeight: 800, lineHeight: 1.2 }}>Elson en mouvement</span>
          <span style={{ fontSize: "0.76rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Regarde comment ta voix construit l'IA</span>
        </span>
      </button>

      {/* Bounded immersive area: between the top bar and the floating bottom nav */}
      <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <CommunityImmersive />
      </main>

      {videoOpen && (
        <div onClick={() => setVideoOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.88)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          display: "grid", placeItems: "center", padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "min(420px, 92vw)", maxHeight: "88vh", aspectRatio: "9 / 16" }}>
            <button onClick={() => setVideoOpen(false)} aria-label="Fermer" style={{
              position: "absolute", top: -46, insetInlineEnd: 0, width: 38, height: 38, borderRadius: "50%",
              border: "none", cursor: "pointer", background: "rgba(255,255,255,.14)", color: "#fff", display: "grid", placeItems: "center",
            }}><X size={18} /></button>
            <video src="/elson_PREVIEW_partial.mp4" controls autoPlay playsInline style={{ width: "100%", height: "100%", borderRadius: 16, background: "#000", objectFit: "contain" }} />
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
