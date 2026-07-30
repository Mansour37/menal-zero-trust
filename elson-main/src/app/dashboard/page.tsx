"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav, TopBar } from "@/components/Navigation";
import { Star, Medal, Crown, Target, PenLine, Mic, CheckCircle, Flame, Trophy, Globe, Check } from "lucide-react";
import { getLevel, getNextLevel, getProgressToNextLevel, GAMIFICATION } from "@/lib/gamification";
import { isLoggedIn, tryRestoreSession, logout, getMyProfile, updateLang } from "@/lib/api";
import { ReferralPanel } from "@/components/ReferralPanel";
import { useI18n } from "@/lib/i18n-context";
import type { Locale } from "@/lib/i18n";

const LANG_OPTIONS: { code: Locale; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "Français", native: "Français" },
  { code: "ar", label: "العربية", native: "العربية" },
];

type Profile = { username: string; total_contributions: number; total_validations: number; total_recordings: number; points: number; level: number; streak_days: number; badges: string[] };

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLang, setSavingLang] = useState<Locale | null>(null);
  const { t, locale, setLocale } = useI18n();

  const handleLangChange = async (l: Locale) => {
    if (l === locale) return;
    setSavingLang(l);
    setLocale(l); // immediate UI update + localStorage
    await updateLang(l); // persist server-side
    setSavingLang(null);
  };

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.push("/login"); return; }
      }
      getMyProfile().then(({ data, error }) => { if (error) { router.push("/login"); return; } if (data) { setProfile(data.profile as Profile); setRank(data.rank); } setLoading(false); });
    }
    init();
  }, []);

  const handleLogout = async () => { await logout(); router.push("/"); };
  if (loading) return null;

  const level = profile ? getLevel(profile.points) : GAMIFICATION.levels[0];
  const nextLevel = profile ? getNextLevel(profile.points) : GAMIFICATION.levels[1];
  const progress = profile ? getProgressToNextLevel(profile.points) : 0;
  const levelIcon = level.level <= 1 ? <Target size={28} /> : level.level === 2 ? <Star size={28} /> : level.level === 3 ? <Medal size={28} /> : level.level === 4 ? <Trophy size={28} /> : <Crown size={28} />;

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 16px)" }}>
      <TopBar onLogout={handleLogout} />
      <BottomNav />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px" }}>
        {profile && (
          <div className="fade-in">

            {/* ── Profile hero ── */}
            <div style={{ background: "var(--gradient-surface)", border: "1px solid var(--border-brand)", borderRadius: 24, padding: "32px 24px", textAlign: "center", marginBottom: 16, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)" }} />

              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)", color: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                {levelIcon}
              </div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 4 }}>{profile.username}</h2>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 16 }}>
                Level {level.level} · {level.name}
              </div>

              <div style={{ fontSize: "2.8rem", fontWeight: 800, background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.04em", lineHeight: 1 }}>
                {profile.points.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>{t("dashboard.points")}</div>

              {rank && <div style={{ marginTop: 12, fontSize: "0.8rem", color: "var(--text-muted)" }}>{t("dashboard.rank")} <span style={{ color: "var(--accent)", fontWeight: 700 }}>#{rank}</span></div>}

              {nextLevel && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: 6, fontWeight: 600 }}>
                    <span style={{ color: "var(--text-muted)" }}>Level {nextLevel.level}: {nextLevel.name}</span>
                    <span style={{ color: "var(--primary)" }}>{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>{(nextLevel.minPoints - profile.points).toLocaleString()} {t("dashboard.remaining")}</div>
                </div>
              )}
            </div>

            {/* ── Stats grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { value: profile.total_contributions, label: t("dashboard.translations"), icon: <PenLine size={18} />, color: "var(--primary)" },
                { value: profile.total_recordings, label: t("dashboard.audio"), icon: <Mic size={18} />, color: "#34d399" },
                { value: profile.total_validations, label: t("dashboard.validations"), icon: <CheckCircle size={18} />, color: "#fbbf24" },
                { value: profile.streak_days, label: t("dashboard.streak"), icon: <Flame size={18} />, color: profile.streak_days > 0 ? "#f97316" : "var(--text-muted)" },
              ].map((s, i) => (
                <div key={i} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 16px", textAlign: "center" }}>
                  <div style={{ color: s.color, marginBottom: 8, opacity: 0.7 }}>{s.icon}</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{s.value}</div>
                  <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Badges ── */}
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 12 }}>{t("dashboard.badges")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {GAMIFICATION.badges.map((badge) => {
                  const earned = badge.id.includes("contribution") ? profile.total_contributions >= badge.requirement
                    : badge.id.includes("recording") ? profile.total_recordings >= badge.requirement
                    : badge.id.includes("validation") ? profile.total_validations >= badge.requirement
                    : badge.id.includes("streak") ? profile.streak_days >= badge.requirement : false;
                  return (
                    <div key={badge.id} style={{
                      padding: "6px 14px", borderRadius: 100, fontSize: "0.75rem", fontWeight: 600,
                      background: earned ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${earned ? "rgba(99,102,241,0.2)" : "var(--border)"}`,
                      color: earned ? "var(--primary-light)" : "var(--text-muted)",
                      opacity: earned ? 1 : 0.4,
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {earned && <Star size={11} fill="currentColor" />} {badge.name}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Mes parrainages ── */}
            <ReferralPanel />

            {/* ── Préférences ── */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px", marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Globe size={14} color="var(--primary)" />
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)" }}>{t("dashboard.preferences")}</span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 12 }}>{t("dashboard.languageHint")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {LANG_OPTIONS.map((opt) => {
                  const active = locale === opt.code;
                  const saving = savingLang === opt.code;
                  return (
                    <button
                      key={opt.code}
                      onClick={() => handleLangChange(opt.code)}
                      disabled={saving || savingLang !== null}
                      style={{
                        padding: "12px 8px",
                        borderRadius: 12,
                        border: active ? "2px solid var(--accent-green)" : "1px solid var(--border)",
                        background: active ? "var(--accent-green-soft)" : "var(--surface-2)",
                        color: active ? "var(--accent-green)" : "var(--text-primary)",
                        fontWeight: active ? 700 : 500,
                        fontSize: "0.85rem",
                        cursor: saving ? "wait" : "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.15s ease",
                        opacity: savingLang !== null && !saving ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", opacity: 0.7 }}>{opt.code.toUpperCase()}</span>
                      <span dir={opt.code === "ar" ? "rtl" : "ltr"}>{opt.native}</span>
                      {active && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
