"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Globe, PenLine, Mic, Trophy, ArrowRight, ArrowLeft, Sparkles, Zap, Shield, Users, CheckCircle, Star, Clock, HelpCircle, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { LanguageSwitcher } from "@/components/Navigation";
import { DottedSurface } from "@/components/DottedSurface";
import FlashBanner from "@/components/FlashBanner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function SpotlightCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };
  return <div ref={ref} className={`spotlight-card ${className}`} onMouseMove={handleMouse} style={style}>{children}</div>;
}

const FAQ_ITEMS = ["duration", "joinAnytime", "howToWin", "latinScript", "communication", "contact", "sharedAccount", "report"];

function useCountdown(targetDate: string) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return time;
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 80, height: 88, borderRadius: 16,
        background: "rgba(16, 185, 129, 0.06)",
        border: "1px solid rgba(16, 185, 129, 0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.04em",
        color: "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(16, 185, 129, 0.05)",
      }}>
        {String(value).padStart(2, "0")}
      </div>
      <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<any>({});
  const [season0, setSeason0] = useState<any[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { t, rtl } = useI18n();

  useEffect(() => {
    setMounted(true);
    fetch(`${API_URL}/api/public/stats`).then(r => r.json()).then(d => {
      setStats(d.stats);
      setConfig(d.config ?? {});
      setSeason0(Array.isArray(d.season0) ? d.season0 : []);
    }).catch(() => {});
    // Refresh every 30s
    const id = setInterval(() => {
      fetch(`${API_URL}/api/public/stats`).then(r => r.json()).then(d => {
        setStats(d.stats);
        setConfig(d.config ?? {});
        setSeason0(Array.isArray(d.season0) ? d.season0 : []);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const countdown = useCountdown(config.countdown_date ?? "2026-06-07T23:59:00Z");
  const endCountdown = useCountdown(config.competition_end_date ?? "2026-06-26T23:59:00Z");
  // Once the launch countdown hits zero (or the backend flips the competition to
  // active/ended), swap the timer for a "it's never too late" call-to-action.
  const launched = mounted && (
    config.competition_status === "active" ||
    config.competition_status === "ended" ||
    (countdown.days === 0 && countdown.hours === 0 && countdown.minutes === 0 && countdown.seconds === 0)
  );

  return (
    <div className={`noise-bg grid-bg ${rtl ? "rtl" : ""}`} dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Animated dotted-wave surface (Three.js) — subtle on-brand backdrop behind the hero */}
      {/* DEBUG: wrapper rouge translucide pour localiser le problème (à retirer après) */}
      <DottedSurface style={{ position: "fixed", zIndex: 0, opacity: 1, background: "rgba(255,0,80,0.15)" }} />

      <div className="glow-orb" style={{ width: 700, height: 500, background: "rgba(16, 185, 129, 0.07)", top: "-15%", left: "50%", transform: "translateX(-50%)" }} />
      <div className="glow-orb" style={{ width: 400, height: 400, background: "rgba(52, 211, 153, 0.05)", bottom: "5%", left: "-5%", animation: "float 8s ease-in-out infinite" }} />

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "12px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(3, 15, 10, 0.7)", backdropFilter: "blur(24px) saturate(140%)", borderBottom: "1px solid var(--border)" }}>
        <img src="/elson-logo.svg" alt="Elson" style={{ height: 52 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          <Link href="/login" className="btn-primary" style={{ padding: "10px 24px", fontSize: 14 }}>
            {t("landing.cta")} {rtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
          </Link>
        </div>
      </nav>

      <main className={mounted ? "fade-in" : ""} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative", zIndex: 1 }}>

        {/* Tournoi flash : bandeau + compte à rebours (visible si actif/à venir) */}
        <div style={{ width: "min(560px, 100%)", textAlign: "left" }}>
          <FlashBanner />
        </div>

        {/* Badge */}
        <div className="stagger-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 100, background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.12)", fontSize: "0.8rem", fontWeight: 600, color: "var(--primary-light)", marginBottom: 32 }}>
          <Sparkles size={13} /> {config.competition_name || t("landing.badge")}
        </div>

        {/* Hero */}
        <h1 className="stagger-2" style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: rtl ? "normal" : "-0.05em", marginBottom: 8, maxWidth: 800 }}>
          <span style={{ background: "linear-gradient(180deg, #f0f0ff 0%, #94a3b8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("landing.title1")}</span>
          <br />
          <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("landing.title2")}</span>
        </h1>
        <p className="stagger-2" style={{ fontSize: "1.1rem", color: "var(--text-secondary)", marginBottom: 12, fontWeight: 500, letterSpacing: "0.05em" }}>
          Hassaniya · Pulaar · Soninke · Wolof
        </p>
        <div className="stagger-2" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: "1rem", color: "var(--text-muted)", fontWeight: 500 }}>{rtl ? "بواسطة" : "by"}</span>
          <img src="/elson-logo.svg" alt="Elson" style={{ height: 44 }} />
        </div>

        <p className="stagger-3" style={{ fontSize: "1.05rem", color: "var(--text-secondary)", maxWidth: 540, lineHeight: 1.75, marginBottom: 48 }}>
          {t("landing.description")}
        </p>

        {/* ════ GRAND COUNTDOWN / LAUNCHED CTA ════ */}
        <div className="stagger-4" style={{ marginBottom: 32, width: "100%", maxWidth: 640 }}>
          {launched ? (
            /* Countdown finished → big, warm "it's never too late" call to action */
            <div className="fade-in" style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 20px", borderRadius: 100, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.18)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--primary-light)", marginBottom: 22 }}>
                <Sparkles size={13} /> {t("countdown.liveBadge")}
              </div>
              <h2 style={{
                fontSize: "clamp(2rem, 5.5vw, 3.4rem)",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: rtl ? "normal" : "-0.04em",
                marginBottom: 18,
                background: "var(--gradient-brand)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {t("countdown.launchedTitle")}
              </h2>
              <p style={{ fontSize: "1.05rem", color: "var(--text-secondary)", lineHeight: 1.75, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
                {t("countdown.launchedSubtitle")}
              </p>

              {/* ════ DEADLINE — competition closes ════ */}
              <div style={{ marginTop: 40 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "7px 18px", borderRadius: 100, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.22)" }}>
                  <Clock size={14} color="var(--accent)" />
                  <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)" }}>
                    {t("countdown.closesLabel")} · {t("countdown.closesDate")}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, direction: "ltr" }}>
                  <CountdownBox value={endCountdown.days} label={t("countdown.days")} />
                  <div style={{ fontSize: "2rem", fontWeight: 300, color: "var(--text-muted)", paddingTop: 16 }}>:</div>
                  <CountdownBox value={endCountdown.hours} label={t("countdown.hours")} />
                  <div style={{ fontSize: "2rem", fontWeight: 300, color: "var(--text-muted)", paddingTop: 16 }}>:</div>
                  <CountdownBox value={endCountdown.minutes} label={t("countdown.minutes")} />
                  <div style={{ fontSize: "2rem", fontWeight: 300, color: "var(--text-muted)", paddingTop: 16 }}>:</div>
                  <CountdownBox value={endCountdown.seconds} label={t("countdown.seconds")} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 24 }}>
                <Clock size={16} color="var(--accent)" />
                <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--accent)" }}>
                  {t("countdown.title")}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 12, direction: "ltr" }}>
                <CountdownBox value={countdown.days} label={t("countdown.days")} />
                <div style={{ fontSize: "2rem", fontWeight: 300, color: "var(--text-muted)", paddingTop: 16 }}>:</div>
                <CountdownBox value={countdown.hours} label={t("countdown.hours")} />
                <div style={{ fontSize: "2rem", fontWeight: 300, color: "var(--text-muted)", paddingTop: 16 }}>:</div>
                <CountdownBox value={countdown.minutes} label={t("countdown.minutes")} />
                <div style={{ fontSize: "2rem", fontWeight: 300, color: "var(--text-muted)", paddingTop: 16 }}>:</div>
                <CountdownBox value={countdown.seconds} label={t("countdown.seconds")} />
              </div>

              {/* Extension / sharing notice — competition prolonged to reach more people (pre-launch only) */}
              <p style={{
                marginTop: 24,
                maxWidth: 560,
                marginLeft: "auto",
                marginRight: "auto",
                padding: "14px 20px",
                borderRadius: 14,
                background: "rgba(217, 119, 6, 0.06)",
                border: "1px solid rgba(217, 119, 6, 0.16)",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                lineHeight: 1.65,
                textAlign: "center",
              }}>
                {t("countdown.extendedNotice")}
              </p>
            </>
          )}
          <p style={{
            marginTop: launched ? 28 : 12,
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--accent)",
            textAlign: "center",
          }}>
            {t("countdown.shareMax")}
          </p>
          <p style={{
            marginTop: 16,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
            padding: "12px 18px",
            borderRadius: 12,
            background: "rgba(99, 102, 241, 0.05)",
            border: "1px solid rgba(99, 102, 241, 0.16)",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            lineHeight: 1.6,
            textAlign: "center",
          }}>
            {t("countdown.qualityNotice")}
          </p>
          <p style={{
            marginTop: 12,
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            textAlign: "center",
          }}>
            {t("countdown.support")}{" "}
            <a
              href="https://wa.me/13138047312"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", textDecoration: "none" }}
            >
              +1&nbsp;313&nbsp;804&nbsp;7312
            </a>
          </p>
        </div>

        {/* ════ LIVE COUNTER ════ */}
        <div style={{ marginBottom: 56, display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", flexDirection: rtl ? "row-reverse" : "row" }}>
          <div className="gradient-card" style={{ padding: "20px 36px", textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.03em" }}>
              {stats?.total_users ?? "—"}
            </div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginTop: 4 }}>{t("countdown.registered")}</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 100, flexDirection: rtl ? "row-reverse" : "row" }}>
          <Link href="/login" className="btn-primary" style={{ fontSize: "1rem", padding: "18px 44px" }}>
            {t("landing.cta")} {rtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
          </Link>
          <Link href="/leaderboard" className="btn-secondary" style={{ fontSize: "1rem", padding: "18px 40px" }}>
            {t("landing.leaderboard")}
          </Link>
        </div>

        {/* ════ WINNERS / CHAMPIONS ════ */}
        <div style={{ maxWidth: 940, width: "100%", marginBottom: 100, position: "relative" }}>
          <div className="glow-orb" style={{ width: 540, height: 340, background: "rgba(253, 224, 71, 0.06)", top: "-8%", left: "50%", transform: "translateX(-50%)" }} />

          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 14 }}>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, rgba(253,224,71,0.35))" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "#fbbf24", display: "inline-flex", alignItems: "center", gap: 8 }}><Trophy size={14} /> {t("landing.winnersTitle")}</span>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, rgba(253,224,71,0.35), transparent)" }} />
          </div>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: 42, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>{t("landing.winnersSubtitle")} 🎉</p>

          {/* CHAMPION — 1st */}
          <div className="champion-sheen" style={{ position: "relative", maxWidth: 560, margin: "0 auto 20px", padding: "36px 32px 32px", borderRadius: 26, textAlign: "center", background: "linear-gradient(180deg, rgba(253,224,71,0.10), rgba(3,15,10,0.45))", border: "1px solid rgba(253,224,71,0.35)", boxShadow: "0 24px 70px -22px rgba(253,224,71,0.30)", animation: "borderGlow 3.5s ease-in-out infinite" }}>
            <div className="float-medal" style={{ fontSize: "3.4rem", lineHeight: 1, marginBottom: 8 }}><span className="crown-glow" style={{ display: "inline-block" }}>👑</span></div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 16px", borderRadius: 100, background: "rgba(253,224,71,0.12)", border: "1px solid rgba(253,224,71,0.3)", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.16em", color: "#fde68a", marginBottom: 18 }}><Sparkles size={12} /> {t("landing.grandPrize")} · {t("landing.1st")}</div>
            <div style={{ fontSize: "clamp(1.7rem, 4.6vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.12, marginBottom: 6, background: "linear-gradient(180deg, #fffbeb 0%, #fbbf24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Jemila Mohamed Salem</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 22 }}>@Jami</div>
            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", padding: "15px 40px", borderRadius: 18, background: "rgba(253,224,71,0.06)", border: "1px solid rgba(253,224,71,0.16)" }}>
              <div style={{ fontSize: "clamp(2.4rem, 6.2vw, 3.2rem)", fontWeight: 800, color: "#fde68a", letterSpacing: "-0.04em", lineHeight: 1, direction: "ltr" }}>600&thinsp;000</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.16em", color: "#fbbf24", marginTop: 7 }}>MRU</div>
            </div>
          </div>

          {/* 2nd & 3rd */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(258px, 1fr))", gap: 16, maxWidth: 560, margin: "0 auto" }}>
            {[
              { medal: "🥈", rank: t("landing.2nd"), account: "Sidialy", names: ["Mohamed Mahmoud Said", "Sidi Aly Med Lemin Sidi Oumar"], color: "#e2e8f0", ring: "rgba(226,232,240,0.26)", glow: "rgba(226,232,240,0.09)" },
              { medal: "🥉", rank: t("landing.3rd"), account: "Muhammed", names: ["Muhammed Moulay", "Mohamed Yenge"], color: "#f59e0b", ring: "rgba(251,146,60,0.28)", glow: "rgba(251,146,60,0.08)" },
            ].map((w, i) => (
              <div key={i} className="fade-in" style={{ padding: "26px 22px 24px", borderRadius: 20, textAlign: "center", background: `linear-gradient(180deg, ${w.glow}, rgba(3,15,10,0.35))`, border: `1px solid ${w.ring}`, animationDelay: `${0.2 + i * 0.12}s` }}>
                <div className="float-medal-slow" style={{ fontSize: "2.5rem", lineHeight: 1, marginBottom: 10 }}>{w.medal}</div>
                <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.16em", color: w.color, marginBottom: 14 }}>{w.rank}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {w.names.map((n, k) => (<div key={k} style={{ fontSize: "1.0rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25 }}>{n}</div>))}
                </div>
                <div style={{ display: "inline-block", fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600, padding: "4px 13px", borderRadius: 100, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>@{w.account}</div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 30, letterSpacing: "0.04em" }}>{t("landing.winnersThanks")}</p>
        </div>

        {/* Prize Pool */}
        <div style={{ maxWidth: 900, width: "100%", marginBottom: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 48 }}>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, rgba(217, 119, 6,0.3))" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--accent)" }}>{t("landing.prizeTitle")}</span>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, rgba(217, 119, 6,0.3), transparent)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              { label: t("landing.1st"), amount: config.prize_1st ? Number(config.prize_1st).toLocaleString() : "60,000", icon: "🥇", color: "#fde68a" },
              { label: t("landing.2nd"), amount: config.prize_2nd ? Number(config.prize_2nd).toLocaleString() : "30,000", icon: "🥈", color: "#e2e8f0" },
              { label: t("landing.3rd"), amount: config.prize_3rd ? Number(config.prize_3rd).toLocaleString() : "10,000", icon: "🥉", color: "#fbbf24" },
            ].map((p, i) => (
              <SpotlightCard key={i} style={{ padding: "44px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "2.8rem", marginBottom: 16 }}>{p.icon}</div>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: 12 }}>{p.label}</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, color: p.color, letterSpacing: "-0.04em", lineHeight: 1 }}>{p.amount}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, marginTop: 6 }}>MRU</div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ maxWidth: 900, width: "100%", marginBottom: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48, justifyContent: "center" }}>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3))" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--primary-light)" }}>{t("landing.howItWorks")}</span>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, rgba(99,102,241,0.3), transparent)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { icon: <Globe size={22} />, title: t("landing.step1Title"), desc: t("landing.step1Desc"), num: "01" },
              { icon: <PenLine size={22} />, title: t("landing.step2Title"), desc: t("landing.step2Desc"), num: "02" },
              { icon: <Mic size={22} />, title: t("landing.step3Title"), desc: t("landing.step3Desc"), num: "03" },
              { icon: <Trophy size={22} />, title: t("landing.step4Title"), desc: t("landing.step4Desc"), num: "04" },
            ].map((step, i) => (
              <SpotlightCard key={i} style={{ padding: 28, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.1)", color: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>{step.icon}</div>
                  <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "rgba(16, 185, 129, 0.25)" }}>{step.num}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 8, color: "var(--text-primary)" }}>{step.title}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>{step.desc}</div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* ════ SEASON 0 — PRE-LAUNCH CONTRIBUTORS (transparency) ════ */}
        {season0.length > 0 && (
          <div style={{ maxWidth: 720, width: "100%", marginBottom: 100, textAlign: rtl ? "right" : "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 24 }}>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, rgba(217, 119, 6,0.3))" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 8 }}><Star size={14} /> {t("season0.title")}</span>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, rgba(217, 119, 6,0.3), transparent)" }} />
            </div>

            <div style={{
              background: "rgba(217, 119, 6, 0.05)",
              border: "1px solid rgba(217, 119, 6, 0.16)",
              borderRadius: 18,
              padding: "28px 26px",
            }}>
              <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 22, textAlign: "center" }}>
                {t("season0.message")}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {season0.map((u, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    direction: rtl ? "rtl" : "ltr",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span style={{
                        flexShrink: 0,
                        width: 26, height: 26, borderRadius: 8,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.75rem", fontWeight: 800,
                        background: "rgba(217, 119, 6, 0.12)", color: "var(--accent)",
                      }}>{i + 1}</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username}</span>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      {Number(u.contributions).toLocaleString()} {t("season0.contribLabel")}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: 22, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.7, textAlign: "center" }}>
                {t("season0.footer")}
              </p>
            </div>
          </div>
        )}

        {/* ════ FAQ ════ */}
        <div id="faq" style={{ maxWidth: 720, width: "100%", marginBottom: 100, scrollMarginTop: 90 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 40 }}>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, rgba(16, 185, 129,0.3))" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--primary-light)", display: "inline-flex", alignItems: "center", gap: 8 }}><HelpCircle size={14} /> {t("faq.title")}</span>
            <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, rgba(16, 185, 129,0.3), transparent)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: rtl ? "right" : "left" }}>
            {FAQ_ITEMS.map((key, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={key} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                  <button onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "inherit", color: "var(--text-primary)", fontSize: "0.98rem", fontWeight: 600, lineHeight: 1.4 }}>
                    <span>{t(`faq.${key}.q`)}</span>
                    <ChevronDown size={18} style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none", color: "var(--primary-light)" }} />
                  </button>
                  {isOpen && (
                    <div className="fade-in" style={{ padding: "0 20px 20px", color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.75 }}>
                      {t(`faq.${key}.a`)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Final CTA */}
        <div className="gradient-card" style={{ maxWidth: 560, width: "100%", padding: "56px 40px", textAlign: "center", marginBottom: 60, position: "relative" }}>
          <Zap size={28} color="var(--primary-light)" style={{ margin: "0 auto 20px", opacity: 0.8 }} />
          <h3 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 12 }}>{t("landing.ctaTitle")}</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.7, fontSize: "0.95rem" }}>{t("landing.ctaDesc")}</p>
          <Link href="/login" className="btn-primary" style={{ fontSize: "1rem", padding: "18px 48px" }}>
            {t("landing.ctaBtn")} {rtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
          </Link>
        </div>

        {/* Partner logos section */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
          <img src="/adst-logo.svg" alt="ADST" style={{ height: 140, maxWidth: "40vw", objectFit: "contain", filter: "brightness(0)" }} />
          <span style={{ fontSize: "2rem", color: "var(--text-muted)", fontWeight: 300 }}>&times;</span>
          <img src="/rim-ai-logo.png" alt="RIM AI" style={{ height: 140, maxWidth: "40vw", objectFit: "contain" }} />
        </div>
      </main>

      <footer style={{ padding: "24px 24px 20px", color: "var(--text-muted)", fontSize: "0.75rem", borderTop: "1px solid var(--border)", textAlign: "center", position: "relative", zIndex: 1 }}>
        <p style={{ fontSize: "0.85rem", marginBottom: 4 }}>{t("landing.footer")}</p>
        <p style={{ fontSize: "0.8rem", marginBottom: 12, color: "var(--text-secondary)" }}>Hassaniya · Pulaar · Soninke · Wolof</p>
        <p style={{ fontSize: "0.7rem", maxWidth: 600, margin: "0 auto 12px", lineHeight: 1.5 }}>{t("landing.footerDataset")}</p>
        <p style={{ fontSize: "0.8rem", marginBottom: 12 }}>
          <a href="#faq" style={{ color: "var(--primary-light)", textDecoration: "none", fontWeight: 600 }}>{t("faq.title")}</a>
        </p>
        <p style={{ fontSize: "0.7rem" }}>2026 &copy; ADST & RIM AI</p>
      </footer>
    </div>
  );
}
