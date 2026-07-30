"use client";

import { useEffect, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BottomNav, TopBar } from "@/components/Navigation";
import { Trophy, Medal, Flag, PenLine, Mic, CheckCircle, Pause, Info, Users, Gift, Hourglass } from "lucide-react";
import { isLoggedIn, tryRestoreSession, getLeaderboard, getAmbassadorsLeaderboard } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
import type { LeaderboardEntry, AmbassadorEntry, CreditRule, FlashTournament } from "@/lib/api";

// Active-time formatting for the transparency chips: 1h54 / 47min.
const fmtCredit = (s: number) => {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
};
const nkcTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
import { useI18n } from "@/lib/i18n-context";
import { CompetitionGate, isGateCode } from "@/components/CompetitionGate";

export default function LeaderboardPage() {
  const router = useRouter();
  const { t, rtl } = useI18n();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gateCode, setGateCode] = useState<string | null>(null);
  const [gateStartsAt, setGateStartsAt] = useState<string | null>(null);
  const [validationPaused, setValidationPaused] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [tab, setTab] = useState<"contrib" | "amb">("contrib");
  const [ambEntries, setAmbEntries] = useState<AmbassadorEntry[]>([]);
  const [ambLoaded, setAmbLoaded] = useState(false);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [creditRule, setCreditRule] = useState<CreditRule | null>(null);
  const [flashTournament, setFlashTournament] = useState<FlashTournament | null>(null);

  useEffect(() => {
    if (tab === "amb" && !ambLoaded) {
      getAmbassadorsLeaderboard().then(({ data }) => { setAmbEntries(data?.entries ?? []); setAmbLoaded(true); });
    }
  }, [tab, ambLoaded]);

  useEffect(() => {
    const loadState = () => fetch(`${API_URL}/api/public/stats`).then(r => r.json()).then(d => {
      const vPaused = !!(d.validationPaused ?? d.paused);
      setValidationPaused(vPaused);
    }).catch(() => {});
    loadState();
    const id = setInterval(loadState, 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.replace("/login"); return; }
      }
      getLeaderboard().then(({ data, code, meta }) => {
        if (isGateCode(code ?? null)) {
          setGateCode(code ?? null);
          setGateStartsAt(meta?.startsAt ?? meta?.activateAt ?? null);
        } else {
          setEntries(data?.entries ?? []);
          setReferralEnabled(data?.referralEnabled !== false);
          setCreditRule(data?.creditRule ?? null);
          setFlashTournament(data?.flashTournament ?? null);
        }
        setLoading(false);
      });
    }
    init();
  }, []);

  const getRankStyle = (i: number) => {
    if (i === 0) return { bg: "rgba(217, 119, 6,0.08)", border: "rgba(217, 119, 6,0.15)", color: "#fde68a", icon: <Trophy size={20} color="#fbbf24" /> };
    if (i === 1) return { bg: "rgba(226,232,240,0.05)", border: "rgba(226,232,240,0.1)", color: "#e2e8f0", icon: <Medal size={20} color="#e2e8f0" /> };
    if (i === 2) return { bg: "rgba(217,119,6,0.06)", border: "rgba(217,119,6,0.1)", color: "#fbbf24", icon: <Medal size={20} color="#d97706" /> };
    return { bg: "var(--surface-1)", border: "var(--border)", color: "var(--text-muted)", icon: <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-muted)" }}>{i + 1}</span> };
  };

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 16px)",  }}>
      <TopBar />
      <BottomNav />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Trophy size={20} color="var(--accent)" />
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{t("nav.leaderboard")}</h2>
          <button onClick={() => setShowInfo(true)} aria-label={t("leaderboard.bdTitle")} title={t("leaderboard.bdTitle")}
            style={{ marginInlineStart: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--primary-light)", display: "flex", padding: 4 }}>
            <Info size={18} />
          </button>
        </div>

        {/* Tabs: Contributors (pure work) vs Ambassadors (referral) — kept apart.
            Hidden entirely when the admin turned the referral system off. */}
        {referralEnabled && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {([["contrib", Trophy, t("leaderboard.tabContributors")], ["amb", Users, t("leaderboard.tabAmbassadors")]] as const).map(([key, Icon, label]) => {
              const on = tab === key;
              return (
                <button key={key} onClick={() => setTab(key as "contrib" | "amb")} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px",
                  borderRadius: 12, fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
                  background: on ? "var(--accent-green-soft)" : "var(--surface-1)",
                  color: on ? "var(--accent-green)" : "var(--text-muted)",
                  border: `1.5px solid ${on ? "var(--accent-green)" : "var(--border)"}`,
                }}><Icon size={15} /> {label}</button>
              );
            })}
          </div>
        )}

        {showInfo && (
          <div onClick={() => setShowInfo(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div dir={rtl ? "rtl" : "ltr"} onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: 18, padding: 20, maxWidth: 420, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.55)", textAlign: rtl ? "right" : "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Info size={20} color="var(--primary-light)" />
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("leaderboard.bdTitle")}</h3>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-line" }}>{t("leaderboard.bdInfo")}</div>
              <button onClick={() => setShowInfo(false)} className="btn-primary" style={{ marginTop: 16, width: "100%", padding: "11px", borderRadius: 100, fontWeight: 700 }}>{t("eval.gotIt")}</button>
            </div>
          </div>
        )}

        {validationPaused ? (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", marginBottom: 18, borderRadius: 14, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.28)" }}>
            <Pause size={20} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 3 }}>{t("leaderboard.pausedTitle")}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{t("leaderboard.pausedBody")}</div>
            </div>
          </div>
        ) : null}

        {flashTournament && tab === "contrib" && <FlashTournamentCard tournament={flashTournament} />}

        {tab === "amb" ? (
          <AmbassadorsList entries={ambEntries} loaded={ambLoaded} t={t} rtl={rtl} getRankStyle={getRankStyle} />
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>{t("common.loading")}</div>
        ) : gateCode ? (
          <CompetitionGate code={gateCode} startsAt={gateStartsAt} />
        ) : entries.length === 0 ? (
          <div className="fade-in" style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(99,102,241,0.08)", color: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Flag size={28} />
            </div>
            <h3 style={{ fontSize: "1.2rem", marginBottom: 8, fontWeight: 700 }}>{t("leaderboard.noParticipants")}</h3>
            <Link href="/login" className="btn-primary" style={{ marginTop: 20, padding: "12px 28px", borderRadius: 100 }}>{t("leaderboard.register")}</Link>
          </div>
        ) : (
          <div className="fade-in">
            {/* HYBRID transparency banner: the time rule, public for everyone */}
            {creditRule && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, padding: "11px 14px", borderRadius: 14, background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)" }}>
                <Hourglass size={16} style={{ color: "var(--accent-green)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <b style={{ color: "var(--text-primary)" }}>Fenêtre en cours : budget {fmtCredit(creditRule.budgetSeconds)} — égal pour tous</b> · jusqu'à {nkcTime(creditRule.endsAt)} (Nouakchott).
                  Le ⏱ sur chaque ligne montre le temps actif consommé : personne ne peut avoir plus de temps que les autres.
                </div>
              </div>
            )}
            {entries.map((entry, i) => {
              const rs = getRankStyle(i);
              return <LeaderRow key={entry.code} entry={entry} rs={rs} t={t} rtl={rtl} showHint={i === 0} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── One leaderboard row: card + self-explaining breakdown ──
// Each number (counts + breakdown pills) is hover/tap-able. Activating one shows
// a single explanation line below the pills (works on mobile where hover doesn't).
function FlashTournamentCard({ tournament }: { tournament: FlashTournament }) {
  const startsAt = tournament.startsAt || tournament.starts_at || "";
  const endsAt = tournament.endsAt || tournament.ends_at || "";
  const target = tournament.targetContributions || tournament.target_contributions || 0;
  const winners = tournament.winnerCount || tournament.winner_count || 0;
  const prize = tournament.prizeText || tournament.prize_text || "";
  const entries = tournament.entries || [];
  const ambassadorEnabled = tournament.ambassadorEnabled ?? tournament.ambassador_enabled ?? false;
  const ambassadorTarget = tournament.ambassadorTargetContributions ?? tournament.ambassador_target_contributions ?? 10;
  const ambassadorWinners = tournament.ambassadorWinnerCount ?? tournament.ambassador_winner_count ?? 5;
  const ambassadorPrize = tournament.ambassadorPrizeText ?? tournament.ambassador_prize_text ?? "";
  const ambassadorEntries = tournament.ambassadorEntries || [];
  const startMs = startsAt ? new Date(startsAt).getTime() : 0;
  const endMs = endsAt ? new Date(endsAt).getTime() : 0;
  const timeLabel = startMs && endMs ? `${nkcTime(startsAt)} → ${nkcTime(endsAt)} NKC` : "Fenêtre active";
  const activity = tournament.activity || "contribute";
  const actionNoun = activity === "validate" ? "évaluations" : activity === "both" ? "actions (contributions + évaluations)" : "contributions";

  return (
    <div style={{ marginBottom: 16, padding: "15px", borderRadius: 18, background: "linear-gradient(135deg, rgba(8,221,184,0.16), rgba(217,119,6,0.10))", border: "1.5px solid rgba(8,221,184,0.45)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <Trophy size={22} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--text-primary)", lineHeight: 1.25 }}>{tournament.title}</div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 3 }}>
            Les {winners} premiers qui atteignent {target} {actionNoun} dans cette fenêtre entrent dans les prix. Le score officiel reste séparé.
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", borderRadius: 100, background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--accent-green)", fontSize: "0.68rem", fontWeight: 900 }}>
          <Hourglass size={12} /> {timeLabel}
        </div>
      </div>

      {prize && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "9px 11px", borderRadius: 12, background: "var(--surface-1)", border: "1px solid var(--border)", marginBottom: 10 }}>
          <Gift size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>{prize}</div>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", textAlign: "center", padding: "7px 0" }}>
          Aucun score tournoi pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {entries.slice(0, Math.min(8, entries.length)).map((e) => {
            // Option B: rank and display the RAW submitted count (tournament metric).
            const submitted = e.tournamentContributions;
            const approved = e.approvedContributions ?? 0;
            const pct = target ? Math.min(100, Math.round((submitted / target) * 100)) : 0;
            return (
              <div key={e.code} style={{ padding: "8px 10px", borderRadius: 12, background: "var(--surface-1)", border: `1px solid ${e.prizeEligible ? "var(--accent-green)" : "var(--border)"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 24, fontWeight: 900, fontSize: "0.78rem", color: e.prizeEligible ? "var(--accent-green)" : "var(--text-muted)" }}>#{e.rank}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, monospace", fontSize: "0.78rem", fontWeight: 900, color: e.isMe ? "var(--accent-green)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.code}</span>
                  <span title="Soumises / objectif (· validées)" style={{ fontSize: "0.76rem", fontWeight: 900, color: "var(--text-primary)" }}>{submitted}/{target}{approved > 0 ? <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)" }}> · {approved} validées</span> : null}</span>
                  <span title="Score officiel au lancement" style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 800 }}>base {e.officialPointsAtStart}</span>
                </div>
                <div style={{ height: 5, marginTop: 7, borderRadius: 999, background: "rgba(148,163,184,0.18)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: e.prizeEligible ? "var(--accent-green)" : "#d97706" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ambassadorEnabled && (
        <div style={{ marginTop: 12, padding: "11px", borderRadius: 14, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.24)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <Users size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--text-primary)" }}>Bonus ambassadeur flash</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                Top {ambassadorWinners} parrains. Un filleul compte quand il atteint {ambassadorTarget} contributions approuvees pendant ce tournoi. Ce bonus ne change pas le classement principal.
              </div>
            </div>
          </div>
          {ambassadorPrize && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", padding: "7px 9px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--border)", marginBottom: 8 }}>
              {ambassadorPrize}
            </div>
          )}
          {ambassadorEntries.length === 0 ? (
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", padding: "5px 0" }}>Aucun ambassadeur qualifie pour l&apos;instant.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ambassadorEntries.slice(0, Math.min(5, ambassadorEntries.length)).map((e) => (
                <div key={e.code ?? e.rank} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 11, background: "var(--surface-1)", border: `1px solid ${e.prizeEligible ? "#d97706" : "var(--border)"}` }}>
                  <span style={{ width: 22, fontSize: "0.74rem", fontWeight: 900, color: e.prizeEligible ? "#d97706" : "var(--text-muted)" }}>#{e.rank}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, monospace", fontSize: "0.74rem", fontWeight: 900, color: e.isMe ? "var(--accent-green)" : "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.code}</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 900, color: "var(--text-primary)" }}>{e.qualifiedReferees ?? e.qualified_referees ?? 0} filleul(s)</span>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{e.refereeContributions ?? e.referee_contributions ?? 0} appr.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderRow({ entry, rs, t, rtl, showHint }: {
  entry: LeaderboardEntry;
  rs: { bg: string; border: string; color: string; icon: ReactNode };
  t: (k: string) => string;
  rtl: boolean;
  showHint: boolean;
}) {
  const [tip, setTip] = useState<string | null>(null);

  const hasCredit = entry.credit_budget_seconds != null;
  const tipText: Record<string, string> = {
    cc: t("leaderboard.tipCountContrib"),
    cr: t("leaderboard.tipCountRec"),
    cv: t("leaderboard.tipCountVal"),
    contrib: t("leaderboard.tipContrib"),
    eval: t("leaderboard.tipEval"),
    credit: hasCredit
      ? `Fenêtre en cours : ${fmtCredit(entry.credit_window_seconds ?? 0)} consommées sur un budget de ${fmtCredit(entry.credit_budget_seconds ?? 0)}. Depuis le début : ${fmtCredit(entry.credit_total_seconds ?? 0)} consommées sur ${fmtCredit(entry.credit_offered_seconds ?? 0)} de crédit total reçu — si quelqu'un avait reçu plus de crédit que les autres, ça se verrait ici. Le temps ne s'écoule que hors des créneaux programmés.`
      : "",
  };

  // Handlers shared by every interactive number: hover (desktop) + tap (mobile).
  const th = (key: string) => ({
    onMouseEnter: () => setTip(key),
    onMouseLeave: () => setTip((p) => (p === key ? null : p)),
    onClick: (e: ReactMouseEvent) => { e.stopPropagation(); setTip((p) => (p === key ? null : key)); },
    style: { cursor: "help" as const },
  });

  const pill = (key: string, icon: ReactNode, val: ReactNode, c: string, bg: string) => (
    <span {...th(key)} style={{ ...th(key).style, display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.64rem", fontWeight: 700, padding: "4px 9px", borderRadius: 100, background: bg, color: c, lineHeight: 1, border: tip === key ? `1px solid ${c}` : "1px solid transparent" }}>
      {icon} {val}
    </span>
  );

  return (
    <div style={{
      marginBottom: 10, background: rs.bg, border: `1px solid ${rs.border}`,
      borderRadius: 18, overflow: "hidden", transition: "all 0.2s",
    }}>
      {/* Top row: rank · name+counts · points */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px 9px" }}>
        <div style={{ width: 34, display: "flex", justifyContent: "center", flexShrink: 0 }}>{rs.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
            <span style={{ fontWeight: 800, fontSize: "0.92rem", letterSpacing: "0.06em", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: entry.isMe ? "var(--accent-green)" : "var(--text-primary)", whiteSpace: "nowrap" }}>
              {entry.code}
            </span>
            {entry.isMe && (
              <span style={{ flexShrink: 0, fontSize: "0.56rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 100, background: "var(--accent-green)", color: "var(--on-primary)" }}>
                {t("leaderboard.you")}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: "0.64rem", color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>
            <span {...th("cc")} style={{ ...th("cc").style, display: "flex", alignItems: "center", gap: 3 }}><PenLine size={10} /> {entry.total_contributions.toLocaleString()}</span>
            <span {...th("cr")} style={{ ...th("cr").style, display: "flex", alignItems: "center", gap: 3 }}><Mic size={10} /> {entry.total_recordings.toLocaleString()}</span>
            <span {...th("cv")} style={{ ...th("cv").style, display: "flex", alignItems: "center", gap: 3 }}><CheckCircle size={10} /> {entry.total_validations.toLocaleString()}</span>
          </div>
        </div>
        <div {...th("total")} style={{ ...th("total").style, textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: rs.color, letterSpacing: "-0.02em", borderBottom: tip === "total" ? `2px solid ${rs.color}` : "2px solid transparent" }}>{entry.points.toLocaleString()}</div>
          <div style={{ fontSize: "0.52rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Lv{entry.level}</div>
        </div>
      </div>

      {/* Breakdown row: clean colored pills, full width */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 14px 10px 14px" }}>
        {pill("contrib", <PenLine size={11} />, (entry.contrib_pts ?? 0).toLocaleString(), "var(--primary-light)", "rgba(99,102,241,0.12)")}
        {pill("eval", <CheckCircle size={11} />, (entry.eval_pts ?? 0).toLocaleString(), "#d99e06", "rgba(251,191,36,0.14)")}
        {hasCredit && pill("credit", <Hourglass size={11} />,
          `${fmtCredit(entry.credit_window_seconds ?? 0)}/${fmtCredit(entry.credit_budget_seconds ?? 0)} · Σ ${fmtCredit(entry.credit_total_seconds ?? 0)}/${fmtCredit(entry.credit_offered_seconds ?? 0)}`,
          "#10b981", "rgba(16,185,129,0.12)")}
      </div>

      {/* Explanation line — appears under the pills when a number is hovered/tapped */}
      {tip === "total" ? (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: "8px 10px", direction: rtl ? "rtl" : "ltr" }}>
            {/* Dynamic equation: contribution + evaluation = total */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: "0.7rem", fontWeight: 800 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--primary-light)" }}><PenLine size={11} /> {(entry.contrib_pts ?? 0).toLocaleString()}</span>
              <span style={{ color: "var(--text-muted)" }}>+</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#d99e06" }}><CheckCircle size={11} /> {(entry.eval_pts ?? 0).toLocaleString()}</span>
              <span style={{ color: "var(--text-muted)" }}>=</span>
              <span style={{ color: rs.color }}>{entry.points.toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: "0.62rem", color: "var(--text-secondary)", lineHeight: 1.45, direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}>
              {t("leaderboard.tipTotalNote")}
            </div>
          </div>
        </div>
      ) : tip ? (
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)", lineHeight: 1.45, background: "var(--surface-2)", borderRadius: 9, padding: "7px 10px", direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}>
            {tipText[tip]}
          </div>
        </div>
      ) : showHint ? (
        <div style={{ padding: "0 14px 11px", fontSize: "0.58rem", color: "var(--text-muted)", opacity: 0.75, direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}>
          {t("leaderboard.tipHint")}
        </div>
      ) : null}
    </div>
  );
}

// ── Ambassadors league: ranked by referral (ambassador) points, kept separate
// from the main contribution leaderboard so the quality race stays clean. ──
function AmbassadorsList({ entries, loaded, t, rtl, getRankStyle }: {
  entries: AmbassadorEntry[];
  loaded: boolean;
  t: (k: string) => string;
  rtl: boolean;
  getRankStyle: (i: number) => { bg: string; border: string; color: string; icon: ReactNode };
}) {
  if (!loaded) return <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>{t("common.loading")}</div>;
  if (entries.length === 0) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-green-soft)", color: "var(--accent-green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Users size={28} />
        </div>
        <h3 style={{ fontSize: "1.1rem", marginBottom: 8, fontWeight: 700 }}>{t("referral.noAmbassadors")}</h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>{t("referral.ambassadorsHint")}</p>
      </div>
    );
  }
  return (
    <div className="fade-in" dir={rtl ? "rtl" : "ltr"}>
      {entries.map((e, i) => {
        const rs = getRankStyle(i);
        return (
          <div key={e.code} style={{ marginBottom: 10, background: rs.bg, border: `1px solid ${rs.border}`, borderRadius: 18, display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
            <div style={{ width: 34, display: "flex", justifyContent: "center", flexShrink: 0 }}>{rs.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontWeight: 800, fontSize: "0.92rem", letterSpacing: "0.06em", fontFamily: "ui-monospace, monospace", color: e.isMe ? "var(--accent-green)" : "var(--text-primary)", whiteSpace: "nowrap" }}>{e.code}</span>
                {e.isMe && <span style={{ fontSize: "0.56rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 100, background: "var(--accent-green)", color: "var(--on-primary)" }}>{t("leaderboard.you")}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.64rem", color: "var(--text-muted)", marginTop: 3 }}>
                <Users size={10} /> {e.referrals.toLocaleString()} {t("referral.refereesShort")}
              </div>
            </div>
            <div style={{ textAlign: "end", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "1.2rem", fontWeight: 900, color: rs.color }}><Gift size={15} color="var(--accent-green)" /> {e.ambassador_points.toLocaleString()}</div>
              <div style={{ fontSize: "0.52rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("referral.ambShort")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
