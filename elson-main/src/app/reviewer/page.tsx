"use client";

/**
 * Reviewer page (admin) — proofreading/correction of hassaniya translations.
 * Natively integrated into Elson (TopBar/BottomNav + theme variables → light/dark).
 * Displays MULTIPLE sentences at once (source ↔ editable translation, Grammarly-style),
 * with selection by contributor. Spell checker wired to the community lexicon.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link2, Undo2, Redo2, Check, X, Loader2, Headphones, Sparkles, ChevronDown, Mic, Square, RotateCcw } from "lucide-react";
import { BottomNav, TopBar } from "@/components/Navigation";
import { isLoggedIn, tryRestoreSession, logout, getMyProfile, getHassaniyaLexicon, getReviewQueue, getReviewContributors, submitReview, type ReviewItem, type ReviewContributor } from "@/lib/api";
import { WaveformAudio } from "@/components/WaveformAudio";
import { VideoReviewer } from "@/components/VideoReviewer";

/* ── Spelling helpers ── */
const TASH = /[ً-ْٰـ]/g;
const norm = (s: string) => s.replace(TASH, "");
const isArab = (w: string) => /[؀-ۿ]/.test(w);
function lev(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let p = dp[0]; dp[0] = j; let best = dp[0];
    for (let i = 1; i <= a.length; i++) { const t = dp[i]; dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; best = Math.min(best, dp[i]); }
    if (best > max) return max + 1;
  }
  return dp[a.length];
}
function getCaret(ed: HTMLElement): number | null {
  const sel = window.getSelection(); if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0); if (!ed.contains(r.endContainer)) return null;
  const pre = r.cloneRange(); pre.selectNodeContents(ed); pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}
function setCaret(ed: HTMLElement, offset: number | null) {
  if (offset == null) return;
  const sel = window.getSelection(); if (!sel) return;
  const r = document.createRange(); let pos = 0, done = false;
  (function walk(n: Node) {
    if (done) return;
    if (n.nodeType === 3) { const len = (n.nodeValue || "").length; if (pos + len >= offset) { r.setStart(n, Math.max(0, offset - pos)); r.collapse(true); done = true; } else pos += len; }
    else n.childNodes.forEach(walk);
  })(ed);
  if (done) { sel.removeAllRanges(); sel.addRange(r); }
}
function langLabel(l: string) { return ({ fr: "Français", ar: "العربية", en: "English" } as Record<string, string>)[l] || (l || "Source").toUpperCase(); }
function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `il y a ${Math.max(1, Math.round(d / 60))} min`;
  if (d < 86400) return `il y a ${Math.round(d / 3600)} h`;
  return `il y a ${Math.round(d / 86400)} j`;
}

type Lex = { set: Set<string>; words: [string, number][] };

export default function ReviewerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [contributors, setContributors] = useState<ReviewContributor[]>([]);
  const [selected, setSelected] = useState<string>("");      // "" = global queue
  const [rows, setRows] = useState<ReviewItem[]>([]);
  const [pending, setPending] = useState(0);
  const [doneSession, setDoneSession] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"text" | "video">("text");
  const lexRef = useRef<Lex>({ set: new Set(), words: [] });
  const selectedRef = useRef("");

  const loadQueue = useCallback(async (contributor: string) => {
    setLoading(true);
    const r = await getReviewQueue(30, 0, contributor || null);
    setPending(r.data?.pending || 0);
    setRows(r.data?.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (!isLoggedIn()) { const ok = await tryRestoreSession(); if (!ok) { router.replace("/"); return; } }
      const prof = await getMyProfile();
      if (prof.data?.profile?.role !== "admin") { router.replace("/contribute"); return; }
      const [lex, contribs] = await Promise.all([getHassaniyaLexicon(), getReviewContributors()]);
      lexRef.current = { set: new Set(lex.map(([w]) => norm(w))), words: lex };
      setContributors(contribs.data?.contributors || []);
      await loadQueue("");
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-reload when the list empties (all reviewed).
  useEffect(() => {
    if (ready && !loading && rows.length === 0) loadQueue(selectedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, ready, loading]);

  const onSelect = (id: string) => { setSelected(id); selectedRef.current = id; loadQueue(id); };
  const onResolved = useCallback((id: number) => {
    setDoneSession((c) => c + 1);
    setPending((p) => Math.max(0, p - 1));
    setRows((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const exec = (cmd: string) => {
    if (cmd === "createLink") { const u = prompt("URL du lien :", "https://"); if (u) document.execCommand("createLink", false, u); }
    else document.execCommand(cmd, false);
  };
  const TB = [
    { cmd: "bold", Icon: Bold, t: "Gras" }, { cmd: "italic", Icon: Italic, t: "Italique" },
    { cmd: "underline", Icon: Underline, t: "Souligné" }, { cmd: "strikeThrough", Icon: Strikethrough, t: "Barré" },
    { cmd: "insertUnorderedList", Icon: List, t: "Puces" }, { cmd: "insertOrderedList", Icon: ListOrdered, t: "Numéros" },
    { cmd: "createLink", Icon: Link2, t: "Lien" }, { cmd: "undo", Icon: Undo2, t: "Annuler" }, { cmd: "redo", Icon: Redo2, t: "Rétablir" },
  ];

  const selName = selected ? (contributors.find((c) => c.id === selected)?.name || "—") : "Tous les contributeurs";

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: "calc(var(--nav-height) + 16px)" }}>
      <style>{STYLES}</style>
      <TopBar onLogout={() => { logout(); router.replace("/"); }} />
      <BottomNav />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 16px" }}>
        {/* Header */}
        <div className="rvw-head">
          <div>
            <h1 className="rvw-title"><Sparkles size={18} /> Relecture des traductions</h1>
            <p className="rvw-sub">Corrige l'orthographe et la traduction · sauvegardé comme version « gold »</p>
          </div>
          <div className="rvw-headright">
            <div className="rvw-modes">
              <button className={"rvw-mode" + (mode === "text" ? " on" : "")} onClick={() => setMode("text")}>Traductions</button>
              <button className={"rvw-mode" + (mode === "video" ? " on" : "")} onClick={() => setMode("video")}>Vidéos</button>
            </div>
            {mode === "text" && (
              <div className="rvw-stats">
                <div className="rvw-stat"><b>{pending.toLocaleString("fr")}</b><span>à relire</span></div>
                <div className="rvw-stat rvw-statok"><b>{doneSession}</b><span>relues (session)</span></div>
              </div>
            )}
          </div>
        </div>

        {mode === "video" && <VideoReviewer />}

        {mode === "text" && <>
        {/* Contributor selector + toolbar */}
        <div className="rvw-bar">
          <div className="rvw-select">
            <label>Contributeur</label>
            <div className="rvw-selwrap">
              <select value={selected} onChange={(e) => onSelect(e.target.value)}>
                <option value="">Tous les contributeurs ({pending.toLocaleString("fr")})</option>
                {contributors.map((c) => <option key={c.id || "anon"} value={c.id || ""}>{c.name} — {c.pending}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          <div className="rvw-toolbar">
            {TB.map((b, i) => <button key={i} className="rvw-tbtn" title={b.t} onMouseDown={(e) => { e.preventDefault(); exec(b.cmd); }}><b.Icon size={15} /></button>)}
          </div>
        </div>

        {selected && <div className="rvw-ctxnote">Phrases de <b>{selName}</b> — relis-les toutes jusqu'à épuisement.</div>}

        {/* List */}
        {loading ? (
          <div className="rvw-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rvw-row rvw-skel">
                <div className="rvw-srccol"><span className="sk sk-lbl" /><span className="sk sk-line" /><span className="sk sk-line short" /></div>
                <div className="rvw-trcol"><span className="sk sk-lbl" /><span className="sk sk-ed" /><span className="sk sk-acts" /></div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rvw-center rvw-empty">
            <div style={{ fontSize: "2.6rem" }}>🎉</div>
            <h3>Tout est relu !</h3>
            <p>{selected ? "Cette personne n'a plus de phrases à relire." : "Plus aucune traduction en attente."}</p>
            <button className="rvw-btn-primary" onClick={() => onSelect("")}>Voir la file globale</button>
          </div>
        ) : (
          <div className="rvw-list">
            {rows.map((it) => <ReviewRow key={it.id} item={it} lexRef={lexRef} showAuthor={!selected} onResolved={onResolved} />)}
          </div>
        )}
        </>}
      </div>
    </div>
  );
}

/* ───────── One row = one sentence (source ↔ editable translation) ───────── */
function ReviewRow({ item, lexRef, showAuthor, onResolved }: { item: ReviewItem; lexRef: React.MutableRefObject<Lex>; showAuthor: boolean; onResolved: (id: number) => void }) {
  const edRef = useRef<HTMLDivElement>(null);
  const srcEdRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<{ w: string; sugs: string[] }[]>([]);
  const [pop, setPop] = useState<{ word: string; top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<null | "approve" | "reject">(null);
  const [showAudio, setShowAudio] = useState(false);
  const [recording, setRecording] = useState(false);
  const [focused, setFocused] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);
  const [newAudio, setNewAudio] = useState<{ blob: Blob; url: string } | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime }); mrRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 1000) setNewAudio((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { blob, url: URL.createObjectURL(blob) }; });
      };
      mr.start(); setRecording(true);
    } catch { alert("Micro indisponible. Autorise le micro dans le navigateur."); }
  };
  const stopRec = () => { mrRef.current?.stop(); setRecording(false); };
  const discardRec = () => setNewAudio((prev) => { if (prev) URL.revokeObjectURL(prev.url); return null; });

  const known = (w: string) => lexRef.current.set.size === 0 || lexRef.current.set.has(norm(w));
  const suggest = (w: string) => {
    const nw = norm(w);
    return lexRef.current.words.map(([k, f]) => ({ k, d: lev(nw, norm(k), 2), f })).filter((x) => x.d > 0 && x.d <= 2).sort((a, b) => a.d - b.d || b.f - a.f).slice(0, 4).map((x) => x.k);
  };

  const runSpell = useCallback(() => {
    const ed = edRef.current; if (!ed) return;
    const off = getCaret(ed);
    ed.querySelectorAll("span.bad").forEach((s) => s.replaceWith(document.createTextNode(s.textContent || "")));
    ed.normalize();
    const texts: Text[] = [];
    (function collect(n: Node) { if (n.nodeType === 3) texts.push(n as Text); else n.childNodes.forEach(collect); })(ed);
    texts.forEach((tn) => {
      const val = tn.nodeValue || ""; if (!/[؀-ۿ]/.test(val)) return;
      const frag = document.createDocumentFragment(); let ch = false;
      val.split(/(\s+)/).forEach((tk) => {
        if (isArab(tk) && tk.length >= 2 && !known(tk)) { const s = document.createElement("span"); s.className = "bad"; s.dataset.w = tk; s.textContent = tk; frag.appendChild(s); ch = true; }
        else frag.appendChild(document.createTextNode(tk));
      });
      if (ch) tn.replaceWith(frag);
    });
    setCaret(ed, off);
    const seen = new Set<string>(); const iss: { w: string; sugs: string[] }[] = [];
    ed.querySelectorAll("span.bad").forEach((s) => { const w = (s as HTMLElement).dataset.w || ""; if (!seen.has(w)) { seen.add(w); iss.push({ w, sugs: suggest(w) }); } });
    setIssues(iss);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (edRef.current) { edRef.current.textContent = item.hassaniya_text || ""; runSpell(); }
    if (srcEdRef.current) srcEdRef.current.textContent = item.source_text || "";
    /* eslint-disable-next-line */
  }, []);

  const replaceWord = (from: string, to: string) => {
    const ed = edRef.current; if (!ed) return;
    ed.querySelectorAll("span.bad").forEach((s) => { if ((s as HTMLElement).dataset.w === from) s.replaceWith(document.createTextNode(to)); });
    runSpell();
  };
  const acceptAll = () => { issues.forEach((it) => { if (it.sugs[0]) replaceWord(it.w, it.sugs[0]); }); setJustAccepted(true); setTimeout(() => setJustAccepted(false), 450); };
  const onKey = (e: React.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); finish("approve"); } };

  const onEdClick = (e: React.MouseEvent) => {
    const span = (e.target as HTMLElement).closest?.("span.bad") as HTMLElement | null;
    if (span && wrapRef.current) {
      const r = span.getBoundingClientRect(); const wr = wrapRef.current.getBoundingClientRect();
      setPop({ word: span.dataset.w || "", top: r.bottom - wr.top + 6, left: Math.max(4, Math.min(r.left - wr.left, wr.width - 230)) });
    } else setPop(null);
  };

  const finish = async (action: "approve" | "reject") => {
    if (busy) return;
    const text = (edRef.current?.textContent || "").trim();
    if (action === "approve" && text.length < 1) return;
    setBusy(true);
    const srcText = (srcEdRef.current?.textContent || "").trim();
    const { error } = await submitReview(item.id, text, action, action === "approve" ? newAudio?.blob : null, action === "approve" ? srcText : undefined);
    if (error) { setBusy(false); alert(error); return; }
    // Instant flywheel: validated words become "known" for the following rows.
    if (action === "approve") (text.replace(TASH, "").match(/[؀-ۿݐ-ݿ]+/g) || []).forEach((w) => { if (w.length >= 2) lexRef.current.set.add(w); });
    if (newAudio) URL.revokeObjectURL(newAudio.url);
    setResolved(action);
    setTimeout(() => onResolved(item.id), 320);
  };

  if (resolved) {
    return <div className={"rvw-row rvw-resolved " + (resolved === "reject" ? "rej" : "")}>{resolved === "approve" ? <><Check size={15} /> Validée</> : <><X size={15} /> Rejetée</>}</div>;
  }

  const sugs = pop ? suggest(pop.word) : [];
  return (
    <div className={"rvw-row" + (focused ? " active" : "") + (justAccepted ? " flash" : "")}>
      {/* Source */}
      <div className="rvw-srccol">
        <div className="rvw-collabel">{langLabel(item.source_lang)}{showAuthor && <span className="rvw-by"> · {item.contributor}</span>}<span className="rvw-editable">✎ modifiable</span></div>
        <div className="rvw-srctext rvw-srcedit" contentEditable suppressContentEditableWarning ref={srcEdRef} dir={item.source_lang === "ar" ? "rtl" : "ltr"} spellCheck={false} />
        {item.audio_url && (showAudio
          ? <div style={{ marginTop: 10 }}><WaveformAudio src={item.audio_url} /></div>
          : <button className="rvw-listen" onClick={() => setShowAudio(true)}><Headphones size={13} /> Écouter l'audio</button>)}
      </div>

      {/* Editable translation */}
      <div className="rvw-trcol">
        <div className="rvw-collabel">حسانية · révision
          {issues.length > 0 ? <span className="rvw-badge">{issues.length} à corriger</span> : <span className="rvw-badge ok"><Check size={10} /> propre</span>}
          <span className="rvw-time">{timeAgo(item.created_at)}</span></div>
        <div className="rvw-edwrap" ref={wrapRef}>
          <div className="rvw-editor" contentEditable suppressContentEditableWarning ref={edRef} dir="rtl" spellCheck={false} onInput={runSpell} onClick={onEdClick} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={onKey} />
          {pop && (
            <div className="rvw-pop" style={{ top: pop.top, left: pop.left }} onClick={(e) => e.stopPropagation()}>
              <div className="rvw-popph"><span>Suggestions</span><button onClick={() => setPop(null)}><X size={12} /></button></div>
              {sugs.length ? sugs.map((s) => <button key={s} className="rvw-sug" onClick={() => { replaceWord(pop.word, s); setPop(null); }}>{s}</button>)
                : <div className="rvw-none">Aucune suggestion proche.</div>}
              <button className="rvw-ign" onClick={() => { lexRef.current.set.add(norm(pop.word)); runSpell(); setPop(null); }}>Ignorer ce mot</button>
            </div>
          )}
        </div>

        {/* Suggestions bar (chips) */}
        {issues.length > 0 && (
          <div className="rvw-sugbar">
            <Sparkles size={13} className="rvw-sugicon" />
            {issues.slice(0, 6).map((it) => it.sugs[0] && (
              <button key={it.w} className="rvw-chip" onClick={() => replaceWord(it.w, it.sugs[0])} title={`${it.w} → ${it.sugs[0]}`}>
                <span className="rvw-chipold">{it.w}</span>→<span className="rvw-chipnew">{it.sugs[0]}</span>
              </button>
            ))}
            {issues.length > 1 && <button className="rvw-chipall" onClick={acceptAll}>Tout corriger</button>}
          </div>
        )}

        {/* Voice re-recording (optional) */}
        <div className="rvw-rec">
          {newAudio ? (
            <>
              <span className="rvw-recok"><Mic size={12} /> nouvel audio</span>
              <div style={{ flex: 1, minWidth: 0 }}><WaveformAudio src={newAudio.url} /></div>
              <button className="rvw-recicon" title="Refaire" onClick={discardRec}><RotateCcw size={14} /></button>
            </>
          ) : (
            <button className={"rvw-recbtn" + (recording ? " on" : "")} onClick={recording ? stopRec : startRec}>
              {recording ? <><Square size={12} fill="currentColor" /> Arrêter l'enregistrement</> : <><Mic size={13} /> Réenregistrer l'audio</>}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="rvw-actions">
          <button className="rvw-reject" disabled={busy} onClick={() => finish("reject")}><X size={14} /> Rejeter</button>
          <button className="rvw-validate" disabled={busy} onClick={() => finish("approve")} title="Ctrl/⌘ + Entrée">
            {busy ? <Loader2 size={15} className="rvw-spin" /> : <Check size={15} />} Valider{newAudio ? " + audio" : ""}
            <kbd className="rvw-kbd">⌘↵</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

const STYLES = `
.rvw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
.rvw-title{display:flex;align-items:center;gap:8px;font-size:1.25rem;font-weight:800;color:var(--text-primary);margin:0}
.rvw-title svg{color:var(--accent-green)}
.rvw-sub{margin:4px 0 0;font-size:.82rem;color:var(--text-muted)}
.rvw-stats{display:flex;gap:10px}
.rvw-stat{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:8px 14px;text-align:center;min-width:78px}
.rvw-stat b{display:block;font-size:1.15rem;font-weight:800;color:var(--text-primary)}
.rvw-stat span{font-size:.66rem;color:var(--text-muted)}
.rvw-statok b{color:var(--accent-green)}
.rvw-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px;flex-wrap:wrap}
.rvw-select label{display:block;font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px}
.rvw-selwrap{position:relative;display:inline-flex;align-items:center}
.rvw-selwrap svg{position:absolute;right:10px;pointer-events:none;color:var(--text-muted)}
.rvw-selwrap select{appearance:none;-webkit-appearance:none;min-width:280px;padding:9px 32px 9px 13px;border-radius:11px;border:1px solid var(--border);background:var(--surface-1);color:var(--text-primary);font-size:.86rem;font-weight:600;font-family:inherit;cursor:pointer}
.rvw-toolbar{display:flex;align-items:center;gap:2px;background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:4px}
.rvw-tbtn{width:30px;height:30px;border-radius:7px;display:grid;place-items:center;border:none;background:none;color:var(--text-muted);cursor:pointer}
.rvw-tbtn:hover{background:var(--surface-2);color:var(--text-primary)}
.rvw-ctxnote{font-size:.8rem;color:var(--text-muted);background:var(--accent-green-soft);border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:12px}
.rvw-ctxnote b{color:var(--accent-green)}
.rvw-list{display:flex;flex-direction:column;gap:12px}
.rvw-row{display:grid;grid-template-columns:1fr 1.15fr;gap:0;background:var(--surface-1);border:1px solid var(--border);border-radius:16px;overflow:hidden;animation:rvwin .25s ease;transition:border-color .2s,box-shadow .25s,transform .2s}
.rvw-row.active{border-color:var(--accent-green);box-shadow:0 0 0 3px var(--accent-green-soft),0 16px 40px rgba(0,0,0,.14);transform:translateY(-1px)}
.rvw-row.flash{animation:rvwflash .45s ease}
@keyframes rvwflash{0%{box-shadow:0 0 0 0 var(--accent-green-soft)}40%{box-shadow:0 0 0 5px var(--accent-green-soft)}100%{box-shadow:0 0 0 0 transparent}}
@keyframes rvwin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.rvw-srccol{padding:15px 17px;border-inline-end:1px solid var(--border)}
.rvw-trcol{padding:15px 17px}
.rvw-collabel{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:8px}
.rvw-by{color:var(--accent-green);font-weight:700}
.rvw-time{float:inline-end;font-weight:600;letter-spacing:0;text-transform:none}
.rvw-srctext{font-size:1.02rem;line-height:1.75;color:var(--text-secondary,var(--text-primary));margin:0}
.rvw-listen{margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:700;color:var(--accent-green);background:var(--accent-green-soft);border:1px solid var(--border);border-radius:999px;padding:5px 12px;cursor:pointer}
.rvw-edwrap{position:relative}
.rvw-editor{font-family:'Cairo',sans-serif;font-size:1.24rem;line-height:2.15;direction:rtl;text-align:right;outline:none;min-height:66px;color:var(--text-primary);background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;caret-color:var(--accent-green);transition:border-color .15s,box-shadow .15s}
.rvw-editor:focus{border-color:var(--accent-green);box-shadow:0 0 0 3px var(--accent-green-soft)}
.rvw-editor .bad{text-decoration:underline;text-decoration-style:wavy;text-decoration-thickness:2px;text-underline-offset:4px;text-decoration-color:var(--danger,#ef4444);cursor:pointer;border-radius:3px}
.rvw-editor b,.rvw-editor strong{font-weight:700}.rvw-editor i,.rvw-editor em{font-style:italic}
.rvw-editor ul,.rvw-editor ol{margin:6px 0;padding-inline-start:24px}
.rvw-editor a{color:var(--accent-green);text-decoration:underline}
.rvw-sugbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px}
.rvw-sugicon{color:var(--accent-green);flex-shrink:0}
.rvw-chip{display:inline-flex;align-items:center;gap:5px;font-family:'Cairo',sans-serif;font-size:.92rem;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);cursor:pointer;color:var(--text-primary)}
.rvw-chip:hover{border-color:var(--accent-green)}
.rvw-chipold{color:var(--danger,#ef4444);text-decoration:line-through}
.rvw-chipnew{color:var(--accent-green);font-weight:700}
.rvw-chipall{font-size:.72rem;font-weight:800;padding:5px 12px;border-radius:999px;border:1px solid var(--accent-green);background:var(--accent-green-soft);color:var(--accent-green);cursor:pointer}
.rvw-actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}
.rvw-reject{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:700;padding:9px 16px;border-radius:11px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer}
.rvw-reject:hover{color:var(--danger,#ef4444);border-color:var(--danger,#ef4444)}
.rvw-validate{display:inline-flex;align-items:center;gap:7px;font-size:.84rem;font-weight:800;padding:9px 22px;border-radius:11px;border:none;background:var(--accent-green);color:var(--on-primary,#04473b);cursor:pointer}
.rvw-validate:disabled,.rvw-reject:disabled{opacity:.6;cursor:default}
.rvw-resolved{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-radius:14px;background:var(--accent-green-soft);border:1px solid var(--border);color:var(--accent-green);font-weight:800;font-size:.9rem;animation:rvwin .2s ease}
.rvw-resolved.rej{background:transparent;color:var(--text-muted)}
.rvw-center{display:grid;place-items:center;padding:60px 0;text-align:center}
.rvw-empty h3{margin:10px 0 4px;color:var(--text-primary)}.rvw-empty p{color:var(--text-muted);margin:0 0 14px}
.rvw-btn-primary{padding:10px 20px;border-radius:11px;border:none;background:var(--accent-green);color:var(--on-primary,#04473b);font-weight:800;cursor:pointer}
.rvw-spin{animation:rvwspin 1s linear infinite}@keyframes rvwspin{to{transform:rotate(360deg)}}
.rvw-pop{position:absolute;z-index:30;min-width:164px;max-width:230px;background:var(--bg-dark);border:1px solid var(--border);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.4);padding:8px}
.rvw-popph{display:flex;justify-content:space-between;align-items:center;font-size:.56rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px}
.rvw-popph button{border:0;background:none;color:var(--text-muted);cursor:pointer;display:flex}
.rvw-sug{font-family:'Cairo',sans-serif;direction:rtl;font-size:1.04rem;font-weight:700;text-align:right;width:100%;padding:7px 10px;border-radius:8px;border:0;background:var(--accent-green-soft);color:var(--accent-green);cursor:pointer;margin-bottom:4px}
.rvw-ign{width:100%;font-size:.66rem;font-weight:700;padding:6px 0;border-radius:7px;border:1px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;margin-top:2px}
.rvw-none{font-size:.74rem;color:var(--text-muted);font-style:italic;padding:2px}
.rvw-row:hover{border-color:var(--border-hover)}
.rvw-badge{display:inline-flex;align-items:center;gap:4px;margin-inline-start:8px;font-size:.58rem;font-weight:800;letter-spacing:0;text-transform:none;padding:2px 8px;border-radius:999px;background:var(--danger-soft,rgba(239,68,68,.1));color:var(--danger,#ef4444)}
.rvw-badge.ok{background:var(--accent-green-soft);color:var(--accent-green)}
.rvw-rec{display:flex;align-items:center;gap:10px;margin-top:12px}
.rvw-recbtn{display:inline-flex;align-items:center;gap:7px;font-size:.78rem;font-weight:700;padding:8px 14px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-muted);cursor:pointer}
.rvw-recbtn:hover{border-color:var(--accent-green);color:var(--accent-green)}
.rvw-recbtn.on{border-color:var(--danger,#ef4444);color:var(--danger,#ef4444);background:rgba(239,68,68,.08)}
.rvw-recok{display:inline-flex;align-items:center;gap:5px;font-size:.66rem;font-weight:800;color:var(--accent-green);white-space:nowrap}
.rvw-recicon{width:34px;height:34px;border-radius:50%;border:1px solid var(--border);background:var(--surface-2);color:var(--text-muted);cursor:pointer;display:grid;place-items:center;flex-shrink:0}
/* Gradient title + premium header */
.rvw-title{background:linear-gradient(90deg,var(--text-primary),var(--accent-green));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.rvw-title svg{-webkit-text-fill-color:initial}
.rvw-stat{transition:transform .15s,border-color .15s}
.rvw-stat:hover{transform:translateY(-2px);border-color:var(--accent-green)}
.rvw-headright{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.rvw-modes{display:inline-flex;background:var(--surface-1);border:1px solid var(--border);border-radius:11px;padding:3px}
.rvw-mode{font-size:.8rem;font-weight:700;padding:7px 16px;border-radius:8px;border:none;background:none;color:var(--text-muted);cursor:pointer;transition:background .15s,color .15s}
.rvw-mode.on{background:var(--accent-green);color:var(--on-primary,#04473b)}
/* Keyboard shortcut */
.rvw-kbd{margin-inline-start:7px;font-family:ui-monospace,monospace;font-size:.62rem;font-weight:700;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.25);line-height:1;opacity:.85}
/* Popover arrow */
.rvw-pop::before{content:"";position:absolute;top:-6px;inset-inline-start:16px;width:11px;height:11px;background:var(--bg-dark);border-inline-start:1px solid var(--border);border-top:1px solid var(--border);transform:rotate(45deg)}
.rvw-pop{animation:rvwin .14s ease}
.rvw-sug{transition:transform .1s}.rvw-sug:hover{transform:translateX(-2px)}
.rvw-chip{transition:transform .12s,border-color .15s}.rvw-chip:hover{transform:translateY(-1px)}
/* Skeletons */
.rvw-skel{pointer-events:none}
.sk{display:block;border-radius:8px;background:linear-gradient(90deg,var(--surface-2) 25%,var(--surface-1) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:rvwshimmer 1.3s ease infinite}
@keyframes rvwshimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.sk-lbl{width:70px;height:10px;margin-bottom:12px}
.sk-line{width:100%;height:14px;margin-bottom:9px}.sk-line.short{width:60%}
.sk-ed{width:100%;height:66px;border-radius:12px}
.sk-acts{width:160px;height:34px;margin-top:14px;margin-inline-start:auto}
/* Editable source */
.rvw-editable{float:inline-end;font-size:.56rem;font-weight:700;letter-spacing:0;text-transform:none;color:var(--text-muted);opacity:.65}
.rvw-srcedit{outline:none;border:1px solid transparent;border-radius:8px;padding:6px 8px;margin:-2px -8px;transition:border-color .15s,background .15s;cursor:text;min-height:30px}
.rvw-srcedit:hover{background:var(--surface-2)}
.rvw-srcedit:focus{border-color:var(--accent-green);background:var(--surface-2);box-shadow:0 0 0 3px var(--accent-green-soft)}
@media(max-width:760px){.rvw-row{grid-template-columns:1fr}.rvw-srccol{border-inline-end:none;border-bottom:1px solid var(--border)}}
`;
