"use client";

// Community — immersive scroller, shown BY DEFAULT but BOUNDED between the top
// navbar and the bottom navbar (both stay visible). One real post per screen,
// vertical scroll-snap. Same posts/likes/votes/comments as before; text / audio /
// video adapt. Fully theme-aware (light + dark) with the premium teal accent from
// My Agenda. Publish + admin moderation live in the header. No "share".

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart, MessageCircle, Plus, X, Send, Play, Pause, Volume2, VolumeX,
  ShieldCheck, Loader2, Mic, Square, Film, Image as ImageIcon, AudioLines, Trash2,
} from "lucide-react";
import {
  getCommunity, likeCommunityCard, voteCommunityCard, commentCommunityCard,
  proposeCommunityCard, publishCommunityCardMedia, adminDeleteCommunityCard, mentionSearchCommunity,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";
import CommunityCards from "@/components/CommunityCards";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const mediaUrl = (u?: string | null) => !u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : `${API_URL}${u.startsWith("/") ? "" : "/"}${u}`;
const isAr = (s?: string | null) => !!s && /[؀-ۿ]/.test(s);

type Comment = { id: number; username: string | null; body: string; created_at: string; audio_url?: string | null; image_url?: string | null };
type Card = {
  id: number; type: string; question: string; options: string[]; is_official: boolean;
  created_name?: string | null; image_url?: string | null; banner_url?: string | null; audio_url?: string | null; video_url?: string | null; text_color?: string | null;
  tally: number[]; total: number; myVote: number | null; majority: number | null;
  likeCount: number; myLike: boolean; comments: Comment[];
};

export default function CommunityImmersive() {
  const { t, rtl } = useI18n();
  const [cards, setCards] = useState<Card[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canPost, setCanPost] = useState(true);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [commentsOf, setCommentsOf] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await getCommunity();
    if (data) { setCards(data.cards || []); setIsAdmin(!!data.isAdmin); setCanPost(data.canPost !== false); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const root = feedRef.current; if (!root) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
    }), { root, threshold: [0.6] });
    root.querySelectorAll(".ci-slide").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [cards.length]);

  const patch = (id: number, p: Partial<Card>) => setCards((cs) => cs.map((c) => c.id === id ? { ...c, ...p } : c));
  const onLike = (c: Card) => {
    patch(c.id, { myLike: !c.myLike, likeCount: c.likeCount + (c.myLike ? -1 : 1) });
    likeCommunityCard(c.id).catch(() => patch(c.id, { myLike: c.myLike, likeCount: c.likeCount }));
  };
  const onVote = async (c: Card, choice: number) => {
    if (c.myVote === choice) return;
    const tally = [...(c.tally || [])]; tally[choice] = (tally[choice] || 0) + 1;
    patch(c.id, { myVote: choice, tally, total: c.total + (c.myVote == null ? 1 : 0) });
    await voteCommunityCard(c.id, choice);
    load();
  };
  // Admin: delete a post entirely (incl. its video/audio/image) — optimistic remove.
  const onDelete = async (c: Card) => {
    if (!window.confirm(t("community.confirmDeleteCard"))) return;
    setCards((cs) => cs.filter((x) => x.id !== c.id));
    await adminDeleteCommunityCard(c.id).catch(() => load());
  };

  const current = cards.find((c) => c.id === commentsOf) || null;
  const hasAnyMedia = cards.some((c) => c.video_url || c.audio_url);

  return (
    <div className={`ci${rtl ? " rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <style>{CSS}</style>

      <div className="ci-head">
        <div className="ci-brand"><span className="dot" /> {t("community.title")}</div>
        <div className="ci-head-r">
          {hasAnyMedia && <button className="ci-hbtn" onClick={() => setSoundOn((s) => !s)} title={soundOn ? t("community.soundOff") : t("community.soundOn")}>{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>}
          {isAdmin && <button className="ci-hbtn" onClick={() => setModOpen(true)} title={t("community.moderation")}><ShieldCheck size={16} /></button>}
          {(canPost || isAdmin) && <button className="ci-hbtn pub" onClick={() => setPublishOpen(true)} title={t("community.publish")}><Plus size={18} /></button>}
        </div>
      </div>

      {cards.length > 0 && cards.length <= 30 && (
        <div className="ci-dots">{cards.map((_, i) => <i key={i} className={i === active ? "on" : ""} />)}</div>
      )}

      {loading ? (
        <div className="ci-state"><Loader2 className="spin" size={26} /></div>
      ) : cards.length === 0 ? (
        <div className="ci-state ci-empty">
          <div className="ci-empty-ic"><MessageCircle size={26} /></div>
          <div className="ci-empty-t">{t("community.emptyTitle")}</div>
          <div className="ci-empty-s">{t("community.empty")}</div>
          {(canPost || isAdmin) && <button className="ci-empty-cta" onClick={() => setPublishOpen(true)}><Plus size={16} /> {t("community.publish")}</button>}
        </div>
      ) : (
        <div className="ci-feed" ref={feedRef}>
          {cards.map((c, i) => (
            <Slide key={c.id} i={i} c={c} active={i === active} soundOn={soundOn} t={t} isAdmin={isAdmin}
              onLike={() => onLike(c)} onVote={(ch) => onVote(c, ch)} onComments={() => setCommentsOf(c.id)} onDelete={() => onDelete(c)} />
          ))}
        </div>
      )}

      {current && <CommentsSheet card={current} t={t} onClose={() => setCommentsOf(null)} onSent={load} />}
      {publishOpen && <PublishSheet isAdmin={isAdmin} t={t} onClose={() => setPublishOpen(false)} onSent={() => { setPublishOpen(false); load(); }} />}
      {modOpen && (
        <div className="ci-modal" onClick={() => setModOpen(false)}>
          <div className="ci-sheet tall" onClick={(e) => e.stopPropagation()}>
            <div className="ci-grip" />
            <div className="ci-sheet-head"><b>{t("community.moderation")}</b><button onClick={() => setModOpen(false)}><X size={18} /></button></div>
            <div className="ci-sheet-body"><CommunityCards adminPanelOnly /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Slide({ i, c, active, soundOn, t, isAdmin, onLike, onVote, onComments, onDelete }: {
  i: number; c: Card; active: boolean; soundOn: boolean; t: (k: string) => string; isAdmin: boolean; onLike: () => void; onVote: (ch: number) => void; onComments: () => void; onDelete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const isPoll = c.type === "poll" && c.options?.length > 0;
  const voted = c.myVote != null;
  const bg = c.banner_url || c.image_url;
  const hasMedia = !!(c.video_url || bg);

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) { if (active) { vid.muted = !soundOn; vid.play().catch(() => {}); } else { vid.pause(); vid.currentTime = 0; } }
    const a = audioRef.current;
    if (a) { if (active && soundOn) a.play().catch(() => {}); else { a.pause(); a.currentTime = 0; setPlaying(false); } }
  }, [active, soundOn]);

  const toggleAudio = () => { const a = audioRef.current; if (!a) return; if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); } };

  return (
    <div className={`ci-slide${hasMedia ? " media" : ""}`} data-i={i}>
      {c.video_url
        ? <video ref={videoRef} className="ci-bg" src={mediaUrl(c.video_url)} loop playsInline muted={!soundOn} poster={bg ? mediaUrl(bg) : undefined} />
        : bg
          ? <div className="ci-bg img" style={{ backgroundImage: `url(${mediaUrl(bg)})` }} />
          : <div className="ci-bg glow" />}
      {hasMedia && <div className="ci-veil" />}

      <div className="ci-top">
        {c.is_official
          ? <span className="ci-badge off"><ShieldCheck size={13} /> Elson · {t("community.official")}</span>
          : <span className="ci-badge">@{c.created_name || t("community.member")}</span>}
      </div>

      <div className="ci-rail">
        <button className={`ci-act${c.myLike ? " liked" : ""}`} onClick={onLike}><span className="b"><Heart size={22} fill={c.myLike ? "currentColor" : "none"} /></span><span className="c">{c.likeCount || ""}</span></button>
        <button className="ci-act" onClick={onComments}><span className="b"><MessageCircle size={21} /></span><span className="c">{c.comments?.length || ""}</span></button>
        {c.audio_url && <button className="ci-act" onClick={toggleAudio}><span className="b">{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</span><span className="c">{t("community.listen")}</span></button>}
        {isAdmin && <button className="ci-act del" onClick={onDelete} title={t("community.delete")}><span className="b"><Trash2 size={19} /></span><span className="c">{t("community.delete")}</span></button>}
      </div>

      <div className="ci-over">
        <div className="ci-content">
          <div className={`ci-q${isAr(c.question) ? " ar" : ""}`} dir={isAr(c.question) ? "rtl" : undefined} style={c.text_color ? { color: c.text_color } : undefined}>{c.question}</div>
          {isPoll && (
            <div className="ci-poll">
              {c.options.map((opt, idx) => {
                const pct = c.total > 0 ? Math.round(((c.tally[idx] || 0) / c.total) * 100) : 0;
                return (
                  <button key={idx} className={`ci-opt${c.myVote === idx ? " mine" : ""}${c.majority === idx ? " win" : ""}`} onClick={() => onVote(idx)}>
                    {voted && <span className="bar" style={{ width: `${pct}%` }} />}
                    <span className={`lbl${isAr(opt) ? " ar" : ""}`}>{opt}</span>
                    {voted && <span className="pct">{pct}%</span>}
                  </button>
                );
              })}
              {!voted && <div className="ci-hint">{t("community.tapToVote")}</div>}
            </div>
          )}
        </div>
      </div>
      {c.audio_url && <audio ref={audioRef} src={mediaUrl(c.audio_url)} onEnded={() => setPlaying(false)} preload="none" />}
    </div>
  );
}

function CommentsSheet({ card, t, onClose, onSent }: { card: Card; t: (k: string) => string; onClose: () => void; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const pickImg = useRef<HTMLInputElement>(null);

  const rec = async () => {
    if (recording) { mrRef.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); mrRef.current = mr; chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => { setAudio(new Blob(chunks.current, { type: "audio/webm" })); stream.getTracks().forEach((x) => x.stop()); };
      mr.start(); setRecording(true);
    } catch { /* mic denied */ }
  };
  const send = async () => {
    if (!body.trim() && !audio && !image) return;
    setSending(true);
    await commentCommunityCard(card.id, body.trim(), { audio, image });
    setSending(false); setBody(""); setAudio(null); setImage(null); onSent();
  };

  return (
    <div className="ci-modal" onClick={onClose}>
      <div className="ci-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ci-grip" />
        <div className="ci-sheet-head"><b>{(card.comments?.length || 0)} {t("community.comments")}</b><button onClick={onClose}><X size={18} /></button></div>
        <div className="ci-sheet-body">
          {(card.comments || []).length === 0 && <div className="ci-cm-empty">{t("community.noComments")}</div>}
          {(card.comments || []).map((cm) => (
            <div key={cm.id} className="ci-cm">
              <div className="ci-cm-av">{(cm.username || "?").slice(0, 2).toUpperCase()}</div>
              <div className="ci-cm-b">
                <div className="ci-cm-name">@{cm.username}</div>
                {cm.body && <div className={`ci-cm-txt${isAr(cm.body) ? " ar" : ""}`}>{cm.body}</div>}
                {cm.audio_url && <audio controls src={mediaUrl(cm.audio_url)} className="ci-cm-audio" preload="none" />}
                {cm.image_url && <img src={mediaUrl(cm.image_url)} alt="" className="ci-cm-img" />}
              </div>
            </div>
          ))}
        </div>
        {image && (
          <div className="ci-cm-prev">
            <img src={URL.createObjectURL(image)} alt="" />
            <button onClick={() => setImage(null)}><X size={13} /></button>
          </div>
        )}
        <div className="ci-cm-compose">
          <button className={`ci-mic${recording ? " rec" : ""}`} onClick={rec} title={t("community.audio")}>{recording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</button>
          <button className="ci-mic" onClick={() => pickImg.current?.click()} title={t("community.photo")}><ImageIcon size={18} /></button>
          <input ref={pickImg} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] || null)} />
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={audio ? t("community.voiceReady") : t("community.addComment")} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button className="ci-send" onClick={send} disabled={sending || (!body.trim() && !audio && !image)}>{sending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}</button>
        </div>
      </div>
    </div>
  );
}

function PublishSheet({ isAdmin, t, onClose, onSent }: { isAdmin: boolean; t: (k: string) => string; onClose: () => void; onSent: () => void }) {
  const [kind, setKind] = useState<"post" | "poll" | "media">("post");
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pickAudio = useRef<HTMLInputElement>(null);
  const pickImage = useRef<HTMLInputElement>(null);
  const pickVideo = useRef<HTMLInputElement>(null);
  // @mention autocomplete
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mentions, setMentions] = useState<{ id: string; username: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const mentionStart = useRef(-1);

  const onQChange = async (val: string, caret: number) => {
    setQ(val);
    const m = val.slice(0, caret).match(/@([\p{L}\p{N}_.-]*)$/u);
    if (m && m[1].length >= 1) {
      mentionStart.current = caret - m[0].length;
      const { data } = await mentionSearchCommunity(m[1]);
      setMentions(data?.users || []);
      setShowMentions((data?.users?.length || 0) > 0);
    } else { setShowMentions(false); }
  };
  const pickMention = (username: string) => {
    const ta = taRef.current; if (!ta) return;
    const caret = ta.selectionStart;
    const start = mentionStart.current >= 0 ? mentionStart.current : caret;
    const next = q.slice(0, start) + "@" + username + " " + q.slice(caret);
    setQ(next); setShowMentions(false);
    requestAnimationFrame(() => { ta.focus(); const p = start + username.length + 2; ta.setSelectionRange(p, p); });
  };

  const send = async () => {
    if (q.trim().length < 5) { setErr(t("community.tooShort")); return; }
    setSending(true); setErr(null);
    let res;
    if (isAdmin) {
      const options = kind === "poll" ? opts.map((o) => o.trim()).filter(Boolean) : undefined;
      res = await publishCommunityCardMedia({ question: q.trim(), type: kind === "poll" ? "poll" : "feedback", options }, { audio, image, video });
    } else {
      res = await proposeCommunityCard(q.trim(), kind === "poll" ? "poll" : "feedback", { audio, image, video });
    }
    setSending(false);
    if (res.error) { setErr(res.error); return; }
    onSent();
  };

  const Drop = ({ icon, label, hint, file, onPick, onClear }: { icon: React.ReactNode; label: string; hint: string; file: File | null; onPick: () => void; onClear: () => void }) => (
    <div className={`ci-drop${file ? " has" : ""}`} onClick={file ? undefined : onPick}>
      <div className="ic">{icon}</div>
      {file ? (<><div className="t">{file.name}</div><button className="ci-drop-x" onClick={(e) => { e.stopPropagation(); onClear(); }}><X size={14} /> {t("community.remove")}</button></>)
        : (<><div className="t">{label}</div><div className="h">{hint}</div></>)}
    </div>
  );

  return (
    <div className="ci-modal" onClick={onClose}>
      <div className="ci-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ci-grip" />
        <div className="ci-sheet-head"><b>{t("community.publish")}</b><button onClick={onClose}><X size={18} /></button></div>
        <div className="ci-sheet-body">
          <div className="ci-seg">
            <button className={kind === "post" ? "on" : ""} onClick={() => setKind("post")}>{t("community.typePost")}</button>
            <button className={kind === "poll" ? "on" : ""} onClick={() => setKind("poll")}>{t("community.typePoll")}</button>
            <button className={kind === "media" ? "on" : ""} onClick={() => setKind("media")}>{t("community.typeMedia")}</button>
          </div>
          <div className="ci-ta-wrap">
            <textarea ref={taRef} className="ci-ta" value={q} onChange={(e) => onQChange(e.target.value, e.target.selectionStart)} onBlur={() => setTimeout(() => setShowMentions(false), 150)} placeholder={t("community.proposePlaceholder")} />
            {showMentions && (
              <div className="ci-mentions">
                {mentions.map((u) => (
                  <button key={u.id} className="ci-mention" onMouseDown={(e) => { e.preventDefault(); pickMention(u.username); }}>
                    <span className="av">{u.username.slice(0, 2).toUpperCase()}</span> @{u.username}
                  </button>
                ))}
              </div>
            )}
          </div>
          {kind === "poll" && (
            <div className="ci-opts">
              {opts.map((o, i) => <input key={i} className="ci-field" value={o} placeholder={`${t("community.option")} ${i + 1}`} onChange={(e) => setOpts((cur) => cur.map((x, k) => k === i ? e.target.value : x))} />)}
              {opts.length < 5 && <button className="ci-addopt" onClick={() => setOpts((c) => [...c, ""])}><Plus size={14} /> {t("community.addOption")}</button>}
            </div>
          )}
          {kind === "media" && (
            <div className="ci-drops">
              <Drop icon={<Film size={20} />} label={t("community.video")} hint={t("community.videoHint")} file={video} onPick={() => pickVideo.current?.click()} onClear={() => setVideo(null)} />
              <Drop icon={<AudioLines size={20} />} label={t("community.audio")} hint={t("community.audioHint")} file={audio} onPick={() => pickAudio.current?.click()} onClear={() => setAudio(null)} />
              <Drop icon={<ImageIcon size={20} />} label={t("community.image")} hint={t("community.imageHint")} file={image} onPick={() => pickImage.current?.click()} onClear={() => setImage(null)} />
              <input ref={pickVideo} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => setVideo(e.target.files?.[0] || null)} />
              <input ref={pickAudio} type="file" accept="audio/*" hidden onChange={(e) => setAudio(e.target.files?.[0] || null)} />
              <input ref={pickImage} type="file" accept="image/*" hidden onChange={(e) => setImage(e.target.files?.[0] || null)} />
            </div>
          )}
          {err && <div className="ci-err">{err}</div>}
          <button className="ci-primary" onClick={send} disabled={sending || q.trim().length < 5}>{sending ? <Loader2 className="spin" size={16} /> : <Send size={16} />} {t("community.publish")}</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ci{position:absolute;inset:0;overflow:hidden;background:var(--bg-dark);
  --accent-green:#08DDB8;--accent-green-soft:rgba(8,221,184,.14);--primary-light:#08DDB8}
.ci .spin{animation:cispin 1s linear infinite}@keyframes cispin{to{transform:rotate(360deg)}}
.ci-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-muted);text-align:center;padding:24px}
.ci-empty-ic{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:var(--accent-green-soft);color:var(--accent-green)}
.ci-empty-t{font-family:'Inter Tight','Inter',sans-serif;font-weight:800;font-size:1.1rem;color:var(--text-primary)}
.ci-empty-s{font-size:.86rem;color:var(--text-muted)}
.ci-empty-cta{margin-top:8px;display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:100px;border:0;background:var(--accent-green);color:#04221d;font-weight:800;font-size:.86rem;cursor:pointer}

.ci-head{position:absolute;top:0;inset-inline:0;z-index:30;padding:12px 14px 24px;display:flex;align-items:center;justify-content:space-between;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.34),transparent)}
.ci-head>*{pointer-events:auto}
.ci-brand{font-family:'Inter Tight','Inter',sans-serif;font-weight:800;font-size:16px;letter-spacing:-.02em;color:#fff;display:flex;align-items:center;gap:8px;text-shadow:0 1px 6px rgba(0,0,0,.5)}
.ci-brand .dot{width:7px;height:7px;border-radius:50%;background:var(--accent-green);box-shadow:0 0 0 3px var(--accent-green-soft)}
.ci-head-r{display:flex;align-items:center;gap:9px}
.ci-hbtn{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.4);backdrop-filter:blur(6px);color:#fff;display:grid;place-items:center;cursor:pointer}
.ci-hbtn.pub{background:var(--accent-green);border-color:transparent;color:#04221d}

.ci-dots{position:absolute;inset-inline-start:7px;top:50%;transform:translateY(-50%);z-index:20;display:flex;flex-direction:column;gap:6px}
.ci-dots i{width:3px;height:13px;border-radius:3px;background:rgba(255,255,255,.32);transition:.3s}
.ci-dots i.on{background:var(--accent-green);height:20px}

.ci-feed{height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none}
.ci-feed::-webkit-scrollbar{display:none}
.ci-slide{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:var(--bg-dark)}

.ci-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ci-bg.img{background-size:cover;background-position:center}
.ci-bg.glow{background:
  radial-gradient(560px 380px at 80% 16%,var(--accent-green-soft),transparent 70%),
  radial-gradient(460px 320px at 10% 86%,var(--accent-green-soft),transparent 72%),
  var(--bg-dark)}
.ci-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.38) 0%,transparent 22%,transparent 46%,rgba(0,0,0,.62) 80%,rgba(0,0,0,.84) 100%)}

.ci-top{position:absolute;top:58px;inset-inline-start:16px;inset-inline-end:74px;z-index:3}
.ci-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--text-primary);background:var(--surface-2);border:1px solid var(--border);border-radius:100px;padding:6px 12px}
.ci-slide.media .ci-badge{color:#fff;background:rgba(0,0,0,.42);border-color:rgba(255,255,255,.2)}
.ci-badge.off{color:#04221d;background:linear-gradient(120deg,#5EEAD4,var(--accent-green));border-color:transparent}

/* Content sits at the bottom but is SCROLLABLE inside the slide when it's tall:
   the question never overlaps the badge (top boundary) nor the rail (right inset),
   and a long message + poll can be scrolled within the post itself. Responsive. */
.ci-over{position:absolute;inset-inline-start:0;inset-inline-end:72px;top:96px;bottom:100px;z-index:3;
  display:flex;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:0 20px}
.ci-over::-webkit-scrollbar{display:none}
.ci-content{margin-top:auto;width:100%;padding:4px 0}
.ci-q{font-family:'Inter Tight','Inter',sans-serif;font-weight:800;font-size:clamp(1.35rem,5.2vw,1.95rem);letter-spacing:-.02em;line-height:1.25;color:var(--text-primary);margin-bottom:16px;overflow-wrap:anywhere}
.ci-slide.media .ci-q{color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.7)}
.ci-q.ar{font-family:'Noto Kufi Arabic',sans-serif;direction:rtl;text-align:right;line-height:1.5}

.ci-poll{display:flex;flex-direction:column;gap:9px}
.ci-opt{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-radius:15px;cursor:pointer;background:var(--surface-2);border:1px solid var(--border);color:var(--text-primary);font-weight:600;font-size:.94rem;text-align:start}
.ci-slide.media .ci-opt{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.22);color:#fff;backdrop-filter:blur(4px)}
.ci-opt .bar{position:absolute;inset-inline-start:0;top:0;bottom:0;background:var(--accent-green-soft);z-index:0;transition:width .5s cubic-bezier(.2,.8,.2,1)}
.ci-slide.media .ci-opt .bar{background:rgba(8,221,184,.32)}
.ci-opt .lbl,.ci-opt .pct{position:relative;z-index:1}
.ci-opt .lbl.ar{font-family:'Noto Kufi Arabic',sans-serif;direction:rtl}
.ci-opt.mine{border-color:var(--accent-green)}
.ci-opt.win .pct{color:var(--accent-green);font-weight:800}
.ci-hint{font-size:12.5px;color:var(--text-muted);margin-top:5px}
.ci-slide.media .ci-hint{color:rgba(255,255,255,.7)}

.ci-rail{position:absolute;inset-inline-end:12px;bottom:116px;z-index:6;display:flex;flex-direction:column;gap:18px;align-items:center}
.ci-act{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:0;cursor:pointer;color:var(--text-secondary)}
.ci-act .b{width:48px;height:48px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border);box-shadow:0 4px 14px var(--shadow);display:grid;place-items:center;color:var(--text-primary);transition:.18s}
.ci-slide.media .ci-act{color:#fff}
.ci-slide.media .ci-act .b{background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(6px)}
.ci-act:active .b{transform:scale(.9)}
.ci-act .c{font-size:11px;font-weight:700}
.ci-slide.media .ci-act .c{text-shadow:0 1px 4px rgba(0,0,0,.5)}
.ci-act.liked{color:var(--danger)}.ci-act.liked .b{border-color:var(--danger);background:rgba(220,38,38,.14);color:var(--danger)}
.ci-act.del{color:var(--danger)}.ci-act.del .b{border-color:rgba(220,38,38,.4)}

/* sheets */
.ci-modal{position:fixed;inset:0;z-index:220;background:var(--overlay);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center}
.ci-sheet{background:var(--bg-elevated);width:100%;max-width:620px;max-height:82vh;border-radius:24px 24px 0 0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border);border-bottom:0}
.ci-sheet.tall{max-height:92vh}
.ci-grip{width:38px;height:4px;border-radius:4px;background:var(--border-hover);margin:10px auto 0}
.ci-sheet-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);font-size:.95rem;color:var(--text-primary)}
.ci-sheet-head button{background:none;border:0;color:var(--text-muted);cursor:pointer;display:flex}
.ci-sheet-body{overflow-y:auto;padding:16px 18px}

.ci-seg{display:flex;gap:6px;background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:14px}
.ci-seg button{flex:1;border:0;background:none;border-radius:9px;padding:9px;font-weight:700;font-size:.84rem;color:var(--text-muted);cursor:pointer}
.ci-seg button.on{background:var(--accent-green);color:#04221d}
.ci-ta-wrap{position:relative}
.ci-ta{width:100%;min-height:84px;background:var(--bg-input);border:1px solid var(--border);border-radius:14px;padding:14px;color:var(--text-primary);outline:none;font-family:inherit;font-size:1rem;resize:vertical}
.ci-ta:focus{border-color:var(--accent-green)}
.ci-mentions{position:absolute;inset-inline:0;top:calc(100% - 4px);z-index:6;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden auto;max-height:210px;box-shadow:0 14px 34px var(--shadow)}
.ci-mention{display:flex;align-items:center;gap:9px;width:100%;padding:9px 12px;background:none;border:0;border-bottom:1px solid var(--border);color:var(--text-primary);font-size:.88rem;font-weight:600;cursor:pointer;text-align:start}
.ci-mention:last-child{border-bottom:0}
.ci-mention:hover{background:var(--surface-2)}
.ci-mention .av{width:26px;height:26px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-size:10px;font-weight:800;background:linear-gradient(135deg,#1f4d44,var(--accent-green));color:#04221d}
.ci-opts{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.ci-field{width:100%;background:var(--bg-input);border:1px solid var(--border);border-radius:11px;padding:11px 13px;color:var(--text-primary);font-family:inherit;font-size:14px;outline:none}
.ci-field:focus{border-color:var(--accent-green)}
.ci-addopt{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--accent-green);font-weight:700;font-size:.82rem;cursor:pointer;padding:4px 2px}
.ci-drops{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.ci-drop{border:1.5px dashed var(--border-hover);border-radius:14px;padding:18px 16px;text-align:center;cursor:pointer;transition:.2s;background:var(--surface-1)}
.ci-drop:hover{border-color:var(--accent-green);background:var(--accent-green-soft)}
.ci-drop.has{border-style:solid;border-color:var(--accent-green);background:var(--accent-green-soft)}
.ci-drop .ic{width:44px;height:44px;border-radius:12px;margin:0 auto 8px;display:grid;place-items:center;background:var(--accent-green-soft);color:var(--accent-green)}
.ci-drop .t{font-size:13px;font-weight:700;color:var(--text-primary);word-break:break-all}
.ci-drop .h{font-size:11px;color:var(--text-muted);margin-top:3px}
.ci-drop-x{margin-top:8px;display:inline-flex;align-items:center;gap:5px;background:none;border:0;color:var(--danger);font-weight:700;font-size:.78rem;cursor:pointer}
.ci-err{color:var(--danger);font-size:.82rem;margin-top:12px}
.ci-primary{margin-top:14px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-radius:14px;border:0;background:var(--accent-green);color:#04221d;font-weight:800;font-size:.92rem;cursor:pointer}
.ci-primary:disabled{opacity:.5;cursor:default}

.ci-cm-empty{text-align:center;color:var(--text-muted);font-size:.85rem;padding:24px}
.ci-cm{display:flex;gap:10px;margin-bottom:14px}
.ci-cm-av{width:34px;height:34px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-weight:800;font-size:12px;background:linear-gradient(135deg,#1f4d44,var(--accent-green));color:#04221d}
.ci-cm-name{font-size:.78rem;font-weight:700;color:var(--text-secondary)}
.ci-cm-txt{font-size:.9rem;color:var(--text-primary);margin-top:2px;line-height:1.5}
.ci-cm-txt.ar{font-family:'Noto Kufi Arabic',sans-serif;direction:rtl;text-align:right}
.ci-cm-audio{margin-top:6px;height:34px;max-width:100%}
.ci-cm-img{margin-top:6px;max-width:160px;border-radius:10px;display:block}
.ci-cm-prev{position:relative;width:fit-content;margin:8px 0 0 14px}
.ci-cm-prev img{height:64px;border-radius:10px;display:block}
.ci-cm-prev button{position:absolute;top:-6px;inset-inline-end:-6px;width:22px;height:22px;border-radius:50%;border:0;background:var(--danger);color:#fff;cursor:pointer;display:grid;place-items:center}
.ci-cm-compose{display:flex;align-items:center;gap:8px;padding:12px 14px;border-top:1px solid var(--border)}
.ci-cm-compose input{flex:1;background:var(--bg-input);border:1px solid var(--border);border-radius:100px;padding:11px 16px;color:var(--text-primary);outline:none;font-family:inherit;font-size:.9rem}
.ci-mic{width:42px;height:42px;border-radius:50%;flex:0 0 auto;border:1px solid var(--border);background:var(--surface-2);color:var(--text-secondary);cursor:pointer;display:grid;place-items:center}
.ci-mic.rec{background:var(--danger);color:#fff;border-color:var(--danger)}
.ci-send{width:42px;height:42px;border-radius:50%;flex:0 0 auto;border:0;background:var(--accent-green);color:#04221d;cursor:pointer;display:grid;place-items:center}
.ci-send:disabled{opacity:.5;cursor:default}
`;
