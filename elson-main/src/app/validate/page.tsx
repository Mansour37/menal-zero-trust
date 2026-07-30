"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BottomNav, TopBar } from "@/components/Navigation";
import { Check, X, Star, Loader2, Sparkles, AlertCircle, CheckCircle, Mic, PenLine, Globe, ThumbsUp, Shield, Info } from "lucide-react";
import { isLoggedIn, tryRestoreSession, logout, getNextContribution, submitValidation, updateValidateLangs, apiFetch, getMyProfile, adminUsersList } from "@/lib/api";
import { MyStats, refreshMyStats } from "@/components/MyStats";
import { CREDIT_EXHAUSTED_EVENT } from "@/components/CreditMeter";
import { CompetitionTimer } from "@/components/CompetitionTimer";
import { WaveformAudio } from "@/components/WaveformAudio";
import { CorrectionPanel } from "@/components/CorrectionPanel";
import type { ContributionToValidate } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";
import { CompetitionGate, isGateCode } from "@/components/CompetitionGate";
import { PauseScreen } from "@/components/PauseScreen";

// Benign race conditions on submit/vote → auto-advance to the next item instead of
// showing a blocking error (another evaluator finished it first, or it vanished).
const AUTO_SKIP = new Set(["ALREADY_DECIDED", "ALREADY_VALIDATED", "CONTRIBUTION_GONE", "ALREADY_VOTED", "VOTE_INVALID"]);

// "No evaluation is ever lost": a flaky connection must never surface as an error or
// drop a rating. We retry ONLY transient failures — a network error / 5xx returns an
// `error` with NO `code` (apiFetch). Benign races (AUTO_SKIP) and real coded errors
// are returned immediately for the caller to handle; the rating stays in state until
// the call genuinely succeeds.
async function submitWithRetry<T extends { error: string | null; code?: string }>(
  fn: () => Promise<T>, attempts = 4,
): Promise<T> {
  let res = await fn();
  for (let i = 1; i < attempts; i++) {
    if (!res.error) return res;                       // success
    if (AUTO_SKIP.has(res.code ?? "")) return res;    // benign race — let caller advance
    if (res.code) return res;                         // real, structured error — don't retry
    await new Promise((r) => setTimeout(r, i === 1 ? 1200 : i === 2 ? 3000 : 6000));
    res = await fn();                                 // transient (no code) → retry
  }
  return res;
}

export default function ValidatePage() {
  const router = useRouter();
  const { t, rtl } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [showHow, setShowHow] = useState(false);
  // Shared
  const [mode, setMode] = useState<"evaluate" | "vote" | "done" | "paused" | "locked" | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [validateLangs, setValidateLangs] = useState<string[]>([]);
  // Evaluate mode
  const [contribution, setContribution] = useState<ContributionToValidate | null>(null);
  const [textRating, setTextRating] = useState(0);
  const [audioRating, setAudioRating] = useState(0);
  const [showCorrect, setShowCorrect] = useState(false);
  const [audioListened, setAudioListened] = useState(false); // must fully play the audio before rating
  // Vote mode
  const [votePhrase, setVotePhrase] = useState<any>(null);
  const [voteContributions, setVoteContributions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [gateCode, setGateCode] = useState<string | null>(null);
  const [gateStartsAt, setGateStartsAt] = useState<string | null>(null);
  // Admin-only: review a specific user's phrases instead of the algorithm
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<{ id: string; username: string }[]>([]);
  const [targetUser, setTargetUser] = useState("");

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.push("/login"); return; }
      }
      setAuthed(true);
      // Detect admin → load the user list for the review picker
      getMyProfile().then(({ data }) => {
        if (data?.profile?.role === "admin") {
          setIsAdmin(true);
          adminUsersList().then(({ data: u }) => setAdminUsers(u?.items ?? []));
        }
      }).catch(() => {});
    }
    init();
  }, []);

  const loadNext = async () => {
    setLoading(true); setTextRating(0); setAudioRating(0); setAudioListened(false); setSelectedId(null); setShowCorrect(false);
    setGateCode(null); setGateStartsAt(null);
    const { data, error, code, meta } = await getNextContribution(isAdmin && targetUser ? targetUser : undefined);
    if (code === "EMAIL_NOT_VERIFIED") { router.push("/verify-email"); return; }
    if (isGateCode(code ?? null)) {
      setGateCode(code ?? null);
      setGateStartsAt(meta?.startsAt ?? meta?.activateAt ?? null);
      setLoading(false);
      return;
    }
    if (code === "PAUSED" || code === "CLOSED" || code === "LANG_CLOSED" || code === "CREDIT_EXHAUSTED" || code === "CREDIT_PAUSED" || code === "CREDIT_BLOCKED") {
      setPausedUntil(meta?.until ?? null); setMode("paused"); setLoading(false); return;
    }
    if (code === "EVAL_LOCKED") {
      setMode("locked"); setLoading(false); return;
    }
    if (data?.validateLangs) setValidateLangs(data.validateLangs);

    if (error || !data) {
      setMode("done"); setLoading(false); return;
    }

    const d = data as any;
    if (d.mode === "evaluate" && d.contribution) {
      setMode("evaluate"); setContribution(d.contribution); setVotePhrase(null);
    } else if (d.mode === "vote" && d.phrase) {
      setMode("vote"); setContribution(null);
      setVotePhrase(d.phrase);
      setVoteContributions((d.contributions || []).sort(() => Math.random() - 0.5));
    } else {
      setMode("done"); setContribution(null); setVotePhrase(null);
    }
    setLoading(false);
  };

  useEffect(() => { if (authed) loadNext(); }, [authed, targetUser]);

  // Credit ran out (navbar meter) → refetch so the closed screen shows up.
  useEffect(() => {
    const onExhausted = () => { if (authed) loadNext(); };
    window.addEventListener(CREDIT_EXHAUSTED_EVENT, onExhausted);
    return () => window.removeEventListener(CREDIT_EXHAUSTED_EVENT, onExhausted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const toggleLang = async (lang: string) => {
    let newLangs = validateLangs.includes(lang)
      ? validateLangs.filter(l => l !== lang)
      : [...validateLangs, lang];
    if (newLangs.length === 0) return;
    const { data } = await updateValidateLangs(newLangs);
    if (data?.validateLangs) { setValidateLangs(data.validateLangs); loadNext(); }
  };

  // Evaluate submit
  const handleEvaluate = async (isValid: boolean) => {
    if (!contribution) return;
    // V35: a field excluded by admin is hidden & auto-passed — don't require/send it.
    const ex = (contribution as { eval_exclude?: string }).eval_exclude;
    const noText = ex === "text";
    const hasAudio = !!contribution.audio_url && ex !== "audio";
    // Anti-rush: can't approve OR reject before the audio has been fully listened to.
    if (hasAudio && !audioListened) { setToast({ msg: t("validate.listenToRate"), type: "error" }); setTimeout(() => setToast(null), 3000); return; }
    // Approve requires deliberate ratings. Reject = 0 to the whole translation
    // (min ratings), so it needs no stars — the backend also enforces this.
    if (isValid) {
      if (!noText && textRating === 0) return;
      if (hasAudio && audioRating === 0) return;
    }
    setSubmitting(true);
    const { data, error, code } = await submitWithRetry(() => submitValidation({
      contributionId: contribution.id,
      textAccuracy: noText ? 3 : (isValid ? textRating : 1),
      audioClarity: hasAudio ? (isValid ? audioRating : 1) : null,
      isValid,
    }));
    // Benign races (someone else finished it, or it vanished) → don't block the
    // evaluator with an error; just slide to the next item automatically.
    if (error && AUTO_SKIP.has(code ?? "")) {
      setToast({ msg: t("validate.alreadyDone"), type: "success" }); setTimeout(() => setToast(null), 1500); loadNext();
    } else if (error) { setToast({ msg: error, type: "error" }); }
    else {
      // Flash eval mode (B): 0 official points — the evaluation counts toward the flash tournament.
      const msg = data?.flash ? "🔥 +1 pour le tournoi flash !" : `+${data?.points ?? 3} ${t("validate.pts")}`;
      setToast({ msg, type: "success" }); setTimeout(() => setToast(null), 3000); refreshMyStats(); loadNext();
    }
    setSubmitting(false);
  };

  // Vote submit
  const handleVote = async () => {
    if (!votePhrase || !selectedId) return;
    setSubmitting(true);
    const { data, error, code } = await submitWithRetry(() => apiFetch<{ success: boolean; points: number }>("/api/validate/vote", {
      method: "POST", body: JSON.stringify({ phraseId: votePhrase.id, chosenContributionId: selectedId }),
    }));
    if (error && AUTO_SKIP.has(code ?? "")) {
      setToast({ msg: t("validate.alreadyDone"), type: "success" }); setTimeout(() => setToast(null), 1500); loadNext();
    } else if (error) { setToast({ msg: error, type: "error" }); }
    else { setToast({ msg: `+${data?.points ?? 2} ${t("validate.pts")}`, type: "success" }); setTimeout(() => setToast(null), 3000); refreshMyStats(); loadNext(); }
    setSubmitting(false);
  };

  const handleLogout = async () => { await logout(); router.push("/"); };
  if (!authed) return null;

  // V35: admin may exclude a field from evaluation (field-level). The excluded
  // field is hidden and not rated; the backend auto-passes it in the consensus.
  const excl = (contribution as { eval_exclude?: string } | null)?.eval_exclude;
  const noTextRating = excl === "text";
  const noAudioRating = excl === "audio";
  const showAudio = !!contribution?.audio_url && !noAudioRating;
  // Anti-rush: when there's audio, the evaluator must have listened to it fully.
  const mustListen = showAudio && !audioListened;
  const evalRatingsOk = !mustListen && (noTextRating || textRating > 0) && (!showAudio || audioRating > 0);

  const RatingBar = ({ value, onChange, label, color }: { value: number; onChange: (v: number) => void; label: string; color: string }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: value > 0 ? color : "var(--text-muted)" }}>{value > 0 ? `${value}/5` : "-"}</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => onChange(s)} style={{
            flex: 1, height: 44, borderRadius: 10, border: "none", cursor: "pointer",
            background: value >= s ? `${color}20` : "rgba(255,255,255,0.03)",
            borderWidth: 1, borderStyle: "solid",
            borderColor: value >= s ? `${color}40` : "var(--border)",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Star size={18} fill={value >= s ? color : "none"} color={value >= s ? color : "var(--text-muted)"} style={{ opacity: value >= s ? 1 : 0.3 }} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 16px)" }}>
      {showHow && (
        <div onClick={() => setShowHow(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div dir={rtl ? "rtl" : "ltr"} onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: 18, padding: 22, maxWidth: 470, width: "100%", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 12px 48px rgba(0,0,0,0.55)", textAlign: rtl ? "right" : "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Info size={20} color="var(--primary-light)" />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("eval.howTitle")}</h3>
            </div>
            <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 14 }}>{t("eval.howIntro")}</p>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{t(`eval.how${i}t`)}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>{t(`eval.how${i}b`)}</div>
              </div>
            ))}
            <div style={{ marginTop: 4, marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(99,102,241,0.07)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--primary-light)", marginBottom: 6 }}>{t("eval.calcTitle")}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <div>• {t("eval.calc1")}</div>
                <div>• {t("eval.calc2")}</div>
                <div>• {t("eval.calc3")}</div>
                <div style={{ textAlign: "center", fontWeight: 800, color: "var(--text-primary)", margin: "8px 0", fontSize: "0.86rem", letterSpacing: "0.02em" }}>{t("eval.calcScale")}</div>
                <div style={{ color: "var(--text-muted)" }}>{t("eval.calcNote")}</div>
              </div>
            </div>
            <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--success)", background: "rgba(16,185,129,0.08)", padding: "10px 12px", borderRadius: 10, lineHeight: 1.55, marginTop: 6 }}>{t("eval.howResult")}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,0.06)", border: "1px solid var(--border)" }}>{t("eval.manualReview")}</div>
            <button onClick={() => setShowHow(false)} className="btn-primary" style={{ marginTop: 16, width: "100%", padding: "11px", borderRadius: 100, fontWeight: 700 }}>{t("eval.gotIt")}</button>
          </div>
        </div>
      )}
      <TopBar onLogout={handleLogout} creditActivity="validate" />
      <BottomNav />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px" }}>

        {/* Personal score strip (points / rank / quality, real-time) */}
        <MyStats />

        {/* Live window: Nouakchott clock + countdown (timezone-proof) */}
        <CompetitionTimer which="validation" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <CheckCircle size={20} color="var(--primary-light)" />
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{t("validate.heading")}</h2>
          {mode && mode !== "done" && (
            <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, padding: "3px 8px", borderRadius: 6,
              background: mode === "evaluate" ? "rgba(22, 163, 74,0.1)" : "rgba(99,102,241,0.1)",
              color: mode === "evaluate" ? "var(--success)" : "var(--primary-light)",
            }}>
              {mode === "evaluate" ? t("validate.modeEvaluate") : t("validate.modeVote")}
            </span>
          )}
          <button onClick={() => setShowHow(true)} aria-label={t("eval.howTitle")} title={t("eval.howTitle")}
            style={{ marginInlineStart: (mode && mode !== "done") ? "8px" : "auto", background: "none", border: "none", cursor: "pointer", color: "var(--primary-light)", display: "flex", padding: 4 }}>
            <Info size={19} />
          </button>
        </div>

        {/* Language filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", background: "rgba(99,102,241,0.04)", borderRadius: 10, border: "1px solid var(--border-brand)" }}>
          <Globe size={14} color="var(--primary)" />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("validate.languages")}</span>
          {(["fr", "ar", "en"] as const).map(lang => {
            const active = validateLangs.includes(lang);
            return (
              <button key={lang} onClick={() => toggleLang(lang)} style={{
                padding: "4px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700,
                cursor: "pointer", transition: "all 0.2s", border: "none",
                background: active ? "var(--gradient-brand)" : "var(--surface-2)",
                color: active ? "var(--on-primary)" : "var(--text-muted)",
                boxShadow: active ? "0 1px 6px var(--primary-glow)" : "none",
              }}>{lang.toUpperCase()}</button>
            );
          })}
        </div>

        {/* Admin-only: review a specific user's phrases instead of the algorithm */}
        {isAdmin && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", borderRadius: 10, background: targetUser ? "rgba(217,119,6,0.08)" : "rgba(0,0,0,0.03)", border: `1px solid ${targetUser ? "rgba(217,119,6,0.35)" : "var(--border)"}` }}>
            <Shield size={14} color="var(--accent)" />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Admin · cibler</span>
            <input list="validate-user-picker" value={targetUser} onChange={(e) => setTargetUser(e.target.value)}
              placeholder="Vide = algorithme · ou choisir un utilisateur"
              style={{ flex: 1, minWidth: 0, padding: "6px 10px", fontSize: "0.78rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", outline: "none" }} />
            <datalist id="validate-user-picker">
              {adminUsers.map((u) => <option key={u.id} value={u.username} />)}
            </datalist>
            {targetUser && (
              <button onClick={() => setTargetUser("")} style={{ flexShrink: 0, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", background: "var(--accent)", color: "#fff" }}>
                Algorithme
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Loader2 size={36} className="spin" style={{ color: "var(--primary)", opacity: 0.4, margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{t("common.loading")}</p>
          </div>

        ) : gateCode ? (
          <CompetitionGate code={gateCode} startsAt={gateStartsAt} />
        ) : mode === "paused" ? (
          <PauseScreen until={pausedUntil} />
        ) : mode === "locked" ? (
          /* ══ EVALUATION NOT YET AVAILABLE — encouraging, no discouraging numbers ══ */
          <div className="fade-in" style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-green-soft)", color: "var(--accent-green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Sparkles size={28} />
            </div>
            <h3 style={{ fontSize: "1.2rem", marginBottom: 8, fontWeight: 700 }}>{t("validate.lockedTitle")}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 24, maxWidth: 360, marginInline: "auto" }}>
              {t("validate.lockedNeed")}
            </p>
            <Link href="/contribute" className="btn-primary" style={{ padding: "12px 28px", borderRadius: 100 }}>{t("validate.goContribute")}</Link>
          </div>
        ) : mode === "done" ? (
          /* ══ NOTHING TO DO ══ */
          <div className="fade-in" style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(99,102,241,0.08)", color: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Sparkles size={28} />
            </div>
            <h3 style={{ fontSize: "1.2rem", marginBottom: 8, fontWeight: 700 }}>{t("validate.nothingToValidate")}</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 24 }}>{t("validate.allReviewed")}</p>
            <Link href="/contribute" className="btn-primary" style={{ padding: "12px 28px", borderRadius: 100 }}>{t("validate.goContribute")}</Link>
          </div>

        ) : mode === "evaluate" && contribution ? (
          /* ══ EVALUATE MODE ══ */
          <div className="fade-in">
            {/* Source phrase */}
            <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid var(--border-brand)", borderRadius: 20, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <PenLine size={12} /> {t("validate.sourcePhrase")}
                {/* Anonymous, opaque, reportable contributor code (real name never shown). */}
                {(contribution as { contributorCode?: string }).contributorCode && (
                  <span title={t("validate.reportHint")} style={{ marginInlineStart: "auto", fontSize: "0.58rem", fontWeight: 700, fontFamily: "monospace", color: "var(--text-muted)", background: "var(--surface-2)", padding: "2px 7px", borderRadius: 100, letterSpacing: "0.05em" }}>
                    🆔 {(contribution as { contributorCode?: string }).contributorCode}
                  </span>
                )}
              </div>
              <p dir={contribution.phrases?.source_lang === "ar" ? "rtl" : "ltr"} style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--text-primary)" }}>
                {contribution.phrases?.source_text}
              </p>
            </div>

            {/* Translation */}
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{t("validate.hassaniyaTranslation")}</span>
                <button onClick={() => setShowCorrect((v) => !v)} style={{ border: "1px solid var(--accent-green)", background: "var(--accent-green-soft)", color: "var(--accent-green)", borderRadius: 999, padding: "4px 11px", fontSize: "0.62rem", fontWeight: 800, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>✏️ Corriger</button>
              </div>
              <p dir="rtl" style={{ fontSize: "1.15rem", lineHeight: 1.8, fontFamily: "'Cairo', sans-serif", color: "var(--text-primary)" }}>
                {contribution.hassaniya_text}
              </p>
            </div>

            {showCorrect && (
              <CorrectionPanel
                contributionId={contribution.id}
                initialText={contribution.hassaniya_text}
                sourceAudioUrl={contribution.audio_url}
                onDone={() => { setShowCorrect(false); setToast({ msg: "✅ Correction enregistrée — merci !", type: "success" }); setTimeout(() => setToast(null), 2500); loadNext(); }}
                onCancel={() => setShowCorrect(false)}
              />
            )}

            {/* Audio (hidden when admin excluded audio from evaluation) */}
            {showAudio && (
              <div style={{ background: "var(--surface-1)", border: `1px solid ${mustListen ? "var(--warning)" : "var(--border)"}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Mic size={12} /> {t("validate.audioRecording")}
                  {audioListened
                    ? <span style={{ marginInlineStart: "auto", color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 3 }}><Check size={11} /> {t("validate.listened")}</span>
                    : <span style={{ marginInlineStart: "auto", color: "var(--warning)" }}>{t("validate.listenRequired")}</span>}
                </div>
                <WaveformAudio src={contribution.audio_url!} autoPlay onCompleted={() => setAudioListened(true)} />
              </div>
            )}

            {/* Ratings — locked until the audio has been listened to in full */}
            <div style={{ position: "relative", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px", marginBottom: 16 }}>
              {mustListen && (
                <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "var(--bg-glass)", backdropFilter: "blur(2px)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>🔒 {t("validate.listenToRate")}</span>
                </div>
              )}
              {!noTextRating && (
                <RatingBar value={textRating} onChange={setTextRating} label={t("validate.textQuality")} color="#10b981" />
              )}
              {showAudio && (
                <RatingBar value={audioRating} onChange={setAudioRating} label={t("validate.audioQuality")} color="#fbbf24" />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleEvaluate(true)} disabled={submitting || !evalRatingsOk}
                style={{ flex: 1, padding: "16px 0", borderRadius: 16, border: "none", cursor: "pointer",
                  background: evalRatingsOk ? "rgba(22, 163, 74,0.1)" : "rgba(255,255,255,0.03)",
                  borderWidth: 1, borderStyle: "solid", borderColor: evalRatingsOk ? "rgba(22, 163, 74,0.2)" : "var(--border)",
                  color: evalRatingsOk ? "var(--success)" : "var(--text-muted)",
                  fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  opacity: submitting ? 0.5 : 1, transition: "all 0.2s",
                }}>
                <Check size={18} /> {t("validate.approve")}
              </button>
              <button onClick={() => handleEvaluate(false)} disabled={submitting || mustListen}
                style={{ flex: 1, padding: "16px 0", borderRadius: 16, border: "1px solid rgba(248,113,113,0.25)",
                  background: mustListen ? "var(--surface-2)" : "rgba(248,113,113,0.06)",
                  color: mustListen ? "var(--text-muted)" : "var(--danger)", cursor: mustListen ? "not-allowed" : "pointer",
                  fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  opacity: submitting ? 0.5 : 1, transition: "all 0.2s",
                }}>
                <X size={18} /> {t("validate.reject")}
              </button>
            </div>
          </div>

        ) : mode === "vote" && votePhrase ? (
          /* ══ VOTE MODE ══ */
          <div className="fade-in">
            {/* Source phrase */}
            <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid var(--border-brand)", borderRadius: 20, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <PenLine size={12} /> {t("validate.sourcePhrase")}
              </div>
              <p dir={votePhrase.source_lang === "ar" ? "rtl" : "ltr"} style={{ fontSize: "1rem", lineHeight: 1.7 }}>{votePhrase.source_text}</p>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 12, textAlign: "center" }}>{t("validate.pickBest")}</p>

            {/* Contributions to compare */}
            {voteContributions.map((c: any, idx: number) => {
              const selected = selectedId === c.id;
              return (
                <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  background: selected ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
                  border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: 18, padding: "16px", marginBottom: 10, transition: "all 0.2s",
                  boxShadow: selected ? "0 0 16px var(--primary-glow)" : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: selected ? "var(--primary-light)" : "var(--text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Anonymous: name hidden; opaque reportable code shown instead */}
                      {t("validate.option")} {idx + 1}
                      {c.contributorCode && <span title={t("validate.reportHint")} style={{ fontSize: "0.56rem", fontFamily: "monospace", color: "var(--text-muted)", background: "var(--surface-2)", padding: "1px 6px", borderRadius: 100 }}>🆔 {c.contributorCode}</span>}
                    </span>
                    {selected && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--primary-light)", display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> {t("validate.selected")}</span>}
                  </div>
                  <p dir="rtl" style={{ fontSize: "1.1rem", lineHeight: 1.8, fontFamily: "'Cairo', sans-serif", marginBottom: c.audio_url ? 10 : 0 }}>{c.hassaniya_text}</p>
                  {c.audio_url && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Mic size={12} color="var(--primary)" />
                      <div style={{ flex: 1 }}><WaveformAudio src={c.audio_url} /></div>
                    </div>
                  )}
                </button>
              );
            })}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button className="btn-primary" onClick={handleVote} disabled={!selectedId || submitting}
                style={{ flex: 1, padding: "16px 0", borderRadius: 16, fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {submitting ? t("common.loading") : <><ThumbsUp size={16} /> {t("validate.submitVote")}</>}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
