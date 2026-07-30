"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, PenLine, Headphones } from "lucide-react";
import { BottomNav, TopBar } from "@/components/Navigation";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n-context";
import { logout } from "@/lib/api";

// The orb cycles through translated showcase words while the model is "in creation"
// (sourced from i18n key studio.words, "·"-separated, so it follows the locale).

// Self-contained styles for the glowing orb (box-shadow technique, Elson teal) +
// a dark "stage" so the orb pops on BOTH light and dark themes.
const STUDIO_CSS = `
.studio-stage{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;
  width:min(560px,92vw);height:300px;margin:32px auto 14px;border-radius:28px;
  background:radial-gradient(circle at 50% 42%,#0c211c 0%,#05100d 76%);
  border:1px solid var(--border);box-shadow:0 24px 70px rgba(0,0,0,.4),inset 0 0 70px rgba(0,0,0,.45)}
.loader-wrapper{font-family:'Inter Tight',Inter,system-ui,sans-serif;font-size:1.35em;font-weight:500;
  position:relative;z-index:1;display:flex;align-items:center;justify-content:center;
  width:220px;height:220px;border-radius:50%;color:#fff;user-select:none}
.loader{position:absolute;inset:0;border-radius:50%;z-index:0;background:transparent;
  animation:studio-rotate 2s linear infinite}
@keyframes studio-rotate{
  0%{transform:rotate(90deg);box-shadow:0 22px 44px 0 #fff inset,0 44px 66px 0 #5EEAD4 inset,0 132px 132px 0 #069f84 inset}
  50%{transform:rotate(270deg);box-shadow:0 22px 44px 0 #fff inset,0 44px 22px 0 #08DDB8 inset,0 88px 132px 0 #064f43 inset}
  100%{transform:rotate(450deg);box-shadow:0 22px 44px 0 #fff inset,0 44px 66px 0 #5EEAD4 inset,0 132px 132px 0 #069f84 inset}}
.loader-letter{display:inline-block;opacity:.4;z-index:1;animation:studio-pulse 2s infinite}
@keyframes studio-pulse{0%,100%{opacity:.4;transform:translateY(0)}20%{opacity:1;transform:scale(1.15)}40%{opacity:.7;transform:translateY(0)}}
.loader-wrapper.word-out .loader-letter{animation:none !important;opacity:0 !important;transition:opacity .35s ease}
.studio-card{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:16px 18px;text-align:start}
@keyframes studio-live{0%,100%{box-shadow:0 0 0 0 var(--accent-green-soft)}50%{box-shadow:0 0 0 5px transparent}}
`;

const FEATURES = [
  { icon: PenLine, titleKey: "studio.f1t", descKey: "studio.f1d" },
  { icon: Headphones, titleKey: "studio.f2t", descKey: "studio.f2d" },
];

export default function StudioPage() {
  const router = useRouter();
  const { t, rtl } = useI18n();
  const WORDS = t("studio.words").split(" · ").filter(Boolean);
  const [wi, setWi] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setOut(true);
      setTimeout(() => { setWi((w) => (w + 1) % WORDS.length); setOut(false); }, 380);
    }, 3600);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => { await logout(); router.push("/"); };
  const word = WORDS[wi] || WORDS[0] || "";
  const renderWordAsBlock = rtl || word === "Elson TTS";

  return (
    <div className={rtl ? "rtl" : ""} dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: 100 }}>
      <TopBar onLogout={handleLogout} />
      <BottomNav />
      <style>{STUDIO_CSS}</style>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 20px" }}>
        {/* ── Hero ── */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14,
            padding: "6px 14px", borderRadius: 999, background: "var(--accent-green-soft)",
            color: "var(--accent-green)", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase",
          }}>
            <Sparkles size={13} /> {t("studio.badge")}
          </div>

          <h1 style={{ fontSize: "2.1rem", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-primary)", margin: "0 0 12px", lineHeight: 1.1 }}>
            Elson Voice Studio
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.75, maxWidth: 440, margin: "0 auto" }}>
            {t("studio.lead")}
          </p>

          {/* Orb */}
          <div className="studio-stage">
            <StageWaveform />
            <div className={`loader-wrapper${out ? " word-out" : ""}`} aria-label="Modèle TTS en cours d'entraînement">
              {renderWordAsBlock ? (
                <span
                  className="loader-letter"
                  dir={word === "Elson TTS" ? "ltr" : undefined}
                  style={{ animationDelay: "0s", unicodeBidi: word === "Elson TTS" ? "isolate" : undefined }}
                >
                  {word}
                </span>
              ) : (
                Array.from(word).map((ch, i) => (
                  <span key={`${wi}-${i}`} className="loader-letter" style={{ animationDelay: `${i * 0.1}s` }}>
                    {ch === " " ? " " : ch}
                  </span>
                ))
              )}
              <div className="loader" />
            </div>
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "var(--text-muted)",
            border: "1px solid var(--border)", borderRadius: 999, padding: "7px 15px", background: "var(--surface-1)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-green)", boxShadow: "0 0 0 4px var(--accent-green-soft)", animation: "studio-live 2s ease-in-out infinite" }} />
            {t("studio.status")}
          </div>
        </div>

        {/* ── Ce que tu pourras faire ── */}
        <SectionTitle>{t("studio.features")}</SectionTitle>
        <div style={{ display: "grid", gap: 12 }}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.titleKey} className="studio-card" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>
                  <Icon size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{t(f.titleKey)}</div>
                  <div style={{ fontSize: "0.87rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{t(f.descKey)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Sonic waveform — vanilla canvas port (Elson teal), sized to the stage, mouse-reactive.
function StageWaveform() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!ctx || !parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: 0, y: 0, active: false };
    let raf = 0, time = 0;
    const w = () => canvas.width / dpr;
    const h = () => canvas.height / dpr;
    const size = () => {
      const r = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.fillStyle = "rgba(5,16,13,0.14)";       // teal-black motion trail
      ctx.fillRect(0, 0, w(), h());
      const lineCount = 42, segs = 70, mid = h() / 2;
      for (let i = 0; i < lineCount; i++) {
        ctx.beginPath();
        const ci = Math.sin((i / lineCount) * Math.PI);
        ctx.strokeStyle = `rgba(8,221,184,${ci * 0.45})`;
        ctx.lineWidth = 1.3;
        for (let j = 0; j <= segs; j++) {
          const x = (j / segs) * w();
          const dm = mouse.active ? Math.hypot(x - mouse.x, mid - mouse.y) : 1e9;
          const me = Math.max(0, 1 - dm / 260);
          const noise = Math.sin(j * 0.1 + time + i * 0.2) * 10;
          const spike = Math.cos(j * 0.2 + time + i * 0.1) * Math.sin(j * 0.05 + time) * 26;
          const y = mid + noise + spike * (1 + me * 2);
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      time += 0.02;
    };
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };
    const ro = new ResizeObserver(size);
    ro.observe(parent);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    size(); draw();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: "34px 0 14px" }}>
      {children}
    </h2>
  );
}
