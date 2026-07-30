"use client";

/**
 * Admin — Media Studio (real). Datasets, YouTube ingestion (download + cutting),
 * playable/deletable clips, history, global toggle.
 * Gated admin. Activity SEPARATE from text (kill-switch media_annotation_enabled).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar, BottomNav } from "@/components/Navigation";
import {
  Upload, Scissors, Trash2, Play, Plus, Film, Loader2, Database, Power, Clock, History, Layers, Link2, RefreshCw,
} from "lucide-react";
import {
  isLoggedIn, tryRestoreSession, getMyProfile,
  mediaGetConfig, mediaSetConfig, mediaListDatasets, mediaCreateDataset, mediaUpdateDataset, mediaDeleteDataset,
  mediaIngest, mediaUploadFileChunked, mediaGetJob, mediaListJobs, mediaListClips, mediaDeleteClip, mediaDeleteClips, mediaRecutClip, mediaHistory, mediaReassembly, fetchAuthAudio,
  mediaStats, mediaUpdateJob, mediaCleanVideo, mediaSetHoneypot, mediaCheaters,
  type VideoDataset, type VideoClip, type MediaHistoryItem, type MediaJob, type ReassemblyClip, type MediaSpeaker, type MediaCheater,
} from "@/lib/api";

const fmtT = (ms: number | null) => { const s = Math.round((ms ?? 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export default function MediaStudio() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [noSkip, setNoSkip] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [assist, setAssist] = useState(false);
  const [view, setView] = useState<"datasets" | "history">("datasets");
  const [datasets, setDatasets] = useState<VideoDataset[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"video" | "audio">("video");
  const [segLen, setSegLen] = useState<number>(() => { if (typeof window !== "undefined") { const v = Number(localStorage.getItem("elson_seglen")); if (v >= 5 && v <= 60) return v; } return 30; }); // target short duration (s), remembered
  const [reasm, setReasm] = useState<{ jobId: number; clips: ReassemblyClip[] } | null>(null);
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<MediaJob | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [multi, setMulti] = useState<{ i: number; n: number; name: string } | null>(null);
  const [stats, setStats] = useState<{ totalHours: number; totalClips: number; speakers: MediaSpeaker[] } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [cheaters, setCheaters] = useState<MediaCheater[]>([]);
  const [history, setHistory] = useState<MediaHistoryItem[]>([]);
  const [busy, setBusy] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      if (!isLoggedIn()) await tryRestoreSession();
      const { data } = await getMyProfile();
      const admin = data?.profile?.role === "admin";
      setIsAdmin(admin); setReady(true);
      if (admin) { loadDatasets(); loadStats(); mediaGetConfig().then(({ data }) => { setEnabled(!!data?.enabled); setNoSkip(!!data?.noSkip); setMediaOnly(!!data?.mediaOnly); setAssist(!!data?.assist); }); }
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const loadDatasets = async () => { const { data } = await mediaListDatasets(); setDatasets(data?.datasets ?? []); };
  const loadJobs = async (id: number) => { const { data } = await mediaListJobs(id); setJobs(data?.jobs ?? []); };
  const loadStats = async () => { const { data } = await mediaStats(); if (data) setStats(data); const c = await mediaCheaters(); setCheaters(c.data?.users ?? []); };

  useEffect(() => { try { localStorage.setItem("elson_seglen", String(segLen)); } catch { /* private mode */ } }, [segLen]);

  useEffect(() => {
    if (!sel) { setJobs([]); return; }
    mediaListJobs(sel).then(({ data }) => {
      setJobs(data?.jobs ?? []);
      const active = data?.jobs?.find((j) => !["done", "error"].includes(j.status));
      if (active) startPolling(active.id); // resume tracking of an in-progress cut
    });
  }, [sel]);
  const openReassembly = async (jobId: number) => { const { data } = await mediaReassembly(jobId); setReasm({ jobId, clips: data?.clips ?? [] }); };
  useEffect(() => { if (view === "history") mediaHistory(sel ?? undefined).then(({ data }) => setHistory(data?.items ?? [])); }, [view, sel]);

  const toggleGlobal = async () => { const n = !enabled; setEnabled(n); await mediaSetConfig({ enabled: n }); };
  const toggleNoSkip = async () => { const n = !noSkip; setNoSkip(n); await mediaSetConfig({ noSkip: n }); };
  const toggleMediaOnly = async () => { const n = !mediaOnly; setMediaOnly(n); await mediaSetConfig({ mediaOnly: n }); };
  const toggleAssist = async () => { const n = !assist; setAssist(n); await mediaSetConfig({ assist: n }); };

  const createDs = async () => {
    if (!name.trim()) return;
    setBusy("create"); const { data } = await mediaCreateDataset(name.trim()); setBusy("");
    setName(""); await loadDatasets(); if (data?.id) setSel(data.id);
  };

  const startPolling = (jobId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const dsId = sel;
    const poll = async () => {
      const { data: j } = await mediaGetJob(jobId);
      if (j?.job) {
        setJob(j.job);
        // Shorts are inserted progressively → refresh the videos LIVE.
        if (dsId) mediaListJobs(dsId).then(({ data }) => { if (data) setJobs(data.jobs); });
        if (j.job.status === "done" || j.job.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          await loadDatasets();
          if (j.job.status === "done") setTimeout(() => setJob(null), 5000);
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
  };

  const ingest = async () => {
    if (!sel || !url.trim()) return;
    setBusy("ingest");
    const { data, error } = await mediaIngest(sel, url.trim(), kind, segLen);
    setBusy("");
    if (error || !data?.jobId) { alert(error || "Erreur"); return; }
    setUrl(""); startPolling(data.jobId);
  };

  const ingestFile = async (file: File) => {
    if (!sel) return;
    const mb = file.size / (1024 * 1024);
    if (mb > 800) {
      if (!confirm(`Ce fichier fait ${mb.toFixed(0)} Mo — l'envoi (par blocs) et le traitement seront longs. Continuer ?`)) return;
    }
    setBusy("ingest"); setJob(null); setUploadPct(0);
    // Chunked upload → gets through Cloudflare regardless of size.
    const { data, error } = await mediaUploadFileChunked(sel, file, file.type.startsWith("audio/") ? "audio" : kind, (p) => setUploadPct(p), segLen);
    setUploadPct(null); setBusy("");
    if (error || !data?.jobId) { alert(error || "Erreur"); return; }
    startPolling(data.jobId); // upload done → cutting (job)
  };

  // Refresh the video list while a cut is in progress (multi-file case).
  const pollAllJobs = (dsId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const tick = async () => {
      const { data } = await mediaListJobs(dsId);
      if (data) setJobs(data.jobs);
      if (!data?.jobs?.some((j) => !["done", "error"].includes(j.status))) { if (pollRef.current) clearInterval(pollRef.current); loadDatasets(); }
    };
    tick(); pollRef.current = setInterval(tick, 2500);
  };

  // Upload MULTIPLE videos at once → each becomes a video (speaker) in the dataset.
  const ingestFiles = async (files: File[]) => {
    if (!sel || !files.length) return;
    if (files.length === 1) return ingestFile(files[0]);
    const tooBig = files.find((f) => f.size > 800 * 1024 * 1024);
    if (tooBig && !confirm(`Certains fichiers dépassent 800 Mo — l'envoi et le traitement seront longs. Continuer ?`)) return;
    setBusy("ingest"); setJob(null);
    let okCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setMulti({ i: i + 1, n: files.length, name: f.name }); setUploadPct(0);
      const { data, error } = await mediaUploadFileChunked(sel, f, f.type.startsWith("audio/") ? "audio" : kind, (p) => setUploadPct(p), segLen);
      if (error || !data?.jobId) { alert(`« ${f.name} » : ${error || "échec"} — on passe au suivant.`); continue; }
      okCount++;
    }
    setUploadPct(null); setMulti(null); setBusy("");
    loadJobs(sel); pollAllJobs(sel);
    if (okCount) alert(`${okCount}/${files.length} vidéo(s) envoyée(s) — la découpe tourne en arrière-plan.`);
  };

  const delDs = async (id: number) => { if (!confirm("Supprimer ce dataset et tous ses clips ?")) return; await mediaDeleteDataset(id); if (sel === id) setSel(null); loadDatasets(); };
  const toggleDs = async (d: VideoDataset) => { await mediaUpdateDataset(d.id, { active: !d.active }); loadDatasets(); };

  if (!ready) return <Center><Loader2 size={26} className="spin" /></Center>;
  if (!isAdmin) return <Center><div style={{ color: "var(--text-muted)" }}>Accès admin requis. <button onClick={() => router.push("/")} style={linkBtn}>Accueil</button></div></Center>;

  const selDs = datasets.find((d) => d.id === sel) ?? null;

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 24px)" }}>
      <TopBar />
      <BottomNav />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "18px 18px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--accent-green-soft)", color: "var(--accent-green)" }}><Film size={22} /></div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 900 }}>Studio Vidéo</h1>
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Découpe des vidéos en shorts à transcrire · 15 pts / transcription</div>
          </div>
          <button onClick={() => { loadDatasets(); if (sel) loadJobs(sel); }} style={iconBtn} title="Rafraîchir"><RefreshCw size={16} /></button>
        </div>

        {/* Global toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, marginBottom: 12, border: `1px solid ${enabled ? "var(--accent-green)" : "var(--border)"}`, background: enabled ? "var(--accent-green-soft)" : "var(--surface-1)" }}>
          <Power size={18} style={{ color: enabled ? "var(--accent-green)" : "var(--text-muted)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.86rem" }}>Annotation média (vidéo / audio)</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{enabled ? "Activée — des clips sont servis aux contributeurs (en plus du texte)" : "Désactivée — seules les phrases texte sont servies"}</div>
          </div>
          <Switch on={enabled} onClick={toggleGlobal} />
        </div>

        {/* Toggle: mandatory transcription (no skip) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16, marginBottom: 12, border: `1px solid ${noSkip ? "var(--accent)" : "var(--border)"}`, background: "var(--surface-1)" }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.86rem" }}>Transcription obligatoire (pas de « Passer »)</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{noSkip ? "Activée — le contributeur DOIT transcrire le clip (bouton Passer masqué)" : "Désactivée — le contributeur peut passer un clip"}</div>
          </div>
          <Switch on={noSkip} onClick={toggleNoSkip} />
        </div>

        {/* Toggle: media only (serve ONLY clips until exhausted) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16, marginBottom: 12, border: `1px solid ${mediaOnly ? "var(--accent)" : "var(--border)"}`, background: "var(--surface-1)", opacity: enabled ? 1 : 0.6 }}>
          <span style={{ fontSize: 18 }}>🎬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.86rem" }}>Média uniquement (finir les vidéos)</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{mediaOnly ? "Activé — on sert SEULEMENT des clips (tous les datasets actifs, à la suite) jusqu'à épuisement, puis le texte reprend" : "Désactivé — alternance vidéo / texte (1 sur 2)"}</div>
          </div>
          <Switch on={mediaOnly} onClick={toggleMediaOnly} />
        </div>

        {/* Toggle: assisted correction (AI draft served to the crowd) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 16, marginBottom: 12, border: `1px solid ${assist ? "var(--accent-green)" : "var(--border)"}`, background: assist ? "var(--accent-green-soft)" : "var(--surface-1)", opacity: enabled ? 1 : 0.6 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.86rem" }}>Correction assistée (IA)</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{assist ? "Activé — la foule reçoit un brouillon IA (gpt-4o-transcribe) à corriger (3–4× plus rapide)" : "Désactivé — la foule transcrit de zéro"}</div>
          </div>
          <Switch on={assist} onClick={toggleAssist} />
        </div>

        {/* Diversity dashboard: global hours + per speaker */}
        {stats && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 16, marginBottom: 12, background: "var(--surface-1)", overflow: "hidden" }}>
            <button onClick={() => setShowStats((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "0.86rem", color: "var(--text-primary)" }}>Diversité du corpus</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}><b style={{ color: "var(--accent-green)" }}>{stats.totalHours} h</b> · {stats.speakers.filter((s) => s.name !== "Non étiqueté").length} locuteur(s) étiqueté(s) · {stats.totalClips} shorts</div>
              </div>
              <span style={{ color: "var(--text-muted)", transform: showStats ? "rotate(90deg)" : "none", transition: ".15s" }}>▶</span>
            </button>
            {showStats && (
              <div style={{ padding: "8px 16px 14px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  <span style={{ flex: 1 }}>Locuteur</span><span style={{ width: 30 }}>Sexe</span><span style={{ width: 55, textAlign: "right" }}>Heures</span><span style={{ width: 55, textAlign: "right" }}>Shorts</span>
                </div>
                {stats.speakers.map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: "0.78rem" }}>
                    <span style={{ flex: 1, fontWeight: 600, color: s.name === "Non étiqueté" ? "var(--text-muted)" : "var(--text-primary)" }}>{s.name}</span>
                    <span style={{ width: 30, color: "var(--text-secondary)" }}>{s.sex || "—"}</span>
                    <span style={{ width: 55, textAlign: "right", color: "var(--accent-green)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.hours}</span>
                    <span style={{ width: 55, textAlign: "right", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{s.clips}</span>
                  </div>
                ))}

                {cheaters.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", color: "var(--danger)", marginBottom: 6 }}>⚠️ Relecteurs à surveiller (pièges)</div>
                    {cheaters.map((c, k) => {
                      const failRate = c.hp_seen ? Math.round((c.hp_failed / c.hp_seen) * 100) : 0;
                      return (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: "1px solid var(--border)", fontSize: "0.76rem" }}>
                          <span style={{ flex: 1, fontWeight: 600, color: failRate >= 50 ? "var(--danger)" : "var(--text-primary)" }}>{c.name}</span>
                          <span style={{ color: failRate >= 50 ? "var(--danger)" : "var(--text-muted)", fontWeight: 700 }} title="Pièges ratés / vus">🪤 {c.hp_failed}/{c.hp_seen}</span>
                          <span style={{ width: 90, textAlign: "right", color: "var(--text-muted)" }} title="Soumissions assistées sans aucune édition">0-édit : {c.no_edit}/{c.assisted}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <Layers size={13} style={{ color: "var(--primary)" }} /> Activité <b>séparée</b> du texte — un short n'est jamais servi 2 fois au même contributeur.
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button onClick={() => setView("datasets")} style={{ ...tab, ...(view === "datasets" ? tabOn : {}) }}><Database size={14} /> Datasets</button>
          <button onClick={() => setView("history")} style={{ ...tab, ...(view === "history" ? tabOn : {}) }}><History size={14} /> Historique</button>
        </div>

        {view === "datasets" && (
          <>
            {/* Create dataset */}
            <div style={{ ...card, display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau dataset (ex. Marché de Kiffa)" className="input" style={{ flex: 1, borderRadius: 12 }} />
              <button onClick={createDs} disabled={!name.trim() || busy === "create"} className="btn-primary" style={{ padding: "0 18px", borderRadius: 12, fontWeight: 800, opacity: name.trim() ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 7 }}><Plus size={16} /> Créer</button>
            </div>

            {/* Dataset list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {datasets.length === 0 && <div style={{ ...card, color: "var(--text-muted)", fontSize: "0.84rem", textAlign: "center" }}>Aucun dataset. Crée-en un puis importe une vidéo.</div>}
              {datasets.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 14, background: "var(--surface-1)", border: `1px solid ${sel === d.id ? "var(--accent-green)" : d.active ? "rgba(8,221,184,0.3)" : "var(--border)"}`, cursor: "pointer" }} onClick={() => setSel(sel === d.id ? null : d.id)}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--surface-2)", color: d.active ? "var(--accent-green)" : "var(--text-muted)" }}><Database size={17} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>{d.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{d.clips} shorts · {d.transcribed} annotés · {d.active ? "actif" : "inactif"}</div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Switch on={d.active} onClick={() => toggleDs(d)} />
                    <button onClick={() => delDs(d.id)} title="Supprimer" style={iconBtnDanger}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected dataset: ingestion + clips */}
            {selDs && (
              <div style={card}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Scissors size={16} style={{ color: "var(--accent-green)" }} /> {selDs.name}</div>

                {/* Type: video or audio only */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)" }}>Type :</span>
                  <div style={{ display: "inline-flex", padding: 3, borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", gap: 2 }}>
                    {(["video", "audio"] as const).map((k) => (
                      <button key={k} onClick={() => setKind(k)} style={{ padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800, background: kind === k ? "var(--gradient-brand)" : "transparent", color: kind === k ? "var(--on-primary)" : "var(--text-muted)" }}>{k === "video" ? "Vidéo" : "Audio seulement"}</button>
                    ))}
                  </div>
                </div>

                {/* Short duration (cut on silences, ≤ chosen value) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)" }}>Durée :</span>
                  <div style={{ display: "inline-flex", padding: 3, borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--border)", gap: 2 }}>
                    {[15, 20, 30, 60].map((v) => (
                      <button key={v} onClick={() => setSegLen(v)} style={{ padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800, background: segLen === v ? "var(--gradient-brand)" : "transparent", color: segLen === v ? "var(--on-primary)" : "var(--text-muted)" }}>{v}s</button>
                    ))}
                  </div>
                  <span style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>coupe ≤ {segLen}s, calée sur les pauses</span>
                </div>

                {/* YouTube ingest */}
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <Link2 size={15} style={{ color: "var(--text-muted)" }} />
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Colle un lien YouTube…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "0.85rem", padding: "12px 0" }} />
                  </div>
                  <button onClick={ingest} disabled={!url.trim() || busy === "ingest"} className="btn-primary" style={{ padding: "0 16px", borderRadius: 12, fontWeight: 800, opacity: url.trim() ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 7 }}>
                    {busy === "ingest" ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Importer & découper · {segLen}s
                  </button>
                </div>

                {/* Or file upload */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <input ref={fileRef} type="file" accept="video/*,audio/*" multiple style={{ display: "none" }} onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) ingestFiles(fs); e.target.value = ""; }} />
                  <button onClick={() => fileRef.current?.click()} disabled={busy === "ingest"} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10, border: "1px dashed var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700 }}>
                    <Upload size={14} /> …ou importer un ou plusieurs fichiers (vidéo/audio)
                  </button>
                  <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>découpe ≤ {segLen}s sur les silences</span>
                </div>

                {/* UPLOAD progress bar (browser → server transfer) */}
                {uploadPct !== null && (
                  <div style={{ padding: "10px 12px", borderRadius: 12, marginBottom: 14, background: "var(--accent-green-soft)", border: "1px solid var(--accent-green)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 7 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}><Upload size={13} /> {multi ? <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Fichier {multi.i}/{multi.n} · {multi.name}</span> : "Téléversement…"}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{uploadPct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
                      <div style={{ width: `${uploadPct}%`, height: "100%", background: "var(--accent-green)", borderRadius: 999, transition: "width .2s" }} />
                    </div>
                    {uploadPct >= 100 && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 6 }}>Upload terminé — préparation de la découpe…</div>}
                  </div>
                )}

                {/* Job status (server-side cutting) */}
                {job && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, marginBottom: 14, background: job.status === "error" ? "rgba(248,113,113,0.08)" : "var(--accent-green-soft)", border: `1px solid ${job.status === "error" ? "rgba(248,113,113,0.3)" : "var(--accent-green)"}` }}>
                    {job.status !== "done" && job.status !== "error" ? <Loader2 size={15} className="spin" style={{ color: "var(--accent-green)" }} /> : null}
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: job.status === "error" ? "var(--danger)" : "var(--text-primary)" }}>{jobLabel(job)}</span>
                  </div>
                )}

                {/* Videos → shorts (dataset → video → shorts) */}
                {jobs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "0.82rem" }}>Aucune vidéo. Importe une vidéo ci-dessus.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Vidéos ({jobs.length})</div>
                    {jobs.map((j) => (
                      <VideoSection key={j.id} job={j} datasetId={sel!} onReassemble={() => openReassembly(j.id)} onChanged={() => { loadDatasets(); loadJobs(sel!); loadStats(); }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Reassembly modal: ordered timestamped transcript */}
        {reasm && <ReassemblyModal data={reasm} onClose={() => setReasm(null)} />}

        {view === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.length === 0 ? (
              <div style={{ ...card, textAlign: "center", color: "var(--text-muted)", fontSize: "0.84rem" }}>Aucune annotation pour l'instant.</div>
            ) : history.map((h) => <HistoryRow key={h.id} h={h} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function jobLabel(j: MediaJob) {
  if (j.status === "downloading") return "Téléchargement de la vidéo…";
  if (j.status === "cutting") return j.message || "Découpe en cours…";
  if (j.status === "done") return `✅ ${j.clips_created} shorts créés`;
  if (j.status === "error") return `Erreur : ${j.message}`;
  return "En attente…";
}

// Authenticated playback (/recordings/* require a token → fetch blob).
function AuthMedia({ src, kind }: { src: string; kind: string }) {
  const [blob, setBlob] = useState("");
  useEffect(() => { let u = ""; fetchAuthAudio(src).then((b) => { u = b; setBlob(b); }); return () => { if (u) URL.revokeObjectURL(u); }; }, [src]);
  if (!blob) return <div style={{ aspectRatio: kind === "audio" ? undefined : "16 / 10", height: kind === "audio" ? 40 : undefined, display: "grid", placeItems: "center", background: "#000", color: "var(--text-muted)" }}><Loader2 size={18} className="spin" /></div>;
  return kind === "audio"
    ? <audio src={blob} controls style={{ width: "100%" }} />
    : <video src={blob} controls playsInline style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block", background: "#000" }} />;
}

// A collapsible video (ingestion) → its shorts loaded on demand.
function VideoSection({ job, datasetId, onReassemble, onChanged }: { job: MediaJob; datasetId: number; onReassemble: () => void; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState("");
  const [showOrig, setShowOrig] = useState(false);
  const [spk, setSpk] = useState({ name: job.speaker_name || "", sex: job.speaker_sex || "", type: job.video_type || "" });
  const [clean, setClean] = useState<{ running: boolean; removed: number; kept: number } | null>(null);
  const active = !["done", "error"].includes(job.status);
  const err = job.status === "error";

  const load = async () => { setLoading(true); const { data } = await mediaListClips(datasetId, 0, 500, job.id); setClips(data?.clips ?? []); setLoaded(true); setLoading(false); };
  const toggle = () => { const n = !open; setOpen(n); if (n && !loaded) load(); };
  const ids = clips.map((c) => c.id);
  const selIds = ids.filter((id) => sel[id]);
  const allSel = ids.length > 0 && selIds.length === ids.length;
  const del = async (id: number) => { await mediaDeleteClip(id); await load(); onChanged(); };
  const bulkDel = async () => { if (!selIds.length || !confirm(`Supprimer ${selIds.length} short(s) ?`)) return; setBusy("del"); await mediaDeleteClips(selIds); setSel({}); setBusy(""); await load(); onChanged(); };
  const recut = async (rids: number[]) => {
    if (!rids.length) return;
    const v = prompt("Recouper en combien de secondes ? (5–60)", "15"); if (v === null) return;
    const sl = Math.max(5, Math.min(60, parseInt(v, 10) || 15));
    setBusy("recut"); let created = 0;
    for (const id of rids) { const { data } = await mediaRecutClip(id, sl); created += data?.created ?? 0; }
    setSel({}); setBusy(""); await load(); onChanged();
    alert(created > 0 ? `${created} nouveaux shorts créés.` : "Rien à recouper (déjà assez court).");
  };
  const saveTag = (patch: Partial<typeof spk>) => { const next = { ...spk, ...patch }; setSpk(next); mediaUpdateJob(job.id, { speaker_name: next.name, speaker_sex: next.sex, video_type: next.type }).then(onChanged); };
  const runClean = async () => {
    if (!confirm("Retirer les shorts SANS PAROLE (silence / musique) de cette vidéo ?\n(Les shorts déjà transcrits par des humains sont préservés.)")) return;
    setClean({ running: true, removed: 0, kept: 0 });
    let after = 0, removed = 0, kept = 0, done = false, guard = 0;
    while (!done && guard++ < 3000) {
      const { data, error } = await mediaCleanVideo(job.id, after, 8);
      if (error || !data) break;
      removed += data.removed; kept += data.kept; after = data.lastId; done = data.done;
      setClean({ running: !done, removed, kept });
    }
    setClean({ running: false, removed, kept });
    await load(); onChanged();
  };
  const sel2: React.CSSProperties = { padding: "7px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.76rem", fontFamily: "inherit", cursor: "pointer" };

  return (
    <div style={{ border: `1px solid ${active ? "var(--accent-green)" : "var(--border)"}`, borderRadius: 14, overflow: "hidden", background: "var(--surface-1)" }}>
      <button onClick={toggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
        <Film size={16} style={{ color: err ? "var(--danger)" : "var(--accent-green)", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: "0.84rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={err ? job.message : job.source}>{job.source || `Vidéo #${job.id}`}</span>
        <span style={{ flexShrink: 0, fontSize: "0.66rem", fontWeight: 800, color: err ? "var(--danger)" : active ? "var(--accent-green)" : "var(--text-muted)" }}>
          {active ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Loader2 size={11} className="spin" /> {jobLabel(job)}</span> : err ? "❌ erreur" : `${job.clips_created} shorts`}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {/* Speaker metadata */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <input value={spk.name} onChange={(e) => setSpk((s) => ({ ...s, name: e.target.value }))} onBlur={() => saveTag({})} placeholder="👤 Nom du locuteur" style={{ flex: "1 1 160px", minWidth: 120, padding: "7px 10px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.78rem" }} />
            <select value={spk.sex} onChange={(e) => saveTag({ sex: e.target.value })} style={sel2}><option value="">Sexe</option><option value="M">Homme</option><option value="F">Femme</option></select>
            <select value={spk.type} onChange={(e) => saveTag({ type: e.target.value })} style={sel2}><option value="">Type</option><option value="live">Live</option><option value="programme">Programme</option><option value="interview">Interview</option><option value="autre">Autre</option></select>
          </div>
          {/* Cleanup: keep only speech */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 2px", flexWrap: "wrap" }}>
            <button onClick={runClean} disabled={clean?.running} style={{ ...ghostBtnSm, opacity: clean?.running ? 0.7 : 1 }}>
              {clean?.running ? <><Loader2 size={12} className="spin" /> Nettoyage… ({clean.removed} retirés)</> : <>🧹 Nettoyer (parole seulement)</>}
            </button>
            {clean && !clean.running && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>✓ {clean.removed} retiré(s) · {clean.kept} gardé(s)</span>}
            <span style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>retire silence/musique, garde la voix</span>
          </div>
          {job.original_url && (
            <div style={{ marginTop: 12 }}>
              {!showOrig ? <button onClick={() => setShowOrig(true)} style={ghostBtnSm}>🎬 Voir la vidéo complète</button>
                : job.original_kind === "audio"
                  ? <audio src={job.original_url} controls style={{ width: "100%" }} />
                  : <video src={job.original_url} controls playsInline style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 300, display: "block" }} />}
            </div>
          )}
          {loading ? <div style={{ padding: "18px 0", textAlign: "center", color: "var(--text-muted)" }}><Loader2 size={16} className="spin" /></div>
            : clips.length === 0 ? <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>{active ? "Découpe en cours…" : err ? `Erreur : ${job.message}` : "Aucun short."}</div>
              : <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>{clips.length} shorts</span>
                  <button onClick={() => setSel(allSel ? {} : Object.fromEntries(ids.map((id) => [id, true])))} style={ghostBtnSm}>{allSel ? "Tout désélectionner" : "Tout sélectionner"}</button>
                  <button disabled={!selIds.length || busy === "recut"} onClick={() => recut(selIds)} style={{ ...ghostBtnSm, opacity: selIds.length ? 1 : 0.45 }}>✂️ Recouper ({selIds.length})</button>
                  <button disabled={!selIds.length || busy === "del"} onClick={bulkDel} style={{ ...ghostBtnSm, borderColor: "rgba(248,113,113,0.3)", color: "var(--danger)", opacity: selIds.length ? 1 : 0.45 }}>🗑️ Supprimer ({selIds.length})</button>
                  <button onClick={onReassemble} style={ghostBtnSm}>📄 Réassembler</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {clips.map((c) => <ClipCard key={c.id} clip={c} selected={!!sel[c.id]} onToggle={() => setSel((s) => ({ ...s, [c.id]: !s[c.id] }))} onDelete={() => del(c.id)} onRecut={() => recut([c.id])} />)}
                </div>
              </>}
        </div>
      )}
    </div>
  );
}

function ClipCard({ clip, selected, onToggle, onDelete, onRecut }: { clip: VideoClip; selected: boolean; onToggle: () => void; onDelete: () => void; onRecut: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${selected ? "var(--accent-green)" : "var(--border)"}`, background: "var(--surface-2)" }}>
      <div style={{ position: "relative", background: "#000", minHeight: clip.kind === "audio" ? 0 : 120 }}>
        {open ? <AuthMedia src={clip.media_url} kind={clip.kind} /> : (
          <button onClick={() => setOpen(true)} style={{ width: "100%", aspectRatio: clip.kind === "audio" ? undefined : "16 / 10", padding: clip.kind === "audio" ? "16px 0" : 0, border: "none", cursor: "pointer", background: "#000", color: "#fff", display: "grid", placeItems: "center" }}>
            <span style={{ width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--accent-green)", color: "#04221d", boxShadow: "0 8px 22px rgba(8,221,184,0.45)" }}><Play size={20} fill="currentColor" style={{ marginLeft: 2 }} /></span>
          </button>
        )}
        <label style={{ position: "absolute", top: 7, insetInlineStart: 7, display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 6, background: "rgba(10,10,10,0.55)", cursor: "pointer" }}>
          <input type="checkbox" checked={selected} onChange={onToggle} style={{ cursor: "pointer" }} />
        </label>
        <span style={{ position: "absolute", bottom: 7, insetInlineEnd: 7, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 999, background: "rgba(10,10,10,0.6)", color: "#fff", fontSize: "0.6rem", fontWeight: 800 }}><Clock size={9} /> {fmtT(clip.duration_ms)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", gap: 6 }}>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clip.kind === "audio" ? "Audio" : "Vidéo"} · {clip.times_transcribed} tr.</span>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <button onClick={async () => { const d = prompt("🪤 Brouillon FAUX à servir (le contributeur qui le valide tel quel sera repéré) :"); if (d && d.trim().length >= 2) { const { error } = await mediaSetHoneypot(clip.id, d.trim()); alert(error || "Piège créé ✓"); } }} title="Marquer comme piège (honeypot)" style={{ ...iconBtnDanger, borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)" }}>🪤</button>
          <button onClick={onRecut} title="Recouper en plus court" style={{ ...iconBtnDanger, borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)" }}><Scissors size={13} /></button>
          <button onClick={onDelete} title="Supprimer ce short" style={iconBtnDanger}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ h }: { h: MediaHistoryItem }) {
  const approved = h.status === "approved";
  return (
    <div style={{ display: "flex", gap: 12, padding: 12, borderRadius: 14, background: "var(--surface-1)", border: "1px solid var(--border)", flexWrap: "wrap" }}>
      <div style={{ width: 180, flexShrink: 0, borderRadius: 12, overflow: "hidden" }}><AuthMedia src={h.media_url} kind={h.kind} /></div>
      <div style={{ flex: 1, minWidth: 170 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 6 }}>
          <span style={{ fontWeight: 800, color: "var(--text-secondary)" }}>{h.username}</span>
          <span>· {h.dataset}</span>
          <span>· {new Date(h.created_at).toLocaleString()}</span>
          <span style={{ padding: "2px 7px", borderRadius: 999, fontWeight: 800, background: approved ? "rgba(16,185,129,0.12)" : "rgba(217,119,6,0.12)", color: approved ? "var(--success)" : "#d97706" }}>{approved ? "validée" : "en attente"}</span>
        </div>
        <p dir="rtl" style={{ fontSize: "1.02rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.7 }}>{h.text}</p>
      </div>
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, position: "relative", background: on ? "var(--accent-green)" : "var(--surface-2)" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: on ? "#04221d" : "var(--text-muted)", transition: "left .2s" }} />
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-dark)" }}>{children}</div>;
}

// Reassembly: ordered timestamped transcript + export (.txt / .srt).
function ReassemblyModal({ data, onClose }: { data: { jobId: number; clips: ReassemblyClip[] }; onClose: () => void }) {
  const ts = (ms: number | null) => { const s = Math.floor((ms ?? 0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const srtTs = (ms: number | null) => { const t = ms ?? 0; const h = Math.floor(t / 3600000), m = Math.floor((t % 3600000) / 60000), s = Math.floor((t % 60000) / 1000), ml = t % 1000; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ml).padStart(3, "0")}`; };
  const pick = (c: ReassemblyClip) => c.transcriptions.find((t) => t.status === "approved")?.text ?? c.transcriptions[0]?.text ?? "";
  const transcript = data.clips.map(pick).filter(Boolean).join(" ");
  const srt = data.clips.map((c, i) => `${i + 1}\n${srtTs(c.start_ms)} --> ${srtTs(c.end_ms)}\n${pick(c) || "[—]"}\n`).join("\n");
  const dl = (content: string, name: string) => { const b = new Blob([content], { type: "text/plain;charset=utf-8" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const doneCount = data.clips.filter((c) => c.transcriptions.length > 0).length;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 96vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--bg-card, var(--surface-1))", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: "0.95rem" }}>Réassemblage — {data.clips.length} shorts ordonnés</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{doneCount}/{data.clips.length} transcrits · transcript horodaté dans l'ordre exact</div>
          </div>
          <button onClick={onClose} style={{ ...iconBtn, width: 32, height: 32 }}>✕</button>
        </div>
        <div style={{ padding: "12px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {data.clips.map((c, i) => {
            const txt = pick(c);
            return (
              <div key={c.id} style={{ display: "flex", gap: 10, padding: "9px 11px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <span style={{ flexShrink: 0, fontSize: "0.64rem", fontFamily: "ui-monospace,monospace", color: "var(--accent-green)", fontWeight: 800, paddingTop: 2 }}>{ts(c.start_ms)}→{ts(c.end_ms)}</span>
                <span dir="rtl" style={{ flex: 1, fontSize: "0.9rem", fontFamily: "'Cairo',sans-serif", lineHeight: 1.6, color: txt ? "var(--text-primary)" : "var(--text-muted)" }}>{txt || `#${i + 1} — pas encore transcrit`}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
          <button onClick={() => navigator.clipboard?.writeText(transcript)} style={{ ...ghostBtnSm }}>📋 Copier le transcript</button>
          <button onClick={() => dl(transcript, `transcript_${data.jobId}.txt`)} style={{ ...ghostBtnSm }}>⬇ .txt</button>
          <button onClick={() => dl(srt, `transcript_${data.jobId}.srt`)} style={{ ...ghostBtnSm }}>⬇ .srt (horodaté)</button>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: 18 };
const tab: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-muted)", fontWeight: 800, fontSize: "0.8rem" };
const tabOn: React.CSSProperties = { background: "var(--gradient-brand)", color: "var(--on-primary)", border: "1px solid transparent" };
const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)", cursor: "pointer", display: "grid", placeItems: "center" };
const iconBtnDanger: React.CSSProperties = { width: 32, height: 32, borderRadius: 9, flexShrink: 0, border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.07)", color: "var(--danger)", cursor: "pointer", display: "grid", placeItems: "center" };
const linkBtn: React.CSSProperties = { border: "none", background: "transparent", color: "var(--accent-green)", cursor: "pointer", fontWeight: 700, textDecoration: "underline" };
const ghostBtnSm: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.74rem", fontWeight: 700 };
