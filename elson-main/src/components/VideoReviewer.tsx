"use client";

/**
 * Reviewer · VIDEO mode — interactive transcript (YouTube/Coursera style).
 * Premium custom player with a UNIFIED TIMELINE: all shorts of a video form
 * a SINGLE segmented bar, continuous playback, global position synced with the
 * text blocks on the right (click a block ↔ jump the player, and vice versa). Grammarly-style
 * editing, autosave, SRT/VTT/TXT export.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Play, Pause, Download, ChevronDown, Loader2, Check, FileText, RotateCcw, RotateCw, Maximize2, Gauge, AudioLines, User, Languages, Sparkles } from "lucide-react";
import { getReviewVideos, getReviewVideo, saveVideoSegment, aiTranscribeSegment, aiTranslateSegment, type ReviewVideo, type ReviewSegment } from "@/lib/api";
import { HassaniyaInput } from "@/components/HassaniyaInput";

type Seg = ReviewSegment & { dirty?: boolean; saving?: boolean; saved?: boolean; trDirty?: boolean; trSaving?: boolean; trSaved?: boolean; aiBusy?: boolean; aiTrBusy?: boolean };
const pad = (n: number, l = 2) => String(n).padStart(l, "0");
const clk = (s: number) => `${pad(Math.floor((s || 0) / 60))}:${pad(Math.floor(s || 0) % 60)}`;
const srt = (ms: number) => { const t = Math.max(0, Math.floor(ms || 0)); return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t % 3600000 / 60000))}:${pad(Math.floor(t % 60000 / 1000))},${pad(t % 1000, 3)}`; };
const SPEEDS = [0.75, 1, 1.25, 1.5];
const segDur = (s: ReviewSegment) => Math.max(0.1, ((s.duration_ms || (s.end_ms - s.start_ms) || 5000)) / 1000);

/* ─────────── Custom player · unified timeline ─────────── */
function Player({ segments, kind, title, seekToken, onActive }: { segments: Seg[]; kind: string; title: string; seekToken: { idx: number; n: number }; onActive: (i: number) => void }) {
  const vRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(0);
  const speedRef = useRef(1);
  const [idx, setIdx] = useState(0);
  const [local, setLocal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [hover, setHover] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { durs, offsets, total } = useMemo(() => {
    const d = segments.map(segDur); const o: number[] = []; let acc = 0;
    for (const x of d) { o.push(acc); acc += x; }
    return { durs: d, offsets: o, total: acc };
  }, [segments]);
  const globalPos = (offsets[idx] || 0) + local;

  // Load the current short
  useEffect(() => {
    const v = vRef.current, seg = segments[idx]; if (!v || !seg) return;
    v.src = seg.media_url; v.playbackRate = speedRef.current;
    const onmeta = () => { if (pending.current != null) { v.currentTime = pending.current; pending.current = null; } v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); v.removeEventListener("loadedmetadata", onmeta); };
    v.addEventListener("loadedmetadata", onmeta);
    onActive(idx);
    return () => v.removeEventListener("loadedmetadata", onmeta);
    // eslint-disable-next-line
  }, [idx, segments]);

  // Jump requested from the transcript
  useEffect(() => { if (seekToken.n > 0) jumpSeg(seekToken.idx); /* eslint-disable-next-line */ }, [seekToken.n]);

  const jumpSeg = (i: number) => { if (i === idx) { const v = vRef.current; if (v) { v.currentTime = 0; v.play(); } } else { pending.current = 0; setIdx(i); } };
  const seekGlobal = (T: number) => {
    let j = 0; while (j < offsets.length - 1 && T >= offsets[j + 1]) j++;
    const lt = Math.max(0, T - offsets[j]);
    if (j === idx) { if (vRef.current) vRef.current.currentTime = lt; } else { pending.current = lt; setIdx(j); }
  };
  const toggle = () => { const v = vRef.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  const cycleSpeed = () => { const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(s); speedRef.current = s; if (vRef.current) vRef.current.playbackRate = s; };
  const fs = () => { const w = wrapRef.current as any; if (!document.fullscreenElement) (w?.requestFullscreen || w?.webkitRequestFullscreen)?.call(w); else document.exitFullscreen(); };
  const onEnded = () => { if (idx < segments.length - 1) { pending.current = 0; setIdx(idx + 1); } else setPlaying(false); };
  const wake = () => { setHover(true); if (hideT.current) clearTimeout(hideT.current); hideT.current = setTimeout(() => { if (!vRef.current?.paused) setHover(false); }, 2400); };

  const pieceSeek = (e: React.PointerEvent<HTMLDivElement>, j: number) => { const r = e.currentTarget.getBoundingClientRect(); const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); seekGlobal(offsets[j] + f * durs[j]); };
  const isAudio = kind === "audio";

  return (
    <div ref={wrapRef} className={"vr-stage" + (hover || !playing ? " show" : "")} onMouseMove={wake} onMouseLeave={() => playing && setHover(false)}>
      <video ref={vRef} playsInline className="vr-video" onClick={toggle}
        onPlay={() => { setPlaying(true); wake(); }} onPause={() => { setPlaying(false); setHover(true); }}
        onTimeUpdate={(e) => setLocal(e.currentTarget.currentTime)}
        onWaiting={() => setBuffering(true)} onPlaying={() => setBuffering(false)} onEnded={onEnded} />
      {isAudio && <div className="vr-audioposter"><AudioLines size={54} /><span>{title}</span></div>}
      {buffering && <div className="vr-spinner"><Loader2 size={34} className="vr-spin" /></div>}
      {!playing && !buffering && <button className="vr-bigplay" onClick={toggle} aria-label="Lecture"><Play size={30} fill="currentColor" /></button>}

      <div className="vr-controls">
        {/* Segmented timeline (1 piece per short, width ∝ duration) */}
        <div className="vr-scrub">
          {segments.map((s, j) => {
            const f = Math.min(1, Math.max(0, (globalPos - offsets[j]) / durs[j]));
            return <div key={s.id} className={"vr-piece" + (j === idx ? " cur" : "")} style={{ flexGrow: durs[j] }} onPointerDown={(e) => pieceSeek(e, j)} title={`Séquence ${j + 1}`}><div className="vr-piecefill" style={{ width: f * 100 + "%" }} /></div>;
          })}
        </div>
        <div className="vr-ctrlrow">
          <button onClick={toggle} className="vr-cbtn vr-cmain">{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
          <button onClick={() => seekGlobal(globalPos - 5)} className="vr-cbtn" title="-5s"><RotateCcw size={15} /></button>
          <button onClick={() => seekGlobal(globalPos + 5)} className="vr-cbtn" title="+5s"><RotateCw size={15} /></button>
          <span className="vr-time">{clk(globalPos)} <i>/</i> {clk(total)}</span>
          <span className="vr-segno">seq {idx + 1}/{segments.length}</span>
          <div className="vr-spacer" />
          <button onClick={cycleSpeed} className="vr-cbtn vr-speed" title="Vitesse"><Gauge size={14} />{speed}×</button>
          <button onClick={fs} className="vr-cbtn" title="Plein écran"><Maximize2 size={15} /></button>
        </div>
      </div>
    </div>
  );
}

export function VideoReviewer() {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSegs, setLoadingSegs] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [seekToken, setSeekToken] = useState({ idx: 0, n: 0 });
  const [showTr, setShowTr] = useState(true);
  const [trLang, setTrLang] = useState<"fr" | "ar" | "en">("fr");
  const [bulk, setBulk] = useState<{ busy: boolean; done: number; total: number }>({ busy: false, done: 0, total: 0 });
  const [bulkTr, setBulkTr] = useState<{ busy: boolean; done: number; total: number }>({ busy: false, done: 0, total: 0 });

  useEffect(() => { (async () => { const r = await getReviewVideos(); setVideos(r.data?.videos || []); setLoading(false); })(); }, []);

  const openVideo = async (jobId: number) => {
    setSel(jobId); setLoadingSegs(true); setActiveIdx(0); setSeekToken({ idx: 0, n: 0 });
    const r = await getReviewVideo(jobId);
    setSegments(r.data?.segments || []); setLoadingSegs(false);
  };
  const onActive = useCallback((i: number) => { setActiveIdx(i); setTimeout(() => document.getElementById(`vrseg-${i}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50); }, []);
  const playSeg = (i: number) => setSeekToken((t) => ({ idx: i, n: t.n + 1 }));

  const saveField = async (id: number, field: "text" | "translation", value: string) => {
    setSegments((prev) => prev.map((s) => s.id === id ? { ...s, ...(field === "text" ? { saving: true } : { trSaving: true }) } : s));
    const { error } = await saveVideoSegment(id, field === "text" ? { text: value.trim() } : { translation: value.trim() });
    setSegments((prev) => prev.map((s) => s.id === id ? { ...s, ...(field === "text" ? { saving: false, dirty: false, saved: !error } : { trSaving: false, trDirty: false, trSaved: !error }) } : s));
  };
  // Editing = mark as "modified" (NO save on every keystroke).
  const onEdit = (id: number, value: string) => setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text: value, dirty: true, saved: false } : s));
  const onEditTr = (id: number, value: string) => setSegments((prev) => prev.map((s) => s.id === id ? { ...s, translation: value, trDirty: true, trSaved: false } : s));
  // Save when LEAVING the field (blur), only if modified.
  const commitText = (s: Seg) => { if (s.dirty) saveField(s.id, "text", s.text); };
  const commitTr = (s: Seg) => { if (s.trDirty) saveField(s.id, "translation", s.translation); };
  // "Verified" = I finish this sequence → save everything + move to the next one.
  const verifySeg = (s: Seg, i: number) => { saveField(s.id, "text", s.text); if ((s.translation || "").trim() || s.trDirty) saveField(s.id, "translation", s.translation); if (i < segments.length - 1) playSeg(i + 1); };
  // AI pre-annotation → stored in ai_draft (separate column). Overwrites NOTHING.
  const preFill = async (s: Seg) => {
    setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, aiBusy: true } : x));
    const { data, error } = await aiTranscribeSegment(s.id);
    setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, aiBusy: false, ...(data && !error ? { ai_draft: data.text } : {}) } : x));
    if (error) alert(error);
  };
  // "Use" the AI draft → copies it into the editable field (to be corrected), without touching the draft.
  const useDraft = (s: Seg) => setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, text: x.ai_draft, dirty: true, saved: false } : x));
  // Pre-fill the WHOLE video (only shorts without a draft), 4 in parallel.
  const preFillAll = async () => {
    if (bulk.busy) return;
    const targets = segments.filter((s) => !(s.ai_draft || "").trim());
    if (!targets.length) { alert("Toutes les séquences ont déjà un brouillon IA."); return; }
    const cost = (targets.reduce((a, s) => a + segDur(s), 0) / 60) * 0.006;
    if (!confirm(`Pré-remplir ${targets.length} séquence(s) avec l'IA (gpt-4o-transcribe) ?\nCoût estimé ≈ $${cost.toFixed(2)}.`)) return;
    setBulk({ busy: true, done: 0, total: targets.length });
    const queue = [...targets]; let done = 0;
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift(); if (!s) break;
        const { data, error } = await aiTranscribeSegment(s.id);
        if (data && !error) setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, ai_draft: data.text } : x));
        done++; setBulk((b) => ({ ...b, done }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    setBulk({ busy: false, done: 0, total: 0 });
  };
  // AI pre-translation (gpt-5.5) → stored in ai_translation (separate). Transcribes first if needed.
  const preTranslate = async (s: Seg) => {
    setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, aiTrBusy: true } : x));
    const { data, error } = await aiTranslateSegment(s.id, trLang);
    setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, aiTrBusy: false, ...(data && !error ? { ai_translation: data.text, ...(!(x.ai_draft || "").trim() && data.source ? { ai_draft: data.source } : {}) } : {}) } : x));
    if (error) alert(error);
  };
  const useTranslation = (s: Seg) => setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, translation: x.ai_translation, trDirty: true, trSaved: false } : x));
  const preTranslateAll = async () => {
    if (bulkTr.busy) return;
    const targets = segments.filter((s) => !(s.ai_translation || "").trim());
    if (!targets.length) { alert("Toutes les séquences ont déjà une traduction IA."); return; }
    if (!confirm(`Pré-traduire ${targets.length} séquence(s) en ${trLang.toUpperCase()} (gpt-5.5) ?\n(Transcrit d'abord les séquences sans texte.)`)) return;
    setBulkTr({ busy: true, done: 0, total: targets.length });
    const queue = [...targets]; let done = 0;
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift(); if (!s) break;
        const { data, error } = await aiTranslateSegment(s.id, trLang);
        if (data && !error) setSegments((prev) => prev.map((x) => x.id === s.id ? { ...x, ai_translation: data.text, ...(!(x.ai_draft || "").trim() && data.source ? { ai_draft: data.source } : {}) } : x));
        done++; setBulkTr((b) => ({ ...b, done }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
    setBulkTr({ busy: false, done: 0, total: 0 });
  };

  const dl = (name: string, content: string) => { const b = new Blob([content], { type: "text/plain;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  const expSrt = () => dl(`transcription_${sel}.srt`, segments.map((s, i) => `${i + 1}\n${srt(s.start_ms)} --> ${srt(s.end_ms)}\n${(s.text || "").trim()}\n`).join("\n"));
  const expVtt = () => dl(`transcription_${sel}.vtt`, "WEBVTT\n\n" + segments.map((s) => `${srt(s.start_ms).replace(",", ".")} --> ${srt(s.end_ms).replace(",", ".")}\n${(s.text || "").trim()}\n`).join("\n"));
  const expTxt = () => dl(`transcription_${sel}.txt`, segments.map((s) => (s.text || "").trim()).filter(Boolean).join("\n"));

  const curVideo = videos.find((v) => v.id === sel);
  const kind = segments[0]?.kind || "video";
  const reviewed = segments.filter((s) => s.reviewed_text || s.saved).length;
  const progPct = segments.length ? Math.round((reviewed / segments.length) * 100) : 0;
  const totalSec = segments.reduce((a, s) => a + segDur(s), 0);
  const aiCost = (totalSec / 60) * 0.006; // gpt-4o-transcribe ≈ $0.006/min
  const drafted = segments.filter((s) => (s.ai_draft || "").trim()).length;
  const emptyTargets = segments.filter((s) => !(s.ai_draft || "").trim());
  const fillCost = (emptyTargets.reduce((a, s) => a + segDur(s), 0) / 60) * 0.006;
  const trTargets = segments.filter((s) => !(s.ai_translation || "").trim());

  return (
    <div className="vr">
      <style>{CSS}</style>

      <div className="vr-bar">
        <div className="vr-select">
          <label>Vidéo</label>
          <div className="vr-selwrap">
            <select value={sel ?? ""} onChange={(e) => openVideo(Number(e.target.value))}>
              <option value="" disabled>{loading ? "Chargement…" : videos.length ? "Choisir une vidéo…" : "Aucune vidéo transcrite"}</option>
              {videos.map((v, i) => <option key={v.id} value={v.id}>Vidéo {i + 1} · {(v.source || `#${v.id}`).slice(0, 46)} — {v.transcribed}/{v.clips}</option>)}
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        {sel && (
          <div className="vr-exports">
            <label className="vr-trtoggle"><input type="checkbox" checked={showTr} onChange={(e) => setShowTr(e.target.checked)} /><Languages size={13} /> Traductions</label>
            <div className="vr-langsel" title="Langue de traduction IA">
              {(["fr", "ar", "en"] as const).map((l) => <button key={l} className={"vr-lang" + (trLang === l ? " on" : "")} onClick={() => setTrLang(l)}>{l.toUpperCase()}</button>)}
            </div>
            <span className="vr-prog">{reviewed}/{segments.length} relus</span>
            <button onClick={expSrt}><Download size={14} /> SRT</button>
            <button onClick={expVtt}><Download size={14} /> VTT</button>
            <button onClick={expTxt}><FileText size={14} /> TXT</button>
          </div>
        )}
      </div>

      {!sel ? (
        <div className="vr-empty"><div style={{ fontSize: "2.8rem" }}>🎬</div><h3>Transcript interactif</h3><p>Choisis une vidéo : le lecteur (timeline unifiée) à gauche, les séquences à droite. Clique une séquence ou la timeline.</p></div>
      ) : loadingSegs ? (
        <div className="vr-empty"><Loader2 className="vr-spin" size={26} /></div>
      ) : (
        <div className="vr-split">
          <div className="vr-left">
            <Player key={sel} segments={segments} kind={kind} title={curVideo?.source || "Audio"} seekToken={seekToken} onActive={onActive} />
            <div className="vr-meta">
              <div className="vr-vtitle">{curVideo?.source || "Vidéo"}</div>
              <div className="vr-progwrap"><div className="vr-progbar"><i style={{ width: progPct + "%" }} /></div><span>{progPct}% relu</span></div>
              <div className="vr-cost"><Sparkles size={12} /> Coût IA : <b>≈ ${aiCost.toFixed(2)}</b> pour toute la vidéo ({Math.round(totalSec / 60)} min) · {drafted}/{segments.length} pré-remplis</div>
              <button className="vr-fillall" disabled={bulk.busy || emptyTargets.length === 0} onClick={preFillAll}>
                {bulk.busy ? <><Loader2 size={14} className="vr-spin" /> Pré-remplissage {bulk.done}/{bulk.total}…</>
                  : emptyTargets.length === 0 ? <><Check size={14} /> Tout est pré-rempli</>
                    : <><Sparkles size={14} /> Pré-remplir les {emptyTargets.length} vides (≈ ${fillCost.toFixed(2)})</>}
              </button>
              <button className="vr-fillall vr-filltr" disabled={bulkTr.busy || trTargets.length === 0} onClick={preTranslateAll}>
                {bulkTr.busy ? <><Loader2 size={14} className="vr-spin" /> Traduction {bulkTr.done}/{bulkTr.total}…</>
                  : trTargets.length === 0 ? <><Check size={14} /> Tout est traduit</>
                    : <><Languages size={14} /> Tout traduire ({trTargets.length})</>}
              </button>
            </div>
          </div>

          <div className="vr-transcript">
            {segments.map((s, i) => {
              const alts = (s.transcriptions || []).filter((t) => (t.text || "").trim() && (t.text || "").trim() !== (s.text || "").trim());
              const tStat = s.saving ? <Loader2 size={12} className="vr-spin" /> : s.saved ? <span className="vr-ok"><Check size={12} /> enregistré</span> : s.dirty ? <span className="vr-dirty">● …</span> : (s.reviewed_text ? <span className="vr-ok"><Check size={12} /> relu</span> : null);
              const rStat = s.trSaving ? <Loader2 size={12} className="vr-spin" /> : s.trSaved ? <span className="vr-ok"><Check size={12} /> enregistré</span> : s.trDirty ? <span className="vr-dirty">● …</span> : null;
              return (
                <div key={s.id} id={`vrseg-${i}`} className={"vr-card" + (activeIdx === i ? " active" : "")} onClick={() => activeIdx !== i && playSeg(i)}>
                  <div className="vr-cardhead" onClick={(e) => e.stopPropagation()}>
                    <button className="vr-ts" onClick={() => playSeg(i)} title="Lire la séquence"><Play size={10} fill="currentColor" />{i + 1}</button>
                    <span className="vr-cardtime">{clk(s.start_ms / 1000)} → {clk(s.end_ms / 1000)}</span>
                    {s.transcribedBy && <span className="vr-by"><User size={11} /> {s.transcribedBy}</span>}
                  </div>

                  <div className="vr-field" onClick={(e) => e.stopPropagation()} onBlur={() => commitText(s)}>
                    <div className="vr-flabel">Transcription
                      <button className="vr-ai" disabled={s.aiBusy} onClick={() => preFill(s)} title="Pré-remplir avec l'IA (brouillon gpt-4o-transcribe)">{s.aiBusy ? <Loader2 size={11} className="vr-spin" /> : <Sparkles size={11} />} IA</button>
                      <i className="vr-fstat">{tStat}</i></div>
                    <HassaniyaInput value={s.text} onChange={(v) => onEdit(s.id, v)} placeholder="…النص بالحسانية" minHeight={44} />
                  </div>

                  {s.ai_draft && (
                    <div className="vr-aidraft" onClick={(e) => e.stopPropagation()}>
                      <div className="vr-aidraft-h"><span><Sparkles size={11} /> Brouillon IA</span><button className="vr-useai" onClick={() => useDraft(s)} title="Copier dans la transcription (à corriger)">Utiliser ↑</button></div>
                      <div className="vr-aidraft-t">{s.ai_draft}</div>
                    </div>
                  )}

                  {showTr && (
                    <div className="vr-field vr-trfield" onClick={(e) => e.stopPropagation()}>
                      <div className="vr-flabel"><Languages size={11} /> Traduction
                      <button className="vr-ai" disabled={s.aiTrBusy} onClick={() => preTranslate(s)} title="Pré-traduire avec l'IA (gpt-5.5) — transcrit d'abord si besoin">{s.aiTrBusy ? <Loader2 size={11} className="vr-spin" /> : <Sparkles size={11} />} IA</button>
                      <i className="vr-fstat">{rStat}</i></div>
                      <textarea className="vr-trinput" dir="auto" value={s.translation} onChange={(e) => onEditTr(s.id, e.target.value)} onBlur={() => commitTr(s)} placeholder="Traduction de cette séquence (optionnel)…" />
                      {s.ai_translation && (
                        <div className="vr-aidraft" onClick={(e) => e.stopPropagation()}>
                          <div className="vr-aidraft-h"><span><Sparkles size={11} /> Traduction IA</span><button className="vr-useai" onClick={() => useTranslation(s)} title="Copier dans la traduction (à corriger)">Utiliser ↑</button></div>
                          <div className="vr-aidraft-t" style={{ fontFamily: "inherit", direction: /[؀-ۿ]/.test(s.ai_translation) ? "rtl" : "ltr", textAlign: /[؀-ۿ]/.test(s.ai_translation) ? "right" : "left" }}>{s.ai_translation}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="vr-cardfoot" onClick={(e) => e.stopPropagation()}>
                    {(s.dirty || s.trDirty) ? <span className="vr-unsaved">● non enregistré</span>
                      : (s.reviewed_text || s.saved) ? <span className="vr-ok"><Check size={13} /> vérifié</span>
                        : <span className="vr-pending">à vérifier</span>}
                    <button className="vr-verify" onClick={() => verifySeg(s, i)} title="Enregistrer cette séquence et passer à la suivante"><Check size={14} /> Vérifié &amp; suivant</button>
                  </div>

                  {alts.length > 0 && (
                    <details className="vr-altbox" onClick={(e) => e.stopPropagation()}>
                      <summary>{alts.length} autre{alts.length > 1 ? "s" : ""} version{alts.length > 1 ? "s" : ""}</summary>
                      {alts.map((t, k) => <div key={k} className="vr-alt"><span><User size={9} /> {t.username || "anon"}</span>{(t.text || "").trim()}</div>)}
                    </details>
                  )}
                </div>
              );
            })}
            {segments.length === 0 && <div className="vr-empty"><p>Pas encore de transcriptions pour cette vidéo.</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.vr-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.vr-select label{display:block;font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px}
.vr-selwrap{position:relative;display:inline-flex;align-items:center}
.vr-selwrap svg{position:absolute;right:10px;pointer-events:none;color:var(--text-muted)}
.vr-selwrap select{appearance:none;-webkit-appearance:none;min-width:320px;max-width:72vw;padding:9px 32px 9px 13px;border-radius:11px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);font-size:.86rem;font-weight:600;font-family:inherit;cursor:pointer}
.vr-exports{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vr-prog{font-size:.72rem;font-weight:700;color:var(--accent-green);background:var(--accent-green-soft);padding:5px 11px;border-radius:999px}
.vr-exports button{display:inline-flex;align-items:center;gap:6px;font-size:.76rem;font-weight:700;padding:7px 13px;border-radius:10px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-secondary,var(--text-primary));cursor:pointer}
.vr-exports button:hover{border-color:var(--accent-green);color:var(--accent-green)}
.vr-split{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:20px;align-items:start}
@media(max-width:900px){.vr-split{grid-template-columns:1fr}}
.vr-left{position:sticky;top:14px}
.vr-stage{position:relative;width:100%;aspect-ratio:16/9;background:#06080a;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.45);border:1px solid var(--border)}
.vr-video{width:100%;height:100%;object-fit:contain;background:#06080a;display:block;cursor:pointer}
.vr-audioposter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(120% 120% at 50% 0%,#0c5247,#06080a 70%);color:var(--accent-green);pointer-events:none}
.vr-audioposter span{font-family:'Inter',sans-serif;font-size:.86rem;font-weight:600;color:#cfeee7;max-width:80%;text-align:center}
.vr-spinner{position:absolute;inset:0;display:grid;place-items:center;color:#fff;pointer-events:none}
.vr-bigplay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:74px;height:74px;border-radius:50%;border:none;cursor:pointer;display:grid;place-items:center;color:#06241f;background:rgba(255,255,255,.92);box-shadow:0 10px 36px rgba(0,0,0,.5);backdrop-filter:blur(6px);transition:transform .15s}
.vr-bigplay:hover{transform:translate(-50%,-50%) scale(1.06)}
.vr-controls{position:absolute;left:0;right:0;bottom:0;padding:24px 14px 12px;background:linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.25) 60%,transparent);opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s;pointer-events:none}
.vr-stage.show .vr-controls{opacity:1;transform:none;pointer-events:auto}
.vr-scrub{display:flex;align-items:center;gap:3px;height:16px;touch-action:none}
.vr-piece{position:relative;height:5px;border-radius:999px;background:rgba(255,255,255,.28);cursor:pointer;min-width:3px;transition:height .12s}
.vr-piece:hover,.vr-piece.cur{height:8px}
.vr-piece.cur{background:rgba(255,255,255,.4)}
.vr-piecefill{height:100%;border-radius:999px;background:var(--accent-green)}
.vr-ctrlrow{display:flex;align-items:center;gap:4px;margin-top:8px}
.vr-cbtn{display:inline-flex;align-items:center;gap:4px;height:34px;min-width:34px;padding:0 8px;border:none;background:transparent;color:#fff;cursor:pointer;border-radius:9px;font-size:.74rem;font-weight:700;opacity:.92}
.vr-cbtn:hover{background:rgba(255,255,255,.16);opacity:1}
.vr-cmain{color:#06241f;background:var(--accent-green)}
.vr-time{color:#fff;font-size:.74rem;font-weight:600;margin-inline-start:6px;font-variant-numeric:tabular-nums}
.vr-time i{opacity:.5;font-style:normal;margin:0 2px}
.vr-segno{color:rgba(255,255,255,.7);font-size:.68rem;font-weight:700;margin-inline-start:8px}
.vr-spacer{flex:1}
.vr-meta{margin-top:12px}
.vr-vtitle{font-size:.95rem;font-weight:700;color:var(--text-primary);word-break:break-word}
.vr-progwrap{display:flex;align-items:center;gap:9px;margin-top:12px}
.vr-progbar{flex:1;height:7px;border-radius:999px;background:var(--surface-2);overflow:hidden}
.vr-progbar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent-green),#0bbf9f);transition:width .4s}
.vr-progwrap span{font-size:.7rem;font-weight:700;color:var(--text-muted)}
.vr-trtoggle{display:inline-flex;align-items:center;gap:6px;font-size:.74rem;font-weight:700;color:var(--text-muted);cursor:pointer}
.vr-trtoggle input{accent-color:var(--accent-green)}
.vr-langsel{display:inline-flex;background:var(--surface-1);border:1px solid var(--border);border-radius:9px;padding:2px}
.vr-lang{font-size:.66rem;font-weight:800;padding:4px 9px;border-radius:7px;border:none;background:none;color:var(--text-muted);cursor:pointer}
.vr-lang.on{background:var(--blue,#3b82f6);color:#fff}
.vr-transcript{display:flex;flex-direction:column;gap:9px;max-height:calc(100vh - var(--nav-height) - 150px);overflow:auto;padding-inline-end:6px}
.vr-transcript::-webkit-scrollbar{width:8px}.vr-transcript::-webkit-scrollbar-thumb{background:var(--border);border-radius:8px}
.vr-card{background:var(--surface-1);border:1px solid var(--border);border-radius:14px;padding:11px 13px;cursor:pointer;transition:background .15s,border-color .15s,box-shadow .2s}
.vr-card:hover{border-color:var(--border-hover,var(--border))}
.vr-card.active{border-color:var(--accent-green);box-shadow:0 8px 26px rgba(0,0,0,.13)}
.vr-cardhead{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.vr-ts{display:inline-flex;align-items:center;gap:5px;font-size:.74rem;font-weight:800;color:var(--accent-green);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:4px 9px;cursor:pointer;white-space:nowrap;min-width:34px;justify-content:center;transition:background .15s}
.vr-card.active .vr-ts,.vr-ts:hover{background:var(--accent-green);color:var(--on-primary,#06241f);border-color:var(--accent-green)}
.vr-cardtime{font-family:ui-monospace,monospace;font-size:.7rem;color:var(--text-muted);font-weight:600}
.vr-by{margin-inline-start:auto;display:inline-flex;align-items:center;gap:4px;font-size:.68rem;font-weight:700;color:var(--text-secondary,var(--text-muted));background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:3px 9px}
.vr-field{margin-bottom:8px}.vr-field:last-child{margin-bottom:0}
.vr-flabel{display:flex;align-items:center;gap:5px;font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:5px}
.vr-fstat{margin-inline-start:auto;font-style:normal;font-weight:700;text-transform:none;letter-spacing:0}
.vr-ai{display:inline-flex;align-items:center;gap:3px;margin-inline-start:8px;font-size:.6rem;font-weight:800;text-transform:none;letter-spacing:0;color:var(--accent-green);background:var(--accent-green-soft);border:1px solid var(--border);border-radius:999px;padding:2px 9px;cursor:pointer}
.vr-ai:hover{border-color:var(--accent-green)}.vr-ai:disabled{opacity:.55;cursor:default}
.vr-aidraft{margin-top:8px;border:1px dashed var(--accent-green);background:var(--accent-green-soft);border-radius:10px;padding:8px 10px}
.vr-aidraft-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
.vr-aidraft-h>span{display:inline-flex;align-items:center;gap:4px;font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--accent-green)}
.vr-useai{font-size:.66rem;font-weight:800;color:var(--on-primary,#06241f);background:var(--accent-green);border:none;border-radius:999px;padding:3px 11px;cursor:pointer}
.vr-aidraft-t{font-family:'Cairo',sans-serif;direction:rtl;font-size:1rem;line-height:1.7;color:var(--text-primary)}
.vr-cost{margin-top:10px;display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--text-muted)}
.vr-cost b{color:var(--text-primary)}
.vr-fillall{margin-top:10px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:.82rem;font-weight:800;padding:10px 0;border-radius:11px;border:1px solid var(--accent-green);background:var(--accent-green-soft);color:var(--accent-green);cursor:pointer;transition:filter .15s}
.vr-fillall:hover:not(:disabled){background:var(--accent-green);color:var(--on-primary,#06241f)}
.vr-fillall:disabled{opacity:.6;cursor:default}
.vr-filltr{margin-top:8px;border-color:var(--blue,#3b82f6);background:var(--blue-soft,rgba(59,130,246,.12));color:var(--blue,#3b82f6)}
.vr-filltr:hover:not(:disabled){background:var(--blue,#3b82f6);color:#fff}
.vr-trfield{padding-top:9px;margin-top:9px;border-top:1px dashed var(--border)}
.vr-trinput{width:100%;min-height:42px;resize:vertical;font-family:'Cairo','Inter',sans-serif;font-size:1rem;line-height:1.7;background:var(--surface-2);color:var(--text-primary);border:1px solid var(--border);border-radius:10px;padding:9px 11px;outline:none}
.vr-trinput:focus{border-color:var(--accent-green);box-shadow:0 0 0 3px var(--accent-green-soft)}
.vr-altbox{margin-top:9px}
.vr-altbox summary{cursor:pointer;color:var(--text-muted);font-weight:700;font-size:.66rem;text-transform:uppercase;letter-spacing:.05em}
.vr-alt{margin-top:6px;font-family:'Cairo',sans-serif;direction:rtl;font-size:.9rem;color:var(--text-secondary,var(--text-muted));background:var(--surface-2);border-radius:8px;padding:6px 9px}
.vr-alt span{display:inline-flex;align-items:center;gap:3px;font-family:'Inter',sans-serif;direction:ltr;font-size:.56rem;font-weight:800;text-transform:uppercase;color:var(--accent-green);margin-inline-end:7px}
.vr-ok{display:inline-flex;align-items:center;gap:3px;color:var(--accent-green)}
.vr-dirty{color:var(--warning,#f59e0b)}
.vr-cardfoot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px;padding-top:10px;border-top:1px solid var(--border)}
.vr-unsaved{display:inline-flex;align-items:center;gap:4px;font-size:.7rem;font-weight:800;color:var(--warning,#f59e0b)}
.vr-pending{font-size:.7rem;font-weight:700;color:var(--text-muted)}
.vr-verify{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;padding:8px 16px;border-radius:10px;border:none;background:var(--accent-green);color:var(--on-primary,#06241f);cursor:pointer;transition:filter .15s}
.vr-verify:hover{filter:brightness(1.06)}
.vr-empty{display:grid;place-items:center;text-align:center;padding:54px 0;color:var(--text-muted)}
.vr-empty h3{margin:10px 0 4px;color:var(--text-primary)}.vr-empty p{margin:0;max-width:380px}
.vr-spin{animation:vrspin 1s linear infinite}@keyframes vrspin{to{transform:rotate(360deg)}}
`;
