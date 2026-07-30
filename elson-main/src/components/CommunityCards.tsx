"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageCircle, Heart, Send, Trash2, Lock, Unlock, Trophy, Users, Plus,
  ChevronDown, Star, MoreHorizontal, ArrowUp, BarChart2, ImagePlus, X, Maximize2, Minimize2, Film, ShieldCheck,
} from "lucide-react";
import {
  getCommunity, voteCommunityCard, likeCommunityCard, commentCommunityCard, proposeCommunityCard,
  adminCreateCommunityCard, publishCommunityCardMedia, adminDeleteCommunityCard, adminToggleCommunityCard,
  adminDeleteCommunityComment,
  adminGetCommunityLimits, adminSetCommunityLimits, adminGetCommunityEvalStats,
  adminPostNotification, adminCommunityBlock, adminListCommunityBlocked,
  adminExampleContributions, adminPublishExample, type ExampleContribution,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";
import { AudioRecorder } from "@/components/AudioRecorder";
import { WaveformAudio } from "@/components/WaveformAudio";

// Public media (images / audio / video) live under the backend's /recordings; resolve
// relative paths against the API origin (absolute http/blob/data URLs pass through).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const mediaUrl = (u?: string | null) => !u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : `${API_URL}${u.startsWith("/") ? "" : "/"}${u}`;

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const inputS: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: "0.88rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none" };

// ── Avatars: deterministic colorful gradient + initials (no photo needed) ──
const AV = [["#FF6B6B", "#FF8E53"], ["#6366F1", "#8B5CF6"], ["#10B981", "#34D399"], ["#F59E0B", "#FBBF24"], ["#EC4899", "#F472B6"], ["#3B82F6", "#06B6D4"], ["#8B5CF6", "#EC4899"], ["#14B8A6", "#10B981"]];
function grad(name: string) { let h = 0; for (const c of name || "?") h = (h * 31 + c.charCodeAt(0)) >>> 0; const g = AV[h % AV.length]; return `linear-gradient(135deg,${g[0]},${g[1]})`; }
function initials(name: string | null) { return (name || "?").trim().slice(0, 2); }
function Avatar({ name, size = 44 }: { name: string | null; size?: number }) {
  return <div className="cf-av" style={{ width: size, height: size, fontSize: size * 0.42, background: grad(name || "?") }}>{initials(name)}</div>;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24); if (d === 1) return "hier"; if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr", { day: "2-digit", month: "2-digit" });
}

export default function CommunityCards({ compact = false, adminPanelOnly = false }: { compact?: boolean; adminPanelOnly?: boolean }) {
  const { t } = useI18n();
  const [cards, setCards] = useState<any[]>([]);
  const [canPropose, setCanPropose] = useState(true);
  const [nextProposalAt, setNextProposalAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Record<number, string>>({});
  const [commentAudio, setCommentAudio] = useState<Record<number, Blob | null>>({});
  const [commentImg, setCommentImg] = useState<Record<number, File | null>>({});
  const [recNonce, setRecNonce] = useState<Record<number, number>>({});
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeText, setProposeText] = useState("");
  const [proposeType, setProposeType] = useState("poll");
  const [proposeAudio, setProposeAudio] = useState<Blob | null>(null);
  const [proposeImgFile, setProposeImgFile] = useState<File | null>(null);
  const [proposeVideoFile, setProposeVideoFile] = useState<File | null>(null);
  // admin
  const [adminQ, setAdminQ] = useState("");
  const [adminType, setAdminType] = useState("poll");
  const [adminBanner, setAdminBanner] = useState("");
  const [adminVideo, setAdminVideo] = useState<File | null>(null);
  const [adminImage, setAdminImage] = useState<File | null>(null);
  const [adminTextColor, setAdminTextColor] = useState(""); // "" = couleur par défaut du thème
  const [online, setOnline] = useState<string[]>([]);
  const [showOnline, setShowOnline] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevIds = useRef<Set<number> | null>(null);
  // posting gate (top-N) + admin limit editors
  const [canPost, setCanPost] = useState(true);
  const [communityTopN, setCommunityTopN] = useState(0);
  const [limTopN, setLimTopN] = useState("");
  const [limMinC, setLimMinC] = useState("");
  const [adminOnlyPost, setAdminOnlyPost] = useState(false); // "seul l'admin peut publier"
  const [evalCounts, setEvalCounts] = useState<number[]>([]);
  // moderation: announce/mention + per-user posting block
  const [annMsg, setAnnMsg] = useState("");
  const [annTarget, setAnnTarget] = useState(""); // empty = everyone
  const [annSent, setAnnSent] = useState(false);
  const [blockUser, setBlockUser] = useState("");
  const [blockedList, setBlockedList] = useState<{ id: string; username: string }[]>([]);
  // "example to imitate" + fullscreen
  const [exUser, setExUser] = useState("");
  const [exList, setExList] = useState<ExampleContribution[]>([]);
  const [exBusy, setExBusy] = useState<number | "load" | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false); // collapse admin tools so the feed stays front-and-center

  const load = useCallback(async () => {
    const { data } = await getCommunity();
    if (data) {
      const next = data.cards || [];
      // detect newly-arrived cards → "new activity" pill (skip first load)
      const ids = new Set<number>(next.map((c: any) => c.id));
      if (prevIds.current) {
        const fresh = [...ids].filter((id) => !prevIds.current!.has(id)).length;
        if (fresh > 0 && window.scrollY > 240) setNewCount((n) => n + fresh);
      }
      prevIds.current = ids;
      setCards(next);
      setCanPropose(data.canPropose);
      setNextProposalAt(data.nextProposalAt);
      setIsAdmin(data.isAdmin);
      setOnline(data.online || []);
      const d = data as any;
      setCanPost(d.canPost ?? true);
      setCommunityTopN(d.communityTopN ?? 0);
      if (data.isAdmin) {
        const { data: lim } = await adminGetCommunityLimits();
        if (lim) { setLimTopN(String(lim.communityTopN)); setLimMinC(String(lim.validateMinContributions)); setAdminOnlyPost(!!lim.adminOnly); }
        const { data: es } = await adminGetCommunityEvalStats();
        if (es) setEvalCounts(es.counts || []);
        const { data: bl } = await adminListCommunityBlocked();
        if (bl) setBlockedList(bl.blocked || []);
      }
    }
    setLoading(false);
  }, []);

  // ── Moderation handlers ──
  const sendAnnounce = async () => {
    if (!annMsg.trim()) return;
    // Strip a leading "@" so "@pseudo" resolves to the username "pseudo".
    const target = annTarget.trim().replace(/^@+/, "");
    const { error } = await adminPostNotification({ body: annMsg.trim(), level: "info", target: target || undefined });
    if (error) { alert(error); return; }
    setAnnMsg(""); setAnnSent(true); setTimeout(() => setAnnSent(false), 2500);
  };
  const blockAUser = async () => {
    const u = blockUser.trim().replace(/^@+/, "");
    if (!u) return;
    const { error } = await adminCommunityBlock({ username: u, blocked: true });
    if (error) { alert(error); return; }
    setBlockUser(""); load();
  };
  const unblockAUser = async (username: string) => {
    await adminCommunityBlock({ username, blocked: false }); load();
  };

  // ── "Example to imitate" ──
  const loadExamples = async () => {
    const u = exUser.trim().replace(/^@+/, "");
    if (!u) return;
    setExBusy("load");
    const { data, error } = await adminExampleContributions(u);
    setExBusy(null);
    if (error) { alert(error); setExList([]); return; }
    setExList(data?.contributions || []);
  };
  const publishExample = async (id: number) => {
    if (!confirm("Publier cet audio comme « exemple à imiter » dans la communauté ?")) return;
    setExBusy(id);
    const { error } = await adminPublishExample(id);
    setExBusy(null);
    if (error) { alert(error); return; }
    setExList([]); setExUser(""); load();
  };

  // ── Fullscreen (better visibility) ──
  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) await rootRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch { /* fullscreen unsupported / denied */ }
  };
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 8000); return () => clearInterval(id); }, [load]);

  const vote = async (id: number, choice: number) => { await voteCommunityCard(id, choice); load(); };
  const like = async (id: number, el?: Element | null) => {
    if (el) { el.classList.remove("cf-pop"); el.getBoundingClientRect(); el.classList.add("cf-pop"); }
    // optimistic toggle
    setCards((cs) => cs.map((c) => c.id === id ? { ...c, myLike: !c.myLike, likeCount: c.likeCount + (c.myLike ? -1 : 1) } : c));
    await likeCommunityCard(id); load();
  };
  const sendComment = async (id: number) => {
    const txt = (comment[id] || "").trim();
    const audio = commentAudio[id] || null;
    const image = commentImg[id] || null;
    if (!txt && !audio && !image) return;
    await commentCommunityCard(id, txt, { audio, image });
    setComment((c) => ({ ...c, [id]: "" }));
    setCommentAudio((c) => ({ ...c, [id]: null }));
    setCommentImg((c) => ({ ...c, [id]: null }));
    setRecNonce((c) => ({ ...c, [id]: (c[id] || 0) + 1 })); // remount recorder → clears its preview
    load();
  };
  const propose = async () => {
    if (proposeText.trim().length < 5) { alert(t("community.alertShortQuestion")); return; }
    const { error } = await proposeCommunityCard(proposeText.trim(), proposeType, { audio: proposeAudio, image: proposeImgFile, video: proposeVideoFile });
    if (error) alert(error); else { setProposeText(""); setProposeAudio(null); setProposeImgFile(null); setProposeVideoFile(null); setProposeOpen(false); load(); }
  };
  const createOfficial = async () => {
    if (!adminQ.trim()) return;
    const textColor = adminTextColor || undefined;
    if (adminVideo || adminImage) {
      const { error } = await publishCommunityCardMedia(
        { question: adminQ.trim(), type: adminType, banner_url: adminBanner.trim() || undefined, text_color: textColor },
        { video: adminVideo, image: adminImage },
      );
      if (error) { alert(error); return; }
    } else {
      await adminCreateCommunityCard({ question: adminQ.trim(), type: adminType, banner_url: adminBanner.trim() || undefined, text_color: textColor });
    }
    setAdminQ(""); setAdminBanner(""); setAdminVideo(null); setAdminImage(null); setAdminTextColor(""); load();
  };
  const saveLimits = async () => {
    await adminSetCommunityLimits({ communityTopN: parseInt(limTopN, 10) || 0, validateMinContributions: parseInt(limMinC, 10) || 0, adminOnly: adminOnlyPost });
    load();
  };

  const cooldownTxt = () => {
    if (!nextProposalAt) return "";
    const mins = Math.max(0, Math.ceil((new Date(nextProposalAt).getTime() - Date.now()) / 60000));
    return mins > 60 ? `${Math.ceil(mins / 60)} h` : `${mins} min`;
  };
  const dismissNew = () => { setNewCount(0); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (loading) return <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: "0.85rem" }}>…</div>;

  return (
    <div ref={rootRef}>
      {/* "new activity" pill */}
      {!adminPanelOnly && newCount > 0 && (
        <button className="cf-newpill" onClick={dismissNew}>
          <ArrowUp size={15} /> {newCount} {t("community.newPosts")}
        </button>
      )}

      {/* Online — stories row */}
      {!adminPanelOnly && (
        <>
          <div style={{ marginBottom: 4 }}>
            <button onClick={() => setShowOnline((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 4px", border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              {online.length} {t("community.online")}
              <ChevronDown size={14} style={{ transform: showOnline ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
          </div>
          {online.length > 0 && (
            <div className="cf-stories">
              {online.slice(0, showOnline ? 300 : 30).map((name) => (
                <div className="cf-story" key={name} title={name}>
                  <div className="cf-ring"><div className="cf-avwrap"><Avatar name={name} size={48} /><span className="cf-live" /></div></div>
                  <div className="cf-sname">{name}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ADMIN: collapsible tools — keep the feed front-and-center */}
      {isAdmin && !adminPanelOnly && (
        <button onClick={() => setAdminToolsOpen((o) => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "11px 16px", marginBottom: adminToolsOpen ? 12 : 18, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><ShieldCheck size={16} style={{ color: "var(--accent-green)" }} /> Outils de modération</span>
          <ChevronDown size={16} style={{ transform: adminToolsOpen ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--text-muted)" }} />
        </button>
      )}

      {/* ADMIN: moderation — announce/mention + per-user posting block */}
      {isAdmin && (adminToolsOpen || adminPanelOnly) && (
        <div style={card}>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12 }}>Modération</div>

          {/* Announce / mention */}
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Annonce / mention</div>
          <textarea value={annMsg} onChange={(e) => setAnnMsg(e.target.value)} placeholder="Message à diffuser…" rows={2} style={{ ...inputS, marginBottom: 8, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
            <input value={annTarget} onChange={(e) => setAnnTarget(e.target.value)} placeholder="@pseudo (vide = tout le monde)" style={{ ...inputS, flex: 1 }} />
            <button onClick={sendAnnounce} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
              <Send size={14} /> {annSent ? "Envoyé ✓" : "Envoyer"}
            </button>
          </div>

          {/* Per-user posting block */}
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Bloquer le posting d&apos;un user</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: blockedList.length ? 10 : 0 }}>
            <input value={blockUser} onChange={(e) => setBlockUser(e.target.value)} placeholder="@pseudo à bloquer" style={{ ...inputS, flex: 1 }} />
            <button onClick={blockAUser} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(248,113,113,0.12)", color: "var(--danger)", fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
              <Lock size={14} /> Bloquer
            </button>
          </div>
          {blockedList.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 9, background: "var(--surface-2)", marginBottom: 6 }}>
              <Lock size={12} style={{ color: "var(--danger)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{b.username}</span>
              <button onClick={() => unblockAUser(b.username)} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--accent-green)", fontSize: "0.74rem", fontWeight: 700 }}>
                <Unlock size={12} /> Débloquer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ADMIN: "exemple à imiter" — publier l'audio d'un contributeur précis */}
      {isAdmin && (adminToolsOpen || adminPanelOnly) && (
        <div style={card}>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 6 }}>🎧 Exemple à imiter</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 10 }}>Publie l&apos;audio d&apos;un contributeur précis comme modèle pour toute la communauté.</div>
          <div style={{ display: "flex", gap: 8, marginBottom: exList.length ? 12 : 0 }}>
            <input value={exUser} onChange={(e) => setExUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadExamples(); }} placeholder="@pseudo du contributeur" style={{ ...inputS, flex: 1 }} />
            <button onClick={loadExamples} disabled={exBusy === "load"} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", background: "var(--surface-2)", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap" }}>
              {exBusy === "load" ? "…" : "Voir ses audios"}
            </button>
          </div>
          {exList.map((c) => (
            <div key={c.id} style={{ background: "var(--surface-2)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>{c.source_lang?.toUpperCase()} · {c.status === "approved" ? "✅ approuvée" : c.status}</span>
                <button onClick={() => publishExample(c.id)} disabled={exBusy === c.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 100, border: "none", cursor: "pointer", background: "var(--accent-green)", color: "var(--on-primary)", fontWeight: 800, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                  {exBusy === c.id ? "…" : "Publier comme exemple"}
                </button>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 2 }}>{c.source_text}</div>
              <div dir="rtl" style={{ fontSize: "0.95rem", fontFamily: "'Cairo', sans-serif", color: "var(--text-primary)", marginBottom: 6 }}>{c.hassaniya_text}</div>
              <WaveformAudio src={c.audio_url} />
            </div>
          ))}
        </div>
      )}

      {/* Agenda / programme déplacé vers la page « Mon agenda » (/my-agenda). */}

      {/* Modération du temps (pause d'urgence / programmée) déplacée vers « Mon agenda » (/my-agenda). */}

      {/* ADMIN: competition limits — top-N posting + min-contributions to evaluate */}
      {isAdmin && (adminToolsOpen || adminPanelOnly) && (
        <div style={card}>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)", marginBottom: 10 }}>Limites compétition</div>
          {/* Admin-only posting: members can't publish; only the admin can */}
          <button onClick={() => setAdminOnlyPost((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "11px 14px", marginBottom: 14, borderRadius: 12, border: `1px solid ${adminOnlyPost ? "var(--accent-green)" : "var(--border)"}`, background: adminOnlyPost ? "var(--accent-green-soft)" : "var(--surface-2)", cursor: "pointer" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }}>
              <Lock size={15} style={{ color: adminOnlyPost ? "var(--accent-green)" : "var(--text-muted)" }} /> Seul l&apos;admin peut publier
            </span>
            <span style={{ width: 42, height: 24, borderRadius: 100, background: adminOnlyPost ? "var(--accent-green)" : "var(--border-hover)", position: "relative", flexShrink: 0, transition: ".2s" }}>
              <span style={{ position: "absolute", top: 2, insetInlineStart: adminOnlyPost ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".2s" }} />
            </span>
          </button>
          <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>Quand activé, les membres ne peuvent plus publier ni proposer — seul l&apos;admin publie. (N&apos;enregistre qu&apos;avec « Enregistrer ».)</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginBottom: 4 }}>Top N peut commenter/créer (0 = tous)</div>
              <input type="number" min={0} value={limTopN} onChange={(e) => setLimTopN(e.target.value)} style={{ ...inputS, width: 120 }} />
            </div>
            <div>
              <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginBottom: 4 }}>Contributions validées min. pour évaluer (0 = aucune)</div>
              <input type="number" min={0} value={limMinC} onChange={(e) => setLimMinC(e.target.value)} style={{ ...inputS, width: 120 }} />
            </div>
            <button onClick={saveLimits} className="btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem" }}>Enregistrer</button>
          </div>
          {evalCounts.length > 0 && (() => {
            const at = (th: number) => evalCounts.filter((c) => c >= th).length;
            const cur = parseInt(limMinC, 10) || 0;
            const sugg20 = evalCounts[Math.min(19, evalCounts.length - 1)];
            return (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--separator)", fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
                <div>À ce seuil ({cur}) : <b style={{ color: "var(--text-primary)" }}>{at(cur)}</b> évaluateurs éligibles</div>
                <div>Répartition : {[20, 50, 100, 150, 200, 300].map((th) => `≥${th}: ${at(th)}`).join("  ·  ")}</div>
                <div style={{ marginTop: 5, color: "var(--accent)" }}>💡 Vise ~15-25 évaluateurs. Pour ~20, mets le seuil ≈ <b>{sugg20}</b>. Quand les contributions montent, relève le seuil pour garder l'évaluation sélective.</div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ADMIN: create official card (+ optional banner URL / image / video) */}
      {isAdmin && (adminToolsOpen || adminPanelOnly) && (
        <div style={card}>
          <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)", marginBottom: 10 }}>{t("community.adminNewCard")}</div>
          <input value={adminQ} onChange={(e) => setAdminQ(e.target.value)} placeholder={t("community.cardPlaceholder")} style={inputS} />
          <input value={adminBanner} onChange={(e) => setAdminBanner(e.target.value)} placeholder="https://… (bannière, optionnel)" style={{ ...inputS, marginTop: 8 }} />
          {/* Optional text colour for the post title/message */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)" }}>Couleur du texte</span>
            {["", "#08DDB8", "#F59E0B", "#EF4444", "#6366F1", "#FFFFFF"].map((c) => (
              <button key={c || "def"} onClick={() => setAdminTextColor(c)} title={c || "Défaut"} style={{ width: 24, height: 24, borderRadius: "50%", cursor: "pointer", border: adminTextColor === c ? "2px solid var(--accent-green)" : "1px solid var(--border)", background: c || "var(--surface-3)", display: "grid", placeItems: "center", fontSize: 10, color: "var(--text-muted)" }}>{c ? "" : "A"}</button>
            ))}
            <label title="Couleur personnalisée" style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "1px solid var(--border)", cursor: "pointer", position: "relative", background: "conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)" }}>
              <input type="color" value={adminTextColor || "#08DDB8"} onChange={(e) => setAdminTextColor(e.target.value)} style={{ position: "absolute", inset: -4, width: 32, height: 32, border: "none", padding: 0, cursor: "pointer", opacity: 0 }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <label className="cf-tab" style={{ flex: "0 0 auto", cursor: "pointer", padding: "9px 14px" }}>
              <Film size={16} /> {adminVideo ? adminVideo.name.slice(0, 14) + "…" : "Vidéo"}
              <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => setAdminVideo(e.target.files?.[0] || null)} />
            </label>
            <label className="cf-tab" style={{ flex: "0 0 auto", cursor: "pointer", padding: "9px 14px" }}>
              <ImagePlus size={16} /> {adminImage ? adminImage.name.slice(0, 14) + "…" : t("community.photo")}
              <input type="file" accept="image/*" hidden onChange={(e) => setAdminImage(e.target.files?.[0] || null)} />
            </label>
            {(adminVideo || adminImage) && <button onClick={() => { setAdminVideo(null); setAdminImage(null); }} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}>Retirer</button>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <select value={adminType} onChange={(e) => setAdminType(e.target.value)} style={{ ...inputS, width: "auto", padding: "8px 10px" }}>
              <option value="poll">{t("community.pollWithOptions")}</option>
              <option value="feedback">{t("community.feedbackWithComments")}</option>
            </select>
            <button onClick={createOfficial} className="btn-primary" style={{ padding: "9px 20px", fontSize: "0.82rem" }}><Plus size={14} /> {t("community.publish")}</button>
          </div>
        </div>
      )}

      {/* Posting restricted to top-N — note for everyone else */}
      {!adminPanelOnly && !compact && !canPost && (
        <div className="cf-create" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600 }}>
          {t("community.topNOnly")}{communityTopN > 0 ? ` (top ${communityTopN})` : ""}
        </div>
      )}

      {/* USER: create post (composer) */}
      {!adminPanelOnly && !compact && canPost && (
        <div className="cf-create">
          {!proposeOpen ? (
            <div className="cf-ctop">
              <Avatar name={online[0] || "?"} size={42} />
              <button className="cf-fake" onClick={() => canPropose && setProposeOpen(true)}>
                {canPropose ? t("community.proposePlaceholder") : `${t("community.proposeAgainIn")}${cooldownTxt()}`}
              </button>
            </div>
          ) : (
            <>
              <textarea value={proposeText} onChange={(e) => setProposeText(e.target.value)} rows={2} placeholder={t("community.proposePlaceholder")} style={{ ...inputS, resize: "vertical" }} maxLength={300} autoFocus />
              {proposeImgFile && (
                <div className="cf-postimg" style={{ marginTop: 10 }}>
                  <img src={URL.createObjectURL(proposeImgFile)} alt="" />
                  <button onClick={() => setProposeImgFile(null)} style={{ position: "absolute", top: 8, insetInlineEnd: 8, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={16} /></button>
                </div>
              )}
              {proposeVideoFile && (
                <div className="cf-postvid" style={{ marginTop: 10 }}>
                  <video src={URL.createObjectURL(proposeVideoFile)} controls playsInline />
                  <button onClick={() => setProposeVideoFile(null)} style={{ position: "absolute", top: 8, insetInlineEnd: 8, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 2 }}><X size={16} /></button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <AudioRecorder onChange={setProposeAudio} size={46} />
                <label className="cf-tab" style={{ flex: "0 0 auto", cursor: "pointer", padding: "9px 14px" }}>
                  <ImagePlus size={16} /> {t("community.photo")}
                  <input type="file" accept="image/*" hidden onChange={(e) => setProposeImgFile(e.target.files?.[0] || null)} />
                </label>
                <label className="cf-tab" style={{ flex: "0 0 auto", cursor: "pointer", padding: "9px 14px" }}>
                  <Film size={16} /> Vidéo
                  <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => setProposeVideoFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="cf-tabs">
                <button className={`cf-tab ${proposeType === "poll" ? "on" : ""}`} onClick={() => setProposeType("poll")}><BarChart2 size={15} /> {t("community.poll")}</button>
                <button className={`cf-tab ${proposeType === "feedback" ? "on" : ""}`} onClick={() => setProposeType("feedback")}><MessageCircle size={15} /> {t("community.feedback")}</button>
                <button className="cf-tab" onClick={propose} style={{ background: "var(--primary)", color: "var(--on-primary)" }}>{t("community.propose")}</button>
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 8 }}>{t("community.proposeCooldownInfo")}</div>
            </>
          )}
        </div>
      )}

      {/* FEED */}
      {!adminPanelOnly && !compact && <div className="cf-sec">{t("community.title")}</div>}
      {!adminPanelOnly && cards.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: "0.85rem" }}>{t("community.noCards")}</div>}
      {!adminPanelOnly && cards.map((c) => {
        const accent = c.is_official ? "official" : c.type === "poll" ? "poll" : "feedback";
        return (
          <div key={c.id} className="cf-card">
            {c.is_official && c.banner_url ? (
              <div className="cf-banner">
                <img src={mediaUrl(c.banner_url)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="cf-bgrad" />
                <span className="cf-badge official cf-bbadge"><Star size={11} fill="currentColor" /> {t("community.official")}</span>
              </div>
            ) : (
              <div className={`cf-accent ${accent}`} />
            )}
            <div className="cf-pad">
              <div className="cf-head">
                <Avatar name={c.is_official ? "Elson" : c.created_name} size={44} />
                <div className="cf-meta">
                  <div className="cf-who">
                    {c.is_official ? "Elson" : (c.created_name || "?")}
                    {c.is_official && !c.banner_url && <span className="cf-badge official"><Star size={11} fill="currentColor" /> {t("community.official")}</span>}
                    {!c.is_official && <span className={`cf-badge ${c.type === "poll" ? "poll" : "feedback"}`}>{c.type === "poll" ? t("community.poll") : t("community.feedback")}</span>}
                  </div>
                  <div className="cf-time">{timeAgo(c.created_at)}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => adminToggleCommunityCard(c.id).then(load)} title={t("community.toggleOpen")} className="cf-menu">{c.status === "open" ? <Lock size={15} /> : <Unlock size={15} />}</button>
                    <button onClick={() => { if (confirm(t("community.confirmDeleteCard"))) adminDeleteCommunityCard(c.id).then(load); }} title={t("community.delete")} className="cf-menu" style={{ color: "var(--danger)" }}><Trash2 size={15} /></button>
                  </div>
                )}
                {!isAdmin && <button className="cf-menu"><MoreHorizontal size={18} /></button>}
              </div>

              <div className="cf-q" style={c.text_color ? { color: c.text_color } : undefined}>{c.question}</div>

              {c.video_url && (
                <div className="cf-postvid"><video src={mediaUrl(c.video_url)} controls playsInline preload="metadata" poster={c.image_url ? mediaUrl(c.image_url) : undefined} /></div>
              )}

              {!c.video_url && c.image_url && (
                <div className="cf-postimg"><img src={mediaUrl(c.image_url)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
              )}

              {c.audio_url && <div style={{ margin: "2px 0 14px" }}><WaveformAudio src={c.audio_url} /></div>}

              {/* poll */}
              {c.type === "poll" && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {c.options.map((opt: string, i: number) => {
                    const n = c.tally[i] ?? 0;
                    const pct = c.total > 0 ? Math.round((n / c.total) * 100) : 0;
                    const mine = c.myVote === i;
                    const win = c.majority === i;
                    const optVoters: { username: string | null; choice: number }[] = (c.voters || []).filter((v: { choice: number }) => v.choice === i);
                    return (
                      <div key={i}>
                        <button onClick={() => vote(c.id, i)} className={`cf-opt ${mine ? "mine" : ""}`}>
                          <div className={`cf-fill ${win ? "win" : "norm"}`} style={{ width: `${pct}%` }} />
                          <div className="cf-orow">
                            <span className="cf-lbl">{win && <Trophy size={13} className="win" style={{ color: "var(--accent-green)" }} />}{opt}{mine ? " ✓" : ""}</span>
                            <span className="cf-pct">{n} · {pct}%</span>
                          </div>
                        </button>
                        {optVoters.length > 0 && (
                          <div className="cf-voters">
                            {optVoters.map((v, vi) => <span key={vi} className="cf-vchip">{v.username || "?"}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="cf-tally">
                    <Users size={13} /> {c.total} {c.total > 1 ? t("community.votesWord") : t("community.voteWord")}
                    {c.majority !== null
                      ? <span className="win">• {t("community.majorityReached")} {c.options[c.majority]}</span>
                      : <span>• {t("community.majorityFrom")} {c.quorum} ({Math.max(0, c.quorum - c.total)} {t("community.remaining")})</span>}
                  </div>
                </div>
              )}

              {/* engagement footer — J'aime + Commenter (no share) */}
              <div className="cf-foot">
                <button className={`cf-fbtn ${c.myLike ? "liked" : ""}`} onClick={(e) => like(c.id, e.currentTarget.querySelector("svg"))}>
                  <Heart size={17} /> {c.likeCount > 0 ? c.likeCount : ""} {t("community.like") || "J'aime"}
                </button>
                <button className="cf-fbtn" onClick={() => document.getElementById(`cf-input-${c.id}`)?.focus()}>
                  <MessageCircle size={17} /> {(c.comments || []).length > 0 ? (c.comments || []).length : ""} {t("community.comment") || "Commenter"}
                </button>
              </div>
            </div>

            {/* comments */}
            <div className="cf-comments">
              {(c.comments || []).map((cm: any) => (
                <div key={cm.id} className="cf-cm">
                  <Avatar name={cm.username} size={33} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cf-bubble">
                      <div className="cf-cmname">{cm.username || "?"}</div>
                      {cm.body && <div className="cf-cmbody">{cm.body}</div>}
                      {cm.audio_url && <div style={{ marginTop: 6, minWidth: 180 }}><WaveformAudio src={cm.audio_url} /></div>}
                      {cm.image_url && <img src={mediaUrl(cm.image_url)} alt="" style={{ marginTop: 8, maxWidth: "100%", borderRadius: 10, display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    </div>
                    <div className="cf-cmtime">{cm.created_at ? timeAgo(cm.created_at) : ""}
                      {isAdmin && <button onClick={() => adminDeleteCommunityComment(cm.id).then(load)} title={t("community.delete")} style={{ marginInlineStart: 8, background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}><Trash2 size={12} /></button>}
                    </div>
                  </div>
                </div>
              ))}
              {/* image preview (audio preview is shown by the recorder itself) */}
              {commentImg[c.id] && (
                <div style={{ position: "relative", width: "fit-content", margin: "0 0 8px 42px" }}>
                  <img src={URL.createObjectURL(commentImg[c.id]!)} alt="" style={{ height: 64, borderRadius: 8, display: "block" }} />
                  <button onClick={() => setCommentImg((s) => ({ ...s, [c.id]: null }))} style={{ position: "absolute", top: -6, insetInlineEnd: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={12} /></button>
                </div>
              )}
              {canPost && (
                <div className="cf-composer">
                  <Avatar name={online[0] || "?"} size={33} />
                  <input id={`cf-input-${c.id}`} className="cf-cinput" value={comment[c.id] || ""} onChange={(e) => setComment((s) => ({ ...s, [c.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") sendComment(c.id); }} placeholder={t("community.commentPlaceholder")} maxLength={500} />
                  <label title={t("community.photo")} style={{ cursor: "pointer", color: "var(--text-muted)", display: "grid", placeItems: "center", width: 34, height: 34, flexShrink: 0 }}>
                    <ImagePlus size={18} />
                    <input type="file" accept="image/*" hidden onChange={(e) => setCommentImg((s) => ({ ...s, [c.id]: e.target.files?.[0] || null }))} />
                  </label>
                  <AudioRecorder key={`rec-${c.id}-${recNonce[c.id] || 0}`} size={34} onChange={(b) => setCommentAudio((s) => ({ ...s, [c.id]: b }))} />
                  <button onClick={() => sendComment(c.id)} className="cf-send"><Send size={15} /></button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
