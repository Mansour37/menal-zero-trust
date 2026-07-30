"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BottomNav, TopBar } from "@/components/Navigation";
import { WaveformAudio } from "@/components/WaveformAudio";
import { Star, FastForward, Square, Mic, X, Check, Loader2, PenLine, CheckCircle, AlertCircle, Globe, Clock, Flag } from "lucide-react";
import { isValidHassaniyaText } from "@/lib/hassaniya";
import { isLoggedIn, tryRestoreSession, logout, getNextPhrase, skipPhrase, reportPhrase, resetSkips, submitContribution, getMyProfile, getDisclaimer, acceptDisclaimer, getNextMedia, getMediaMode, type MediaTask } from "@/lib/api";
import { MediaTranscribePanel } from "@/components/MediaTranscribePanel";
import { HassaniyaInput } from "@/components/HassaniyaInput";
import { outboxAdd, outboxRemove, outboxAll } from "@/lib/outbox-db";
import { MyStats, refreshMyStats } from "@/components/MyStats";
import { CREDIT_EXHAUSTED_EVENT } from "@/components/CreditMeter";
import { CompetitionTimer } from "@/components/CompetitionTimer";
import { useI18n } from "@/lib/i18n-context";
import { PauseScreen } from "@/components/PauseScreen";
import FlashBanner from "@/components/FlashBanner";

type Phrase = { id: number; source_text: string; source_lang: string; difficulty: number; category?: string };

// Human label for the phrase context (category). Empty = no chip (generic phrases).
const CAT_LABELS: Record<string, string> = {
  administration: "Administration", international_orgs: "Organisations & ambassades",
  education: "Éducation", health: "Santé", banking: "Banque", wallet: "Paiement mobile",
  telecom: "Télécom", transport: "Transport", electricity_water: "Eau & électricité",
  justice: "Justice & sécurité", municipality: "Quartier / commune", tax_customs: "Impôts & douane",
  fishing_port: "Port & pêche", rural_life: "Vie rurale", culture: "Culture & traditions",
  sports: "Sport", national_pride: "Fierté nationale", dining_leisure: "Restaurants & sorties",
};
function catLabel(c?: string): string {
  if (!c || c === "general" || c === "daily") return "";
  return CAT_LABELS[c] || c.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase());
}

export default function ContributePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [disclaimer, setDisclaimer] = useState<{ enabled: boolean; accepted: boolean; text: string } | null>(null);
  const [acceptingDisc, setAcceptingDisc] = useState(false);
  useEffect(() => { getDisclaimer().then(({ data }) => { if (data) setDisclaimer(data); }); }, []);
  const [authed, setAuthed] = useState(false);
  const [lang, setLang] = useState("");
  const [phrase, setPhrase] = useState<Phrase | null>(null);
  const [conversation, setConversation] = useState<{ speaker: string; text: string; target: boolean }[] | null>(null);
  const [showContext, setShowContext] = useState(false); // collapsed by default: click to see the context
  const [mediaTask, setMediaTask] = useState<MediaTask | null>(null); // media transcription task (served separately, alternated)
  const [mediaNoSkip, setMediaNoSkip] = useState(false); // mandatory transcription (admin)
  const loadCountRef = useRef(0);
  const mediaModeRef = useRef({ enabled: false, mediaOnly: false }); // media mode (fetched on mount)
  const modeReadyRef = useRef(false);
  const [lockId, setLockId] = useState<number | null>(null);
  const [hassaniyaText, setHassaniyaText] = useState("");
  const swappingLangRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [gateMeta, setGateMeta] = useState<{ startsAt?: string | null } | null>(null);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [resettingSkips, setResettingSkips] = useState(false);
  const submitting = false; // optimistic submit: never blocks (advance is instant)
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [pointsPopup, setPointsPopup] = useState<number | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.push("/login"); return; }
      }
      setAuthed(true);
      getMyProfile().then(({ data, error }) => { if (error) { router.push("/login"); return; } if (data?.profile) { setLang(data.profile.preferred_lang || "en"); } });
    }
    init();
  }, []);

  const loadPhrase = useCallback(async () => {
    if (!authed || !lang) return;
    setLoading(true);
    // Media served SEPARATELY. "Media only" mode → always a clip until exhausted
    // (chains through active datasets) then switches to text. Otherwise → alternated 1 in 2.
    // getNextMedia returns clip=null if disabled / nothing left → switch to text.
    loadCountRef.current += 1;
    // Make sure the mode is known BEFORE the 1st task (avoids the race → 1st task text).
    if (!modeReadyRef.current) {
      try { const { data: mo } = await getMediaMode(); if (mo) mediaModeRef.current = { enabled: mo.enabled, mediaOnly: mo.mediaOnly }; } catch { /* default text */ }
      modeReadyRef.current = true;
    }
    const mm = mediaModeRef.current;
    const wantMedia = mm.enabled && (mm.mediaOnly || loadCountRef.current % 2 === 0);
    if (wantMedia) {
      try {
        const { data: m } = await getNextMedia();
        if (m?.clip) { setMediaTask(m.clip); setMediaNoSkip(!!m.noSkip); setPhrase(null); setEmptyReason(null); setLoading(false); return; }
      } catch { /* ignore → text */ }
    }
    setMediaTask(null);
    const { data, error, code, meta } = await getNextPhrase(lang);
    if (code === "EMAIL_NOT_VERIFIED") { router.push("/verify-email"); return; }
    if (error || !data?.phrase) {
      setPhrase(null);
      setLockId(null);
      // Gate codes from competitionGateMiddleware take precedence over pipeline reason
      const reason = code ?? data?.reason ?? "all_contributed";
      setEmptyReason(reason);
      setPausedUntil((code === "PAUSED" || code === "CLOSED" || code === "LANG_CLOSED" || code === "CREDIT_EXHAUSTED" || code === "CREDIT_PAUSED" || code === "CREDIT_BLOCKED") ? (meta?.until ?? null) : null);
      setGateMeta(meta && (meta.startsAt || meta.activateAt) ? { startsAt: meta.startsAt ?? meta.activateAt } : null);
      setSkippedCount(data?.skippedCount ?? 0);
      setLoading(false);
      return;
    }
    setEmptyReason(null);
    setGateMeta(null);
    setPhrase(data.phrase); setConversation(data.conversation ?? null); setShowContext(false); setLockId(data.lockId); setHassaniyaText(""); setAudioBlob(null); setAudioUrl(null); setRecordingTime(0); setLoading(false);
  }, [authed, lang]);

  useEffect(() => { if (authed && lang && !swappingLangRef.current) loadPhrase(); else swappingLangRef.current = false; }, [authed, lang, loadPhrase]);

  // Fetch the media mode (enabled? media-only?) once logged in.
  useEffect(() => {
    if (!authed) return;
    getMediaMode().then(({ data }) => { if (data) mediaModeRef.current = { enabled: data.enabled, mediaOnly: data.mediaOnly }; }).catch(() => {});
  }, [authed]);

  // Credit ran out (navbar meter) → refetch so the closed screen shows up.
  useEffect(() => {
    const onExhausted = () => loadPhrase();
    window.addEventListener(CREDIT_EXHAUSTED_EVENT, onExhausted);
    return () => window.removeEventListener(CREDIT_EXHAUSTED_EVENT, onExhausted);
  }, [loadPhrase]);

  // Dead-mic detection: a permanent red banner (not a fleeting toast) whenever the
  // microphone is denied or produces an empty recording — so nobody can work for
  // hours believing they're submitting while nothing can be sent.
  const [micBroken, setMicBroken] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: { ideal: 16000 }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48000 });
      mediaRecorderRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // An "empty" recording (mic muted / hardware gone) = broken mic → loud banner.
        if (blob.size < 1000) { setMicBroken(true); setAudioBlob(null); setAudioUrl(null); }
        else { setMicBroken(false); setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); }
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setIsRecording(true); setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { setMicBroken(true); showToast(t("contribute.micDenied"), "error"); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); if (timerRef.current) clearInterval(timerRef.current); } };
  const deleteRecording = () => { setAudioBlob(null); setAudioUrl(null); setRecordingTime(0); };

  // Free each preview's blob URL as soon as it's replaced (and on unmount). Without
  // this, a long session of thousands of recordings would leak ~tens of MB of blobs
  // in the tab and could crash a low-end phone. The OUTBOX keeps its own blob copy,
  // so revoking the preview URL never affects delivery.
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  // ── "No work is ever lost" DURABLE OUTBOX ──────────────────────────────────
  // Every submission is persisted to IndexedDB (audio + text) the instant the user
  // taps send, and HELD until the server confirms it (+15). Failures are retried
  // automatically (2 quick retries), then parked behind a persistent red banner
  // with a Retry button. Because the queue lives on disk, nothing is lost even if
  // the user reloads, crashes, or closes the tab mid-upload — pending items are
  // replayed on the next load. Never a silent loss, even with the optimistic UX.
  type OutboxItem = { id: string; phraseId: number; text: string; blob: Blob; durationMs: number; attempts: number };
  const outboxRef = useRef<OutboxItem[]>([]);
  const flushingRef = useRef(false);
  const [outboxStuck, setOutboxStuck] = useState(0); // items parked after retries

  const refreshStuck = () => setOutboxStuck(outboxRef.current.filter((i) => i.attempts >= 3).length);

  const flushOutbox = async (manual = false) => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      if (manual) outboxRef.current.forEach((i) => { i.attempts = 0; });
      while (outboxRef.current.length) {
        const item = outboxRef.current[0];
        if (item.attempts >= 3) break; // parked — wait for manual retry
        const fd = new FormData();
        fd.append("phraseId", String(item.phraseId));
        fd.append("hassaniyaText", item.text);
        fd.append("audioDurationMs", String(item.durationMs));
        fd.append("audio", item.blob, "recording.webm");
        const { data: sub, error, status } = await submitContribution(fd).catch(() => ({ data: null as any, error: "network", status: 0 as number | undefined }));
        if (error || !sub) {
          // ONLY the submit handler's own rejections are vaulted server-side (v46):
          // 400 (invalid audio/text), 404 (phrase), 409 (lock/duplicate), 422 (quality).
          // Everything rejected BEFORE the handler is NOT vaulted and must stay queued:
          // 0 network, 401 session, 403 gates, 423 slot closed, 429 rate-limit, 5xx.
          const permanent = [400, 404, 409, 422].includes(status ?? 0);
          if (permanent) {
            outboxRef.current.shift();
            await outboxRemove(item.id);
            refreshStuck();
            showToast(error ?? t("contribute.error"), "error");
            continue;
          }
          item.attempts++;
          // Reached only for TRANSIENT errors (network / 5xx / rate-limit) — permanent
          // ones already `continue`d above. The raw value here can be a technical string
          // ("network", "Failed to submit…"), so we always show the friendly localized
          // message instead. Nothing is lost: the item stays queued and replays.
          if (item.attempts >= 3) { refreshStuck(); showToast(t("contribute.error"), "error"); break; }
          await new Promise((r) => setTimeout(r, item.attempts === 1 ? 1500 : 4000));
          continue;
        }
        outboxRef.current.shift();
        await outboxRemove(item.id); // confirmed by server → drop the durable copy
        refreshStuck();
        try { // drop the localStorage text backup for this phrase
          const k = "elson-unsent"; const arr = JSON.parse(localStorage.getItem(k) || "[]");
          localStorage.setItem(k, JSON.stringify(arr.filter((x: any) => x.phraseId !== item.phraseId)));
        } catch { /* ignore */ }
        if (sub.flash) {
          // Flash mode (B): 0 official points — the contribution counts toward the flash tournament.
          showToast("🔥 +1 pour le tournoi flash !");
        } else {
          setPointsPopup(sub.points); setTimeout(() => setPointsPopup(null), 1500); showToast(`+${sub.points} points!`);
        }
        refreshMyStats();
      }
    } finally {
      flushingRef.current = false;
      // An item queued during the tiny window between the loop ending and this line
      // would otherwise wait for the next trigger. A *fresh* item (attempts === 0)
      // means exactly that race → drain it now. Failed items (attempts > 0) are left
      // to the backoff / online / focus triggers, so this can never tight-loop.
      if (outboxRef.current.some((i) => i.attempts === 0)) flushOutbox();
    }
  };

  // Drain the outbox when connectivity returns or the tab is refocused — parked
  // items get another chance automatically, without the user doing anything.
  useEffect(() => {
    const drain = () => flushOutbox(true);
    const onVis = () => { if (document.visibilityState === "visible") drain(); };
    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("online", drain); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On load: recover any submissions left pending from a previous session (reload,
  // crash, tab close, lost connection) and replay them — guaranteeing delivery.
  useEffect(() => {
    if (!authed) return;
    (async () => {
      const pending = await outboxAll();
      if (!pending.length) return;
      const known = new Set(outboxRef.current.map((i) => i.id));
      for (const r of pending) {
        if (!known.has(r.id)) outboxRef.current.push({ id: r.id, phraseId: r.phraseId, text: r.text, blob: r.blob, durationMs: r.durationMs, attempts: 0 });
      }
      refreshStuck();
      flushOutbox();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const handleSubmit = async () => {
    const v = isValidHassaniyaText(hassaniyaText);
    if (!phrase || !v.valid || !audioBlob) { if (!v.valid) setInputError(v.error); if (!audioBlob) showToast(t("contribute.audioRequired"), "error"); return; }
    if (recordingTime < 2) { showToast(t("contribute.tooShort"), "error"); return; }
    // Persist to IndexedDB FIRST (survives reload/crash), then queue in memory.
    const id = `${phrase.id}-${Date.now()}`;
    const item: OutboxItem = { id, phraseId: phrase.id, text: hassaniyaText, blob: audioBlob, durationMs: recordingTime * 1000, attempts: 0 };
    outboxRef.current.push(item);
    await outboxAdd({ id, phraseId: item.phraseId, text: item.text, blob: item.blob, durationMs: item.durationMs, createdAt: Date.now() });
    try {
      const k = "elson-unsent"; const arr = JSON.parse(localStorage.getItem(k) || "[]");
      arr.push({ phraseId: phrase.id, text: hassaniyaText, at: new Date().toISOString() });
      localStorage.setItem(k, JSON.stringify(arr.slice(-50)));
    } catch { /* quota/private mode */ }
    // Optimistic UX: advance instantly — the durable outbox guarantees delivery.
    loadPhrase();
    flushOutbox();
  };

  // Language is set at registration — no switching during competition
  const handleSkip = async () => {
    if (!phrase) return;
    const { error } = await skipPhrase(phrase.id);
    if (error) { showToast(error, "error"); return; }
    loadPhrase();
  };
  const handleReport = () => {
    if (!phrase) return;
    setReportModalOpen(true);
  };
  const confirmReport = async () => {
    if (!phrase) return;
    setReporting(true);
    const { error } = await reportPhrase(phrase.id);
    setReporting(false);
    setReportModalOpen(false);
    if (error) { showToast(error, "error"); return; }
    showToast(t("contribute.reported"), "success");
    loadPhrase();
  };
  const handleLogout = async () => { await logout(); router.push("/"); };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (!authed) return null;

  const canSubmit = hassaniyaText.trim().length > 0 && audioBlob && !inputError && !submitting;

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 16px)" }}>
      <TopBar onLogout={handleLogout} creditActivity="contribute" />
      <BottomNav />

      {disclaimer?.enabled && !disclaimer.accepted && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "grid", placeItems: "center", padding: 16 }}>
          <div style={{ width: "min(640px, 94vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)" }}>Conditions de participation</div>
            <div style={{ padding: "18px 20px", overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: "0.92rem", color: "var(--text-secondary)" }}>{disclaimer.text || "—"}</div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
              <button onClick={() => { logout(); router.push("/"); }} style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-muted)", cursor: "pointer", fontWeight: 700 }}>Refuser</button>
              <button disabled={acceptingDisc} onClick={async () => { setAcceptingDisc(true); const { error } = await acceptDisclaimer(); setAcceptingDisc(false); if (!error) setDisclaimer((d) => d ? { ...d, accepted: true } : d); }}
                style={{ padding: "11px 22px", borderRadius: 11, border: "none", background: "var(--gradient-brand)", color: "#fff", cursor: "pointer", fontWeight: 800 }}>{acceptingDisc ? "…" : "J'accepte"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px" }}>

        {/* ── Flash tournament: banner + countdown (visible if active/upcoming) ── */}
        <FlashBanner />

        {/* ── "No work is lost" banners: dead mic + parked submissions ── */}
        {micBroken && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.45)" }}>
            <Mic size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
              <b style={{ color: "#ef4444" }}>Ton micro ne capte rien — tes phrases ne peuvent PAS être envoyées.</b><br />
              Vérifie l'autorisation micro du navigateur (icône 🎤 dans la barre d'adresse), ton casque, puis réessaie un enregistrement.
            </div>
          </div>
        )}
        {outboxStuck > 0 && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.45)" }}>
            <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
              <b style={{ color: "#ef4444" }}>{outboxStuck} phrase{outboxStuck > 1 ? "s" : ""} non envoyée{outboxStuck > 1 ? "s" : ""}.</b> Ton travail est conservé — rien n'est perdu.
            </div>
            <button onClick={() => flushOutbox(true)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 100, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", border: "none", background: "#ef4444", color: "#fff" }}>
              Réessayer
            </button>
          </div>
        )}

        {/* ── Personal score strip (points / rank / quality, real-time) ── */}
        <MyStats />

        {/* ── Live window: Nouakchott clock + countdown (timezone-proof) ── */}
        <CompetitionTimer which="contribute" />

        {/* ── Language indicator (set at registration, changeable in dashboard) ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "8px 14px", background: "rgba(99,102,241,0.04)", borderRadius: 10, border: "1px solid var(--border-brand)" }}>
          <Globe size={14} color="var(--primary)" />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("contribute.phrasesIn")}</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--primary-light)" }}>
            {lang === "fr" ? "Français" : lang === "ar" ? "العربية" : "English"}
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "auto" }}>{t("contribute.toHassaniya")}</span>
        </div>

        {/* Quality reminder */}
        <div style={{ padding: "8px 12px", borderRadius: 10, fontSize: "0.7rem", lineHeight: 1.5, background: "rgba(217, 119, 6,0.04)", border: "1px solid rgba(217, 119, 6,0.1)", color: "var(--text-muted)", marginBottom: 12 }}>
          {t("contribute.qualityNote")}
        </div>

        {/* ── Main content ── */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Loader2 size={36} className="spin" style={{ color: "var(--primary)", opacity: 0.4, margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{t("common.loading")}</p>
          </div>
        ) : mediaTask ? (
          <MediaTranscribePanel clip={mediaTask} noSkip={mediaNoSkip} onDone={() => { showToast("🎬 +15 points — transcription envoyée !"); refreshMyStats(); loadPhrase(); }} onSkip={loadPhrase} />
        ) : (emptyReason === "PAUSED" || emptyReason === "CLOSED" || emptyReason === "LANG_CLOSED" || emptyReason === "CREDIT_EXHAUSTED") ? (
          <PauseScreen until={pausedUntil} />
        ) : !phrase ? (
          (() => {
            const isGate = emptyReason === "COMPETITION_NOT_ACTIVE" || emptyReason === "NOT_ACTIVATED_YET" || emptyReason === "NOT_ACTIVATED" || emptyReason === "COMPETITION_ENDED";
            return (
              <div className="fade-in" style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: isGate ? "rgba(217, 119, 6, 0.08)" : emptyReason === "all_skipped" ? "rgba(217, 119, 6, 0.08)" : "rgba(0, 0, 0, 0.05)", color: isGate || emptyReason === "all_skipped" ? "var(--warning)" : "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  {isGate ? <Clock size={32} /> : emptyReason === "all_skipped" ? <FastForward size={32} /> : <Check size={32} />}
                </div>
                {isGate ? (
                  <>
                    <h3 style={{ fontSize: "1.2rem", marginBottom: 8, fontWeight: 700 }}>
                      {emptyReason === "COMPETITION_ENDED" ? t("contribute.competitionEnded") : t("contribute.notActive")}
                    </h3>
                    {gateMeta?.startsAt && emptyReason !== "COMPETITION_ENDED" && (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                        {t("contribute.startsAt").replace("{date}", new Date(gateMeta.startsAt).toLocaleString())}
                      </p>
                    )}
                    {emptyReason === "NOT_ACTIVATED" && (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: 8 }}>
                        {t("contribute.notActivated")}
                      </p>
                    )}
                  </>
                ) : emptyReason === "all_skipped" ? (
                  <>
                    <h3 style={{ fontSize: "1.2rem", marginBottom: 8, fontWeight: 700 }}>{t("contribute.allSkipped")}</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 8 }}>
                      {t("contribute.allSkippedCount").replace("{n}", String(skippedCount))}
                    </p>
                    <button
                      className="btn-primary"
                      disabled={resettingSkips}
                      onClick={async () => {
                        setResettingSkips(true);
                        await resetSkips();
                        setResettingSkips(false);
                        loadPhrase();
                      }}
                      style={{ marginTop: 16, padding: "14px 28px", borderRadius: 14 }}
                    >
                      {resettingSkips ? t("common.loading") : t("contribute.retrySkipped")}
                    </button>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: "1.2rem", marginBottom: 8, fontWeight: 700 }}>{t("contribute.allTranslated")}</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>{t("contribute.tryOtherLang")}</p>
                  </>
                )}
              </div>
            );
          })()
        ) : (
          <div className="fade-in">
            {/* Points popup */}
            {pointsPopup && <div className="points-popup" style={{ top: 0, right: 20, zIndex: 20 }}>+{pointsPopup} <Star size={14} fill="currentColor" /></div>}

            {/* ── STEP 1: Read the phrase ── */}
            <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid var(--border-brand)", borderRadius: 20, padding: "20px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, background: "var(--gradient-brand)", color: "var(--on-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>1</span>
                {t("contribute.step1")}
                {catLabel(phrase.category) && (
                  <span style={{
                    marginInlineStart: "auto", padding: "3px 9px", borderRadius: 999,
                    background: "var(--accent-green-soft)", color: "var(--accent-green)",
                    fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.04em",
                    textTransform: "none", whiteSpace: "nowrap",
                  }}>{catLabel(phrase.category)}</span>
                )}
              </div>
              {conversation && conversation.length > 1 && showContext ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)" }}>💬 Conversation — traduis la phrase surlignée</span>
                    <button onClick={() => setShowContext(false)} style={{ marginInlineStart: "auto", border: "none", background: "transparent", color: "var(--primary)", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600 }}>Masquer le contexte</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {conversation.map((tt, i) => (
                      <div key={i} dir={lang === "ar" ? "rtl" : "ltr"} style={{
                        padding: "10px 12px", borderRadius: 12,
                        background: tt.target ? "var(--accent-green-soft)" : "var(--surface-2)",
                        border: tt.target ? "1px solid var(--accent-green)" : "1px solid var(--border)",
                        color: tt.target ? "var(--text-primary)" : "var(--text-muted)",
                        fontWeight: tt.target ? 600 : 400, fontSize: tt.target ? "1.1rem" : "0.9rem",
                        lineHeight: 1.6, fontFamily: lang === "ar" ? "'Cairo', sans-serif" : undefined,
                      }}>
                        {tt.speaker && <b style={{ opacity: 0.6, marginInlineEnd: 6 }}>{tt.speaker} ·</b>}{tt.text}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p dir={lang === "ar" ? "rtl" : "ltr"} style={{
                    fontSize: "1.15rem", fontWeight: 500, lineHeight: 1.75, color: "var(--text-primary)",
                    fontFamily: lang === "ar" ? "'Cairo', sans-serif" : undefined,
                  }}>
                    {phrase.source_text}
                  </p>
                  {conversation && conversation.length > 1 && (
                    <button onClick={() => setShowContext(true)} style={{
                      display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                      padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: "0.74rem",
                      border: "1px solid var(--accent-green)", background: "var(--accent-green-soft)", color: "var(--accent-green)",
                    }}>💬 Voir la conversation <span style={{ opacity: 0.7, fontWeight: 600 }}>(comprendre le contexte)</span></button>
                  )}
                </>
              )}
            </div>

            {/* ── STEP 2: Translate ── */}
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, background: "var(--gradient-brand)", color: "var(--on-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>2</span>
                {t("contribute.step2")}
              </div>
              <HassaniyaInput
                value={hassaniyaText}
                placeholder={t("contribute.textPlaceholder")}
                minHeight={90}
                onChange={(v) => {
                  setHassaniyaText(v);
                  if (v.trim()) { const r = isValidHassaniyaText(v); setInputError(r.valid ? null : r.error); }
                  else setInputError(null);
                }}
              />
              {inputError && <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--danger)", fontSize: "0.75rem", marginTop: 6, fontWeight: 500 }}><AlertCircle size={13} /> {inputError}</div>}
            </div>

            {/* ── STEP 3: Record audio ── */}
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: "18px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: "var(--gradient-brand)", color: "var(--on-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>3</span>
                  {t("contribute.step3")}
                </div>
                <span style={{ color: "var(--danger)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em" }}>{t("contribute.mandatory")}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "16px 0" }}>
                {!audioUrl ? (
                  <>
                    <button className={`btn-record ${isRecording ? "recording" : ""}`} onClick={isRecording ? stopRecording : startRecording} style={{ width: 68, height: 68 }}>
                      {isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={26} />}
                    </button>
                    {isRecording && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "var(--recording)", fontWeight: 700, fontSize: "1.8rem", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{fmt(recordingTime)}</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 4 }}>{t("contribute.speakClearly")}</div>
                      </div>
                    )}
                    {!isRecording && <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 160 }}>{t("contribute.tapToRecord")}</div>}
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><WaveformAudio src={audioUrl} /></div>
                    <button onClick={deleteRecording} style={{
                      width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(248,113,113,0.2)",
                      background: "rgba(248,113,113,0.06)", color: "var(--danger)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
              {audioUrl && <div style={{ fontSize: "0.7rem", color: "var(--success)", textAlign: "center", fontWeight: 600 }}><CheckCircle size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />{t("contribute.audioRecorded")} ({fmt(recordingTime)})</div>}
            </div>

            {/* ── Submit + Skip ── */}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}
                style={{ flex: 1, padding: "16px 0", borderRadius: 16, fontSize: "0.9rem", fontWeight: 700 }}>
                {submitting ? <><Loader2 size={16} className="spin" /> {t("contribute.sending")}</> : <>{t("contribute.submitPts")}</>}
              </button>
              <button className="btn-secondary" onClick={handleSkip} title={t("contribute.skip")} style={{ padding: "16px 20px", borderRadius: 16, fontSize: "0.85rem" }}>
                <FastForward size={16} />
              </button>
            </div>
            {/* ── Report — clearly visible, on its own row to avoid accidental taps ── */}
            <button onClick={handleReport} style={{ marginTop: 12, width: "100%", padding: "13px 0", borderRadius: 14, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.4)", color: "var(--warning)", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
              <Flag size={15} /> {t("contribute.report")}
            </button>
          </div>
        )}
      </div>

      {reportModalOpen && phrase && (
        <div onClick={() => !reporting && setReportModalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="fade-in" style={{ background: "var(--bg-card, #fff)", borderRadius: 22, padding: "28px 24px", maxWidth: 430, width: "100%", boxShadow: "0 24px 70px rgba(0,0,0,0.35)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(217,119,6,0.1)", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Flag size={26} />
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, textAlign: "center", marginBottom: 10 }}>{t("contribute.reportTitle")}</h3>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6, marginBottom: 16 }}>{t("contribute.reportConfirm")}</p>
            <div dir="auto" style={{ background: "rgba(0,0,0,0.05)", borderRadius: 12, padding: "12px 14px", marginBottom: 22, fontSize: "0.92rem", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
              « {phrase.source_text} »
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" onClick={() => setReportModalOpen(false)} disabled={reporting} style={{ flex: 1, padding: "14px 0", borderRadius: 14, fontWeight: 600 }}>
                {t("contribute.reportCancel")}
              </button>
              <button onClick={confirmReport} disabled={reporting} style={{ flex: 1, padding: "14px 0", borderRadius: 14, fontWeight: 700, background: "var(--warning)", color: "#fff", border: "none", cursor: reporting ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {reporting ? <Loader2 size={16} className="spin" /> : <Flag size={16} />} {t("contribute.reportConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
