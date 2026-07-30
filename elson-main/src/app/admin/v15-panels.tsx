"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  Activity, AlertTriangle, Bell, CheckCircle, Clock, Database,
  Power, Search, Send, Upload, UserCheck, Users, Zap,
} from "lucide-react";
import { apiFetch, apiMultipart } from "@/lib/api";

// ── Shared helpers ──
async function adminFetch<T = any>(path: string): Promise<T> {
  const { data } = await apiFetch<any>(path);
  return (data ?? {}) as T;
}
async function adminPost<T = any>(path: string, body: any): Promise<T> {
  const { data } = await apiFetch<any>(path, { method: "POST", body: JSON.stringify(body) });
  return (data ?? {}) as T;
}

const cardStyle: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 12 };
const labelStyle: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 4 };
const metricStyle: React.CSSProperties = { fontSize: "1.4rem", fontWeight: 800, background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };

// ════════════════════════════════════════════════════════════════════
// 1. INSCRITS — list users with filters, activate/deactivate
// ════════════════════════════════════════════════════════════════════
export function InscritsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActivated, setFilterActivated] = useState<"all" | "true" | "false">("all");
  const [filterRole, setFilterRole] = useState<"all" | "user" | "admin">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filterActivated !== "all") params.set("activated", filterActivated);
    if (filterRole !== "all") params.set("role", filterRole);
    params.set("page", String(page));
    params.set("limit", "50");
    const d = await adminFetch(`/api/m/x/users?${params.toString()}`);
    setData(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filterActivated, filterRole, page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleActivate = async (id: string) => {
    setBusy(true);
    await adminPost(`/api/m/x/users/${id}/activate`, {});
    setBusy(false);
    load();
  };
  const handleDeactivate = async (id: string) => {
    if (!confirm("Désactiver ce user ? Il ne pourra plus contribuer.")) return;
    setBusy(true);
    await adminPost(`/api/m/x/users/${id}/deactivate`, {});
    setBusy(false);
    load();
  };
  const handleBulk = async (value: boolean, scope: "selected" | "all") => {
    const verb = value ? "activer" : "désactiver";
    if (scope === "all") {
      if (!confirm(`${value ? "Activer" : "Désactiver"} TOUS les utilisateurs (sauf admins) ? Cette action affecte ${data?.counters?.total ?? "?"} comptes.`)) return;
    } else {
      if (selected.size === 0) return;
      if (!confirm(`${verb} ${selected.size} utilisateur(s) sélectionné(s) ?`)) return;
    }
    setBusy(true);
    const body = scope === "all"
      ? { scope: "all", value }
      : { scope: "list", userIds: [...selected], value };
    const r = await adminPost("/api/m/x/users/activate-bulk", body);
    setBusy(false);
    setSelected(new Set());
    alert(`${r?.affected ?? 0} comptes mis à jour.`);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Users size={20} color="var(--primary-light)" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Inscrits & Activation</h3>
      </div>

      {/* Counters */}
      {data?.counters && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            { v: data.counters.total, l: "Total" },
            { v: data.counters.activated, l: "Activés" },
            { v: data.counters.not_activated, l: "En attente" },
            { v: data.counters.admins, l: "Admins" },
            { v: data.counters.banned, l: "Bannis" },
          ].map((s, i) => (
            <div key={i} style={{ ...cardStyle, textAlign: "center", padding: 12, marginBottom: 0 }}>
              <div style={metricStyle}>{s.v ?? "-"}</div>
              <div style={labelStyle}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
          <input
            className="input" placeholder="Rechercher (nom, email, NNI, WhatsApp)…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 30, fontSize: "0.85rem" }}
          />
        </div>
        <select className="input" value={filterActivated} onChange={(e) => { setFilterActivated(e.target.value as any); setPage(1); }} style={{ fontSize: "0.8rem" }}>
          <option value="all">Activation : tous</option>
          <option value="true">Activés</option>
          <option value="false">En attente</option>
        </select>
        <select className="input" value={filterRole} onChange={(e) => { setFilterRole(e.target.value as any); setPage(1); }} style={{ fontSize: "0.8rem" }}>
          <option value="all">Rôle : tous</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {/* Bulk actions */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button disabled={busy || selected.size === 0} onClick={() => handleBulk(true, "selected")}
          className="btn-primary" style={{ padding: "8px 14px", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 5 }}>
          <UserCheck size={13} /> Activer sélection ({selected.size})
        </button>
        <button disabled={busy || selected.size === 0} onClick={() => handleBulk(false, "selected")}
          style={{ padding: "8px 14px", fontSize: "0.78rem", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.05)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <Power size={13} /> Désactiver sélection
        </button>
        <button disabled={busy} onClick={() => handleBulk(true, "all")}
          className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.78rem" }}>
          ⚡ Activer TOUS (non-admins)
        </button>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40 }}><Activity size={24} className="spin" /></div> : (
        <>
          <div style={labelStyle}>{data?.total ?? 0} résultat(s) · page {page}</div>
          {data?.users?.map((u: any) => (
            <div key={u.id} style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderColor: u.is_activated ? "rgba(22, 163, 74,0.18)" : "var(--border)" }}>
              <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSel(u.id)} disabled={u.role === "admin"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.username}</span>
                  {u.role === "admin" && <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, background: "var(--gradient-brand)", color: "white" }}>ADMIN</span>}
                  {!u.is_active && <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, background: "rgba(248,113,113,0.15)", color: "var(--danger)" }}>BANNI</span>}
                  {u.is_activated
                    ? <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, background: "rgba(22, 163, 74,0.15)", color: "var(--success)" }}>ACTIVÉ</span>
                    : <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-muted)" }}>EN ATTENTE</span>}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {u.email} · {u.first_name} {u.last_name} · {u.preferred_lang?.toUpperCase()} · {u.points ?? 0} pts · {u.total_contributions ?? 0} contrib
                </div>
                {u.activated_at && (
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Activé {new Date(u.activated_at).toLocaleString()} {u.activated_by_username ? `par ${u.activated_by_username}` : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {u.role !== "admin" && (u.is_activated
                  ? <button disabled={busy} onClick={() => handleDeactivate(u.id)}
                      style={{ fontSize: "0.7rem", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.05)", color: "var(--danger)", cursor: "pointer" }}>
                      Désactiver
                    </button>
                  : <button disabled={busy} onClick={() => handleActivate(u.id)}
                      className="btn-primary" style={{ fontSize: "0.7rem", padding: "5px 12px" }}>
                      Activer
                    </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary" style={{ padding: "8px 20px", fontSize: "0.8rem" }}>← Préc</button>
            <span style={{ padding: "8px 16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>Page {page}</span>
            <button disabled={data?.users?.length < 50} onClick={() => setPage(p => p + 1)} className="btn-secondary" style={{ padding: "8px 20px", fontSize: "0.8rem" }}>Suiv →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 2. COMPÉTITION — countdown + activation mode + status + prizes
// ════════════════════════════════════════════════════════════════════
const ACTIVATION_MODES = [
  { value: "open", label: "Ouvert (tous activés par défaut)" },
  { value: "invite_only", label: "Sur invitation (admin active)" },
  { value: "date_auto", label: "Auto par date" },
];
const STATUSES = [
  { value: "upcoming", label: "À venir (countdown affiché)" },
  { value: "active", label: "Active (contributions ouvertes)" },
  { value: "ended", label: "Terminée" },
];

export function CompetitionConfigPanel() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const d = await adminFetch<{ config: { key: string; value: string }[] }>("/api/m/config");
    const map: Record<string, string> = {};
    for (const r of d?.config ?? []) map[r.key] = r.value;
    setCfg(map);
    setDraft(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (key: string, value: string) => {
    setSaving(key);
    const r = await adminPost("/api/m/config", { key, value });
    setSaving(null);
    if (r?.success) {
      setCfg((c) => ({ ...c, [key]: value }));
      setDraft((c) => ({ ...c, [key]: value }));
      setSavedFlash(key);
      setTimeout(() => setSavedFlash((s) => (s === key ? null : s)), 1500);
    } else {
      alert(r?.error ?? "Erreur");
      load();
    }
  };

  const isDirty = (key: string) => (draft[key] ?? "") !== (cfg[key] ?? "");

  // Convert ISO to <input type="datetime-local"> value: "2026-06-01T00:00"
  const toLocal = (iso?: string) => {
    if (!iso) return "";
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
  };
  const fromLocal = (s: string) => {
    if (!s) return "";
    try { return new Date(s).toISOString(); } catch { return s; }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Activity size={24} className="spin" /></div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Zap size={20} color="var(--primary-light)" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Compétition</h3>
      </div>

      {/* Status */}
      <div style={cardStyle}>
        <div style={labelStyle}>Statut</div>
        <select value={cfg.competition_status ?? "upcoming"} disabled={saving === "competition_status"}
          onChange={(e) => update("competition_status", e.target.value)}
          className="input" style={{ fontSize: "0.9rem", padding: "10px" }}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 8 }}>
          Si "À venir" ou "Terminée", les endpoints de contribution sont bloqués (sauf admins).
        </p>
      </div>

      {/* Countdown date */}
      <div style={cardStyle}>
        <div style={labelStyle}><Clock size={11} style={{ display: "inline", marginRight: 4 }} />Date countdown landing page</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="datetime-local" value={toLocal(draft.countdown_date)}
            onChange={(e) => setDraft((d) => ({ ...d, countdown_date: fromLocal(e.target.value) }))}
            className="input" style={{ fontSize: "0.9rem", padding: "10px", flex: 1 }} />
          <button
            onClick={() => update("countdown_date", draft.countdown_date)}
            disabled={saving === "countdown_date" || !isDirty("countdown_date")}
            className="btn-primary" style={{ padding: "10px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            {saving === "countdown_date" ? <Activity size={13} className="spin" /> :
              savedFlash === "countdown_date" ? <><CheckCircle size={13} /> Sauvé</> :
              "Sauvegarder"}
          </button>
        </div>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6 }}>
          Affiché sur la page d'accueil publique. ISO actuel : <code>{cfg.countdown_date}</code>
          {isDirty("countdown_date") && <span style={{ color: "var(--accent)", marginLeft: 8 }}>· non sauvegardé</span>}
        </p>
      </div>

      {/* Activation mode */}
      <div style={cardStyle}>
        <div style={labelStyle}>Mode d'activation</div>
        <select value={cfg.competition_activation_mode ?? "date_auto"}
          onChange={(e) => update("competition_activation_mode", e.target.value)}
          className="input" style={{ fontSize: "0.9rem", padding: "10px" }}>
          {ACTIVATION_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 8 }}>
          <strong>Ouvert</strong> : tout user inscrit peut contribuer dès que le statut est "Active".<br/>
          <strong>Invitation</strong> : un admin doit explicitement activer chaque user (onglet Inscrits).<br/>
          <strong>Auto par date</strong> : tous les users deviennent activés à la date ci-dessous.
        </p>
      </div>

      {/* Auto-activation date */}
      {cfg.competition_activation_mode === "date_auto" && (
        <div style={cardStyle}>
          <div style={labelStyle}>Date d'auto-activation (à partir de quand les users peuvent participer)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="datetime-local" value={toLocal(draft.competition_activate_at)}
              onChange={(e) => setDraft((d) => ({ ...d, competition_activate_at: fromLocal(e.target.value) }))}
              className="input" style={{ fontSize: "0.9rem", padding: "10px", flex: 1 }} />
            <button
              onClick={() => update("competition_activate_at", draft.competition_activate_at)}
              disabled={saving === "competition_activate_at" || !isDirty("competition_activate_at")}
              className="btn-primary" style={{ padding: "10px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
              {saving === "competition_activate_at" ? <Activity size={13} className="spin" /> :
                savedFlash === "competition_activate_at" ? <><CheckCircle size={13} /> Sauvé</> :
                "Sauvegarder"}
            </button>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6 }}>
            Quand cette date est atteinte, tous les users existants sont activés automatiquement. ISO actuel : <code>{cfg.competition_activate_at}</code>
            {isDirty("competition_activate_at") && <span style={{ color: "var(--accent)", marginLeft: 8 }}>· non sauvegardé</span>}
          </p>
        </div>
      )}

      {/* Notifications kill switch */}
      <div style={cardStyle}>
        <div style={labelStyle}>Worker notifications</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={cfg.notifications_enabled ?? "true"}
            onChange={(e) => update("notifications_enabled", e.target.value)}
            className="input" style={{ fontSize: "0.9rem", padding: "10px", flex: 1 }}>
            <option value="true">Activé</option>
            <option value="false">Désactivé (kill switch)</option>
          </select>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Rate : {cfg.notifications_rate_per_min ?? 60} mails/min
          </span>
        </div>
      </div>

      {/* Prizes */}
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { key: "prize_1st", label: "1er prix (MRU)" },
          { key: "prize_2nd", label: "2e prix (MRU)" },
          { key: "prize_3rd", label: "3e prix (MRU)" },
        ].map((p) => (
          <div key={p.key}>
            <div style={labelStyle}>{p.label}</div>
            <input type="number" value={cfg[p.key] ?? ""} className="input"
              onBlur={(e) => { if (e.target.value !== cfg[p.key]) update(p.key, e.target.value); }}
              onChange={(e) => setCfg((c) => ({ ...c, [p.key]: e.target.value }))}
              style={{ fontSize: "0.9rem", padding: "10px" }} />
          </div>
        ))}
      </div>

      {/* Leaderboard anonymity */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={labelStyle}>🕵️ Anonymat du classement public</div>
          {(() => {
            const anon = (cfg.leaderboard_anonymous ?? "true") !== "false";
            return (
              <button onClick={() => update("leaderboard_anonymous", anon ? "false" : "true")} disabled={saving === "leaderboard_anonymous"}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", border: "none", background: anon ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: anon ? "#10b981" : "var(--danger, #ef4444)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: anon ? "#10b981" : "var(--danger, #ef4444)" }} />
                {anon ? "Anonyme (codes)" : "Noms visibles"}
              </button>
            );
          })()}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Anonyme : le classement public affiche des codes rotatifs (personne n'est identifiable). Désactivé : <b>tout le monde voit les vrais noms</b> — à utiliser volontairement (ex. transparence en fin de compétition).
        </div>
      </div>

      {/* Auto-switch validate → contribute when eval queue is drained */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={labelStyle}>🔄 Bascule auto évaluation → contribution</div>
          {(() => {
            const on = (cfg.auto_switch_when_eval_done ?? "true") !== "false";
            return (
              <button onClick={() => update("auto_switch_when_eval_done", on ? "false" : "true")} disabled={saving === "auto_switch_when_eval_done"}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", border: "none", background: on ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.15)", color: on ? "#10b981" : "var(--text-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#10b981" : "var(--text-muted)" }} />
                {on ? "Activé" : "Désactivé"}
              </button>
            );
          })()}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Activé : dès qu'il n'y a plus aucune phrase à évaluer pendant un créneau <b>évaluation</b>, la <b>contribution</b> s'ouvre automatiquement jusqu'à la fin du créneau et une notification part à tout le monde (une seule fois par créneau).
        </div>
      </div>

      {/* Email verification hard gate */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={labelStyle}>📧 Vérification email obligatoire</div>
          {(() => {
            const on = (cfg.email_verification_required ?? "true") !== "false";
            return (
              <button onClick={() => update("email_verification_required", on ? "false" : "true")} disabled={saving === "email_verification_required"}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", border: "none", background: on ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.15)", color: on ? "#10b981" : "var(--text-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#10b981" : "var(--text-muted)" }} />
                {on ? "Activé" : "Désactivé"}
              </button>
            );
          })()}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Activé : un utilisateur doit confirmer son email avant de contribuer/évaluer. À désactiver uniquement si l'envoi d'emails (SMTP) est en panne.
        </div>
      </div>

      {/* Registration kill-switch */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={labelStyle}>🚪 Inscriptions ouvertes</div>
          {(() => {
            const open = (cfg.registration_open ?? "true") !== "false";
            return (
              <button onClick={() => update("registration_open", open ? "false" : "true")} disabled={saving === "registration_open"}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", border: "none", background: open ? "rgba(16,185,129,0.15)" : "rgba(248,113,113,0.15)", color: open ? "#10b981" : "#f87171" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: open ? "#10b981" : "#f87171" }} />
                {open ? "Ouvertes" : "Fermées"}
              </button>
            );
          })()}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Fermées : la page d'inscription est bloquée côté serveur (nouveaux comptes refusés). Les comptes existants ne sont pas affectés.
        </div>
      </div>

      {/* Allowed countries for registration (WhatsApp dialing-code allow-list) */}
      <div style={cardStyle}>
        <div style={labelStyle}>🌍 Pays autorisés à l'inscription</div>
        {(() => {
          const COUNTRIES = [
            { code: "222", flag: "🇲🇷", name: "Mauritanie" }, { code: "216", flag: "🇹🇳", name: "Tunisie" },
            { code: "33", flag: "🇫🇷", name: "France" }, { code: "212", flag: "🇲🇦", name: "Maroc" },
            { code: "213", flag: "🇩🇿", name: "Algérie" }, { code: "221", flag: "🇸🇳", name: "Sénégal" },
            { code: "223", flag: "🇲🇱", name: "Mali" }, { code: "20", flag: "🇪🇬", name: "Égypte" },
            { code: "966", flag: "🇸🇦", name: "Arabie S." }, { code: "971", flag: "🇦🇪", name: "Émirats" },
            { code: "974", flag: "🇶🇦", name: "Qatar" }, { code: "32", flag: "🇧🇪", name: "Belgique" },
            { code: "49", flag: "🇩🇪", name: "Allemagne" }, { code: "34", flag: "🇪🇸", name: "Espagne" },
          ];
          const current = (cfg.allowed_whatsapp_countries ?? "").split(",").map((c) => c.replace(/\D/g, "")).filter(Boolean);
          const toggle = (code: string) => {
            const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
            update("allowed_whatsapp_countries", next.join(","));
          };
          const restricted = current.length > 0;
          return (
            <>
              <div style={{ fontSize: "0.72rem", color: restricted ? "#f59e0b" : "var(--text-muted)", margin: "6px 0 12px", lineHeight: 1.5 }}>
                {restricted
                  ? `Restreint : seuls ces ${current.length} pays peuvent créer un compte (vérifié sur le numéro WhatsApp).`
                  : "Aucune restriction — tous les pays sont autorisés. Sélectionne des pays pour restreindre."}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COUNTRIES.map((c) => {
                  const on = current.includes(c.code);
                  return (
                    <button key={c.code} type="button" onClick={() => toggle(c.code)} disabled={saving === "allowed_whatsapp_countries"}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 100, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", border: `1px solid ${on ? "rgba(16,185,129,0.4)" : "var(--border)"}`, background: on ? "rgba(16,185,129,0.15)" : "transparent", color: on ? "#10b981" : "var(--text-muted)" }}>
                      <span>{c.flag}</span> {c.name} <span style={{ opacity: 0.6 }}>+{c.code}</span>
                    </button>
                  );
                })}
              </div>
              {restricted && (
                <button onClick={() => update("allowed_whatsapp_countries", "")} disabled={saving === "allowed_whatsapp_countries"}
                  style={{ marginTop: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: "0.72rem", cursor: "pointer" }}>
                  Tout autoriser (vider)
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* Referral system: master ON/OFF + cap */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={labelStyle}>🤝 Système de parrainage</div>
          {(() => {
            const on = (cfg.referral_enabled ?? "true") !== "false";
            return (
              <button onClick={() => update("referral_enabled", on ? "false" : "true")} disabled={saving === "referral_enabled"}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 100, fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", border: "none", background: on ? "rgba(16,185,129,0.15)" : "rgba(148,163,184,0.15)", color: on ? "#10b981" : "var(--text-muted)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#10b981" : "var(--text-muted)" }} />
                {on ? "Activé" : "Désactivé"}
              </button>
            );
          })()}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
          Désactivé : le lien de parrainage, la récolte et l'onglet Ambassadeurs disparaissent partout (les points déjà acquis sont conservés).
        </div>
        <div style={labelStyle}>Plafond parrainage (% des points propres)</div>
        <input type="number" min={0} max={500} value={cfg.referral_cap_percent ?? "50"} className="input"
          onBlur={(e) => { if (e.target.value !== (cfg.referral_cap_percent ?? "50")) update("referral_cap_percent", e.target.value); }}
          onChange={(e) => setCfg((c) => ({ ...c, referral_cap_percent: e.target.value }))}
          style={{ fontSize: "0.9rem", padding: "10px", maxWidth: 160 }} />
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          Les points Ambassadeur d'un user ne peuvent jamais dépasser ce % de ses points propres (contribution).
          50 = équilibré : impossible de doubler un vrai contributeur juste en recrutant.
        </div>
      </div>

      <ReferralTracking />
    </div>
  );
}

// Validation queue per dataset (phrase origin) + language.
export function DatasetQueuePanel() {
  type Row = { dataset: string; lang: string; phrases: number; to_evaluate: number; frozen: number; approved: number; rejected: number; untranslated: number };
  const [rows, setRows] = useState<Row[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => adminFetch<{ datasets: Row[]; disabledOrigins: string[] }>("/api/m/dataset-stats").then((d) => { setRows(d?.datasets ?? []); setDisabled(d?.disabledOrigins ?? []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const toggleOrigin = async (origin: string, off: boolean) => {
    const r = await adminPost<{ disabledOrigins?: string[] }>("/api/m/eval-origin", { origin, disabled: off });
    if (r?.disabledOrigins) setDisabled(r.disabledOrigins);
  };

  // ZIP export of the validated corpus (CSV + audio) — token + direct streaming download.
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const [dlLang, setDlLang] = useState("ar");
  const [dlAudio, setDlAudio] = useState(true);
  const [dling, setDling] = useState(false);
  const downloadZip = async () => {
    setDling(true);
    const r = await adminFetch<{ url?: string }>(`/api/m/dataset-zip-token?lang=${dlLang}&audio=${dlAudio ? 1 : 0}`);
    setDling(false);
    if (r?.url) window.location.href = API_URL + r.url;
  };

  const tot = rows.reduce((a, r) => ({
    phrases: a.phrases + r.phrases, toEval: a.toEval + r.to_evaluate, frozen: a.frozen + r.frozen,
    approved: a.approved + r.approved, rejected: a.rejected + r.rejected, untranslated: a.untranslated + r.untranslated,
  }), { phrases: 0, toEval: 0, frozen: 0, approved: 0, rejected: 0, untranslated: 0 });

  const cell: CSSProperties = { padding: "8px 9px", fontSize: "0.82rem", textAlign: "center" };
  const head: CSSProperties = { ...cell, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.03em" };

  return (
    <div style={{ background: "var(--surface-1, var(--bg-elevated))", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>📊 File d'évaluation par dataset</h3>
        <button onClick={() => { setLoading(true); load(); }} style={{ fontSize: "0.72rem", fontWeight: 700, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)", cursor: "pointer" }}>↻ Rafraîchir</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 8, marginBottom: 14 }}>
        {[
          { v: tot.toEval, l: "À évaluer", c: "#d97706" },
          { v: tot.frozen, l: "Gelées", c: "#6366f1" },
          { v: tot.rejected, l: "Rejetées", c: "var(--danger, #ef4444)" },
          { v: tot.approved, l: "Approuvées", c: "var(--accent-green, #10b981)" },
          { v: tot.untranslated, l: "Non traduites", c: "var(--text-muted)" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center", padding: "10px 8px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: s.c }}>{s.v.toLocaleString()}</div>
            <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
        <b style={{ color: "#6366f1" }}>Gelées</b> = en attente mais non servies (auteur suspendu/disqualifié/exclu ou en quarantaine). Le toggle <b>Éval</b> coupe un corpus de l'évaluation.
      </div>

      {/* Export ZIP du corpus validé (CSV + audios) */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "11px 13px", marginBottom: 14, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>⬇️ Corpus validé (entraînement)</span>
        <div style={{ display: "flex", gap: 5 }}>
          {["ar", "en", "fr"].map((l) => (
            <button key={l} onClick={() => setDlLang(l)} style={{ padding: "5px 11px", borderRadius: 8, fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", cursor: "pointer", border: `1px solid ${dlLang === l ? "var(--accent-green, #10b981)" : "var(--border)"}`, background: dlLang === l ? "rgba(16,185,129,0.14)" : "transparent", color: dlLang === l ? "var(--accent-green, #10b981)" : "var(--text-secondary)" }}>{l}</button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.74rem", color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={dlAudio} onChange={(e) => setDlAudio(e.target.checked)} /> avec audio
        </label>
        <button onClick={downloadZip} disabled={dling} style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, fontWeight: 800, fontSize: "0.78rem", cursor: dling ? "default" : "pointer", border: "none", background: "var(--accent-green, #10b981)", color: "#fff", opacity: dling ? 0.6 : 1 }}>
          {dling ? "Préparation…" : "Télécharger ZIP"}
        </button>
        <span style={{ flexBasis: "100%", fontSize: "0.66rem", color: "var(--text-muted)" }}>ZIP = metadata.csv (phrase ↔ traduction ↔ fichier audio ↔ scores) + dossier audio/. AR ≈ 200 Mo avec audio.</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.85rem" }}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucun dataset.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ ...head, textAlign: "left" }}>Dataset</th>
                <th style={head}>Lang</th>
                <th style={head}>Phrases</th>
                <th style={head}>À évaluer</th>
                <th style={head}>Gelées</th>
                <th style={head}>Approuv.</th>
                <th style={head}>Rejetées</th>
                <th style={head}>Éval</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const off = disabled.includes(r.dataset);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)", opacity: off ? 0.55 : 1 }}>
                    <td style={{ ...cell, textAlign: "left", fontWeight: 700 }}>{r.dataset}</td>
                    <td style={{ ...cell, textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>{r.lang}</td>
                    <td style={cell}>{r.phrases.toLocaleString()}</td>
                    <td style={{ ...cell, fontWeight: 800, color: r.to_evaluate > 0 ? "#d97706" : "var(--text-muted)" }}>{r.to_evaluate.toLocaleString()}</td>
                    <td style={{ ...cell, fontWeight: 700, color: r.frozen > 0 ? "#6366f1" : "var(--text-muted)" }}>{r.frozen.toLocaleString()}</td>
                    <td style={{ ...cell, color: "var(--accent-green, #10b981)", fontWeight: 700 }}>{r.approved.toLocaleString()}</td>
                    <td style={{ ...cell, color: r.rejected > 0 ? "var(--danger, #ef4444)" : "var(--text-muted)", fontWeight: 700 }}>{r.rejected.toLocaleString()}</td>
                    <td style={cell}>
                      <button onClick={() => toggleOrigin(r.dataset, !off)} style={{ fontSize: "0.6rem", fontWeight: 800, padding: "4px 9px", borderRadius: 100, cursor: "pointer", textTransform: "uppercase", border: "none", background: off ? "rgba(239,68,68,0.14)" : "rgba(16,185,129,0.14)", color: off ? "var(--danger, #ef4444)" : "var(--accent-green, #10b981)" }}>{off ? "OFF" : "ON"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Estimation simulator — observed pace (editable) × contributors × hours.
export function ThroughputSimulatorPanel() {
  type Pace = { perHour: number | null; medianGapSec: number | null; activeUsers: number };
  const [data, setData] = useState<{ contribute: Pace; evaluate: Pace; backlogToEvaluate: number } | null>(null);
  const [contributors, setContributors] = useState(50);
  const [hours, setHours] = useState(4);
  const [cRate, setCRate] = useState(20);
  const [eRate, setERate] = useState(80);
  useEffect(() => {
    adminFetch<{ contribute: Pace; evaluate: Pace; backlogToEvaluate: number }>("/api/m/throughput").then((d) => {
      if (!d) return;
      setData(d);
      if (d.contribute?.perHour) setCRate(d.contribute.perHour);
      if (d.evaluate?.perHour) setERate(d.evaluate.perHour);
    });
  }, []);

  const estContrib = Math.round(contributors * hours * cRate);
  const estEval = Math.round(contributors * hours * eRate);
  const backlog = data?.backlogToEvaluate ?? 0;
  const hoursToClear = contributors > 0 && eRate > 0 ? backlog / (contributors * eRate) : null;

  const input: CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 700, fontFamily: "inherit" };
  const lbl: CSSProperties = { fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 3, display: "block" };

  return (
    <div style={{ background: "var(--surface-1, var(--bg-elevated))", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: 6 }}>🧮 Simulateur d'estimation</h3>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Débit réel observé (14 derniers jours, par contributeur actif) — pré-rempli et éditable.
        {data && <> Contribution : <b>{data.contribute.perHour ?? "—"}/h</b> · Évaluation : <b>{data.evaluate.perHour ?? "—"}/h</b>.</>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        <label><span style={lbl}>Contributeurs</span><input type="number" min={0} value={contributors} onChange={(e) => setContributors(Math.max(0, Number(e.target.value) || 0))} style={input} /></label>
        <label><span style={lbl}>Durée (heures)</span><input type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))} style={input} /></label>
        <label><span style={lbl}>Phrases/h /pers.</span><input type="number" min={0} value={cRate} onChange={(e) => setCRate(Math.max(0, Number(e.target.value) || 0))} style={input} /></label>
        <label><span style={lbl}>Évals/h /pers.</span><input type="number" min={0} value={eRate} onChange={(e) => setERate(Math.max(0, Number(e.target.value) || 0))} style={input} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ textAlign: "center", padding: "14px", borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--accent-green, #10b981)" }}>{estContrib.toLocaleString()}</div>
          <div style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Phrases contribuées (estim.)</div>
        </div>
        <div style={{ textAlign: "center", padding: "14px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#6366f1" }}>{estEval.toLocaleString()}</div>
          <div style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Évaluations (estim.)</div>
        </div>
      </div>

      {backlog > 0 && hoursToClear != null && (
        <div style={{ marginTop: 12, fontSize: "0.78rem", color: "var(--text-secondary)", padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          File actuelle à évaluer : <b style={{ color: "#d97706" }}>{backlog.toLocaleString()}</b>. Avec {contributors} évaluateurs à {eRate}/h, vidée en <b>{hoursToClear < 1 ? `${Math.ceil(hoursToClear * 60)} min` : `${hoursToClear.toFixed(1)} h`}</b>.
        </div>
      )}
    </div>
  );
}

// Admin referral tracking — who referred whom, totals, ambassador points.
function ReferralTracking() {
  const [rows, setRows] = useState<{ referrer: string; referrer_points: number; ambassador_points: number; referees: number; referees_approved: number }[]>([]);
  useEffect(() => { adminFetch<{ referrers: typeof rows }>("/api/m/referrals").then((d) => setRows(d?.referrers ?? [])); }, []);
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>📊 Suivi des parrainages</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "8px 0" }}>Aucun parrainage pour le moment.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.9fr", gap: 8, fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", color: "var(--text-muted)", padding: "0 4px" }}>
            <span>Parrain</span><span>Filleuls</span><span>Approuvées</span><span>Pts Amb.</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.9fr", gap: 8, fontSize: "0.78rem", padding: "7px 4px", borderTop: "1px solid var(--border)", alignItems: "center" }}>
              <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.referrer}</span>
              <span>{r.referees}</span>
              <span>{r.referees_approved.toLocaleString()}</span>
              <span style={{ fontWeight: 800, color: "var(--accent-green, #10b981)" }}>{r.ambassador_points.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 3. NOTIFICATIONS — compose + history
// ════════════════════════════════════════════════════════════════════
// Default message pre-filled in the composer (editable). Bilingual, {{username}} substituted.
const DEFAULT_SUBJECT = "Elson — information";
const DEFAULT_BODY = "Bonjour {{username}},\n\nMerci de faire partie de la communauté Elson Hassaniya 🌙\n\n[Écris ton message ici]\n\nL'équipe Elson";

export function NotificationsPanel() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<string[]>(["email", "whatsapp"]);
  // multi-target: one message → any combination of these at once
  const [tAll, setTAll] = useState(false);
  const [tGroup, setTGroup] = useState(false);
  const [tList, setTList] = useState(false);
  const [tInApp, setTInApp] = useState(false);
  const [groups, setGroups] = useState<{ id: string; subject: string; size: number }[]>([]);
  const [groupId, setGroupId] = useState("");
  const [savedLists, setSavedLists] = useState<{ id: number; name: string; recipients: string[] }[]>([]);
  const [media, setMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [section, setSection] = useState<"broadcast" | "inapp">("broadcast");
  // ── ad-hoc broadcast list (existing users by name + free numbers) ──
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipInput, setRecipInput] = useState("");
  // ── in-app announcements (bell) ──
  const [iaTitle, setIaTitle] = useState("");
  const [iaBody, setIaBody] = useState("");
  const [iaLevel, setIaLevel] = useState("info");
  const [iaTarget, setIaTarget] = useState("");
  const [iaList, setIaList] = useState<any[]>([]);
  const [iaUsers, setIaUsers] = useState<{ id: string; username: string; whatsapp?: string | null }[]>([]);
  const [iaPosting, setIaPosting] = useState(false);

  const loadIa = async () => {
    const d = await adminFetch<{ items: any[] }>("/api/m/app-notifications");
    setIaList(d?.items ?? []);
  };
  useEffect(() => {
    loadIa();
    adminFetch<{ items: { id: string; username: string; whatsapp?: string | null }[] }>("/api/m/users-list").then((d) => setIaUsers(d?.items ?? []));
    adminFetch<{ groups: { id: string; subject: string; size: number }[] }>("/api/m/whatsapp/groups").then((d) => {
      const gs = (d?.groups ?? []).slice().sort((a, b) => b.size - a.size);
      setGroups(gs);
      if (gs.length) setGroupId(gs[0].id); // default to the biggest group
    });
    loadLists();
  }, []);

  const loadLists = async () => {
    const d = await adminFetch<{ lists: { id: number; name: string; recipients: string[] }[] }>("/api/m/broadcast-lists");
    setSavedLists(d?.lists ?? []);
  };
  const saveList = async () => {
    if (recipients.length === 0) { alert("La liste est vide — ajoute des destinataires d'abord."); return; }
    const name = window.prompt("Nom de la liste de diffusion :", "");
    if (!name || !name.trim()) return;
    const r = await adminPost("/api/m/broadcast-lists", { name: name.trim(), recipients });
    if (r?.success) { loadLists(); alert(`Liste « ${r.name} » enregistrée (${r.count} destinataires).`); }
    else alert(r?.error || "Échec de l'enregistrement");
  };
  const deleteList = async (id: number, name: string) => {
    if (!confirm(`Supprimer la liste « ${name} » ?`)) return;
    await adminPost(`/api/m/broadcast-lists/${id}/delete`, {});
    loadLists();
  };
  const onMediaPick = async (file: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { alert("Fichier trop lourd (max 25 Mo)."); return; }
    setUploadingMedia(true);
    const fd = new FormData();
    fd.append("file", file);
    const { data, error } = await apiMultipart<{ url: string; type: string }>("/api/m/notification-media", fd);
    setUploadingMedia(false);
    if (data?.url) setMedia({ url: data.url, type: data.type, name: file.name });
    else alert(error || "Échec de l'upload du média");
  };

  const postIa = async () => {
    if (!iaBody.trim()) { alert("Message requis"); return; }
    setIaPosting(true);
    const r = await adminPost("/api/m/app-notifications", { title: iaTitle.trim() || undefined, body: iaBody.trim(), level: iaLevel, target: iaTarget.trim() || undefined });
    setIaPosting(false);
    if (r?.success) { setIaTitle(""); setIaBody(""); setIaLevel("info"); setIaTarget(""); loadIa(); }
    else alert(r?.error || "Échec de la publication");
  };
  const toggleIa = async (id: number) => {
    await adminPost(`/api/m/app-notifications/${id}/toggle`, {});
    loadIa();
  };

  const load = async () => {
    setLoading(true);
    const d = await adminFetch<{ notifications: any[] }>("/api/m/x/notifications?limit=30");
    setList(d?.notifications ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  const toggleChannel = (c: string) =>
    setChannels((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);

  // ── ad-hoc broadcast list helpers ──
  const addRecipient = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    // Accept a username (from the list) or a raw phone number; dedupe case-insensitively.
    setRecipients((cur) => cur.some((x) => x.toLowerCase() === v.toLowerCase()) ? cur : [...cur, v]);
    setRecipInput("");
  };
  const removeRecipient = (v: string) => setRecipients((cur) => cur.filter((x) => x !== v));
  const isPhone = (v: string) => /^\+?[\d\s().-]{8,}$/.test(v);

  const send = async () => {
    if (!subject.trim() || !body.trim()) { alert("Sujet et corps requis"); return; }
    const nTargets = [tAll, tGroup, tList, tInApp].filter(Boolean).length;
    if (nTargets === 0) { alert("Coche au moins une cible (Tous / Groupe / Liste / In-app)"); return; }
    if ((tAll || tList) && channels.length === 0) { alert("Choisis au moins un canal (Email ou WhatsApp) pour Tous / Liste"); return; }
    if (tGroup && !groupId) { alert("Choisis un groupe WhatsApp"); return; }
    if (tList && recipients.length === 0) { alert("Ajoute au moins un destinataire à la liste"); return; }
    const summary = [tAll && "Tous les inscrits", tGroup && "Groupe WhatsApp", tList && `Liste (${recipients.length})`, tInApp && "Cloche in-app"].filter(Boolean).join(" + ");
    if (!confirm(`Envoyer ce message à : ${summary} ?\n\nSujet: ${subject}`)) return;
    setSending(true);
    setResult(null);
    const mediaFields = media ? { mediaUrl: media.url, mediaType: media.type } : {};
    const jobs: Promise<any>[] = [];
    if (tAll) jobs.push(adminPost("/api/m/x/notifications", { audience: "all", channels, subject: subject.trim(), body, ...mediaFields }));
    if (tGroup) jobs.push(adminPost("/api/m/x/notifications", { audience: "whatsapp_group", channels: ["whatsapp"], whatsappDestination: groupId, subject: subject.trim(), body, ...mediaFields }));
    if (tList) jobs.push(adminPost("/api/m/x/notifications", { audience: "specific", channels, userKeys: recipients, subject: subject.trim(), body, ...mediaFields }));
    if (tInApp) jobs.push(adminPost("/api/m/app-notifications", { title: subject.trim() || undefined, body: body.trim(), level: "info" }));
    const results = await Promise.all(jobs);
    setSending(false);
    const ok = results.every((r) => r?.success);
    if (ok) {
      const total = results.reduce((a, r) => a + (r?.recipientCount || 0), 0);
      setResult({ success: true, recipientCount: total, summary });
      setSubject(DEFAULT_SUBJECT); setBody(DEFAULT_BODY); setRecipients([]); setRecipInput(""); setMedia(null);
      load(); if (tInApp) loadIa();
    } else {
      setResult({ success: false, error: results.filter((r) => !r?.success).map((r) => r?.error).filter(Boolean).join(" · ") || "Échec partiel de l'envoi" });
    }
  };

  const cancel = async (id: number) => {
    if (!confirm("Annuler les envois en attente pour cette notification ?")) return;
    await adminPost(`/api/m/x/notifications/${id}/cancel`, {});
    load();
  };

  return (
    <div>
      {/* ── Sub-tab bar: separate the two notification systems ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {([{ id: "broadcast", label: "WhatsApp & Email", icon: <Send size={14} /> }, { id: "inapp", label: "Annonces in-app", icon: <Bell size={14} /> }] as const).map((s) => (
          <button key={s.id} type="button" onClick={() => setSection(s.id)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 100, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: `1px solid ${section === s.id ? "transparent" : "var(--border)"}`, background: section === s.id ? "var(--gradient-brand)" : "transparent", color: section === s.id ? "white" : "var(--text-muted)" }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {section === "inapp" && (<>
      {/* ── IN-APP ANNOUNCEMENTS (bell + badge) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Bell size={20} color="#10b981" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Annonces in-app (cloche)</h3>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Message affiché dans la cloche de l'app (en ligne). Laisse le destinataire vide pour une annonce publique.
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Titre (optionnel)</div>
        <input value={iaTitle} onChange={(e) => setIaTitle(e.target.value)} className="input"
          placeholder="ex : Redéploiement en cours" maxLength={120}
          style={{ width: "100%", fontSize: "0.9rem", padding: "10px", marginBottom: 12 }} />
        <div style={labelStyle}>Message</div>
        <textarea value={iaBody} onChange={(e) => setIaBody(e.target.value)} maxLength={2000}
          placeholder={"ex : Une brève coupure peut survenir suite à la mise en ligne en temps réel de nouvelles fonctionnalités. Merci de votre patience — reconnectez-vous simplement, tout reprend normalement."}
          style={{ width: "100%", minHeight: 90, padding: 12, fontSize: "0.85rem", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none", lineHeight: 1.6 }} />
        <div style={{ ...labelStyle, marginTop: 12 }}>Destinataire</div>
        <input value={iaTarget} onChange={(e) => setIaTarget(e.target.value)} className="input"
          list="ia-user-picker" placeholder="Vide = tout le monde · ou choisis un utilisateur dans la liste"
          style={{ width: "100%", fontSize: "0.9rem", padding: "10px" }} />
        <datalist id="ia-user-picker">
          {iaUsers.map((u) => <option key={u.id} value={u.username} />)}
        </datalist>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", flex: 1 }}>
            Vide = annonce publique. Sinon clique le champ et choisis/tape un nom — le message n'apparaîtra que dans sa cloche. ({iaUsers.length} utilisateurs)
          </div>
          {iaTarget && (
            <button onClick={() => setIaTarget("")} className="btn-secondary" style={{ flexShrink: 0, padding: "5px 12px", fontSize: "0.7rem" }}>
              Tout le monde
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 14 }}>
          <div style={{ flex: "0 0 auto" }}>
            <div style={labelStyle}>Type</div>
            <select value={iaLevel} onChange={(e) => setIaLevel(e.target.value)} className="input" style={{ fontSize: "0.9rem", padding: "10px" }}>
              <option value="info" style={{ color: "#111", background: "#fff" }}>Info (bleu)</option>
              <option value="warning" style={{ color: "#111", background: "#fff" }}>Avertissement (orange)</option>
              <option value="success" style={{ color: "#111", background: "#fff" }}>Succès (vert)</option>
            </select>
          </div>
          <button onClick={postIa} disabled={iaPosting} className="btn-primary" style={{ padding: "11px 26px", fontSize: "0.85rem", opacity: iaPosting ? 0.6 : 1 }}>
            {iaPosting ? "Publication…" : "Publier la cloche"}
          </button>
        </div>
      </div>

      {/* existing in-app announcements */}
      <h4 style={{ ...labelStyle, color: "var(--primary-light)", marginTop: 20, marginBottom: 10 }}>Annonces publiées ({iaList.length})</h4>
      <div style={{ marginBottom: 8, maxHeight: 360, overflowY: "auto", border: iaList.length ? "1px solid var(--border)" : "none", borderRadius: 12, padding: iaList.length ? "2px 12px" : 0 }}>
        {iaList.length === 0 ? (
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "6px 4px" }}>Aucune annonce in-app pour l'instant.</div>
        ) : iaList.map((n) => (
          <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 12px", borderBottom: "1px solid var(--border)", opacity: n.is_active ? 1 : 0.4 }}>
            <div style={{ minWidth: 0 }}>
              {n.title && <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{n.title}</div>}
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{n.body}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", marginTop: 3 }}>
                {new Date(n.created_at).toLocaleString("fr")} · {n.level} · {n.target_username ? `→ @${n.target_username}` : "tout le monde"}{n.is_active ? "" : " · masquée"}
              </div>
            </div>
            <button onClick={() => toggleIa(n.id)} className="btn-secondary" style={{ flexShrink: 0, padding: "7px 14px", fontSize: "0.75rem" }}>
              {n.is_active ? "Masquer" : "Afficher"}
            </button>
          </div>
        ))}
      </div>

      </>)}

      {section === "broadcast" && (<>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Send size={18} color="#10b981" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Envoi WhatsApp &amp; Email</h3>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Coche les cibles (tous, groupe WhatsApp, liste, cloche) — le même message part à tout ce qui est coché, en un envoi.
      </div>

      {/* Composer */}
      <div style={cardStyle}>
        <div style={labelStyle}>Cibles — coche une ou plusieurs (un seul message → toutes en même temps)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {([
            { on: tAll, set: setTAll, icon: "👥", label: "Tous les inscrits" },
            { on: tGroup, set: setTGroup, icon: "💬", label: "Groupe WhatsApp" },
            { on: tList, set: setTList, icon: "📋", label: "Liste de diffusion" },
            { on: tInApp, set: setTInApp, icon: "📱", label: "Cloche in-app" },
          ] as const).map((t, i) => (
            <button key={i} type="button" onClick={() => t.set((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 12, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: `1px solid ${t.on ? "rgba(16,185,129,0.45)" : "var(--border)"}`, background: t.on ? "rgba(16,185,129,0.12)" : "transparent", color: t.on ? "#10b981" : "var(--text-secondary)" }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${t.on ? "#10b981" : "var(--border)"}`, background: t.on ? "#10b981" : "transparent", color: "white", fontSize: "0.7rem", fontWeight: 900 }}>{t.on ? "✓" : ""}</span>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tGroup && (
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Groupe WhatsApp</div>
            {groups.length === 0 ? (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.5 }}>Aucun groupe trouvé — le compte Elson doit être membre d'un groupe et la session WAHA active.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {groups.map((g) => {
                  const on = groupId === g.id;
                  return (
                    <button key={g.id} type="button" onClick={() => setGroupId(g.id)}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 100, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "rgba(16,185,129,0.4)" : "var(--border)"}`, background: on ? "rgba(16,185,129,0.15)" : "transparent", color: on ? "#10b981" : "var(--text-secondary)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#10b981" : "var(--text-muted)" }} />
                      {g.subject} <span style={{ opacity: 0.6 }}>· {g.size}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tList && (
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Liste de diffusion ({recipients.length})</div>
            {savedLists.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: 6 }}>📁 Listes enregistrées — clique pour charger</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {savedLists.map((l) => (
                    <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 11px", borderRadius: 100, fontSize: "0.76rem", fontWeight: 600, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <button type="button" onClick={() => { setRecipients(l.recipients); }} title="Charger cette liste"
                        style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700, padding: 0 }}>
                        {l.name} <span style={{ opacity: 0.6 }}>· {l.recipients.length}</span>
                      </button>
                      <button type="button" onClick={() => deleteList(l.id, l.name)} title="Supprimer"
                        style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.95rem", lineHeight: 1, padding: "0 2px" }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input list="recip-user-picker" value={recipInput} onChange={(e) => setRecipInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(recipInput); } }}
                placeholder="Tape un nom (depuis la liste) ou un numéro +222…"
                className="input" style={{ flex: 1, fontSize: "0.9rem", padding: "10px" }} />
              <datalist id="recip-user-picker">
                {iaUsers.map((u) => <option key={u.id} value={u.username} label={u.whatsapp ? `${u.username} — ${u.whatsapp}` : u.username} />)}
              </datalist>
              <button type="button" onClick={() => addRecipient(recipInput)} className="btn-secondary" style={{ padding: "0 18px", fontSize: "0.8rem", whiteSpace: "nowrap" }}>+ Ajouter</button>
            </div>
            {recipients.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {recipients.map((v) => (
                  <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 100, fontSize: "0.78rem", fontWeight: 600, background: isPhone(v) ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)", color: isPhone(v) ? "#10b981" : "#818cf8", border: `1px solid ${isPhone(v) ? "rgba(16,185,129,0.3)" : "rgba(99,102,241,0.3)"}` }}>
                    {isPhone(v) ? "📱" : "👤"} {v}
                    <button type="button" onClick={() => removeRecipient(v)} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 8 }}>Aucun destinataire. Ajoute des personnes (par nom) et/ou des numéros libres.</div>
            )}
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              👤 personne du système (résolue par nom → email + WhatsApp) · 📱 numéro libre (WhatsApp uniquement). {iaUsers.length} utilisateurs disponibles.
            </div>
            {recipients.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={saveList} className="btn-secondary" style={{ padding: "7px 14px", fontSize: "0.78rem", fontWeight: 700 }}>
                  💾 Enregistrer cette liste
                </button>
                <button type="button" onClick={() => setRecipients([])} style={{ padding: "7px 14px", fontSize: "0.78rem", border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", borderRadius: 8, cursor: "pointer" }}>
                  Vider
                </button>
              </div>
            )}
          </div>
        )}

        {(tAll || tList) && (
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Canaux (pour Tous / Liste)</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[{ id: "email", label: "📧 Email" }, { id: "whatsapp", label: "🟢 WhatsApp" }].map((ch) => {
                const on = channels.includes(ch.id);
                return (
                  <button key={ch.id} type="button" onClick={() => toggleChannel(ch.id)}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 100, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", border: `1px solid ${on ? "rgba(16,185,129,0.4)" : "var(--border)"}`, background: on ? "rgba(16,185,129,0.15)" : "transparent", color: on ? "#10b981" : "var(--text-muted)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#10b981" : "var(--text-muted)" }} />
                    {ch.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
              Le groupe WhatsApp part toujours via WhatsApp. La cloche in-app est indépendante des canaux.
            </div>
          </div>
        )}

        <div style={labelStyle}>Sujet</div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input"
          placeholder="La compétition commence !" maxLength={200}
          style={{ width: "100%", fontSize: "0.9rem", padding: "10px", marginBottom: 12 }} />

        <div style={labelStyle}>Corps (texte simple — {`{{username}}`} sera remplacé)</div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={20_000}
          placeholder={"Bonjour {{username}},\n\nLa compétition Elson Hassaniya est ouverte. Connectez-vous pour commencer à contribuer."}
          style={{ width: "100%", minHeight: 200, padding: 12, fontSize: "0.85rem", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none", lineHeight: 1.6 }} />
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 4 }}>{body.length}/20 000 caractères</div>

        <div style={{ ...labelStyle, marginTop: 14 }}>Média — WhatsApp uniquement</div>
        {media ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "1.1rem" }}>{media.type === "image" ? "🖼️" : media.type === "video" ? "🎬" : "🎵"}</span>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{media.name}</span>
            <button type="button" onClick={() => setMedia(null)} style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>Retirer</button>
          </div>
        ) : (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, border: "1px dashed var(--border)", cursor: uploadingMedia ? "wait" : "pointer", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            {uploadingMedia ? <><Activity size={14} className="spin" /> Upload…</> : <>📎 Joindre photo / audio / vidéo</>}
            <input type="file" accept="image/*,audio/*,video/*" disabled={uploadingMedia} onChange={(e) => onMediaPick(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          </label>
        )}
        {media && (
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            {media.type === "audio" ? "L'audio part en note vocale (sans légende)." : "Le texte est envoyé en légende."} Le média ne part QUE par WhatsApp ; les cibles in-app / email reçoivent le texte seul.
          </div>
        )}

        {(() => {
          const n = [tAll, tGroup, tList, tInApp].filter(Boolean).length;
          return (
            <button onClick={send} disabled={sending || !subject.trim() || !body.trim() || n === 0} className="btn-primary"
              style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: n === 0 ? 0.5 : 1 }}>
              {sending ? <><Activity size={14} className="spin" /> Envoi…</> : <><Send size={14} /> Envoyer{n > 0 ? ` → ${n} cible${n > 1 ? "s" : ""}` : ""}</>}
            </button>
          );
        })()}

        {result && (
          <div style={{ ...cardStyle, marginTop: 12, borderColor: result.success ? "rgba(22, 163, 74,0.2)" : "rgba(248,113,113,0.2)" }}>
            {result.success
              ? <span style={{ color: "var(--success)", fontSize: "0.85rem" }}><CheckCircle size={14} /> Envoyé à {result.summary}{result.recipientCount ? ` · ${result.recipientCount} destinataires` : ""}</span>
              : <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}><AlertTriangle size={14} /> {result.error}</span>}
          </div>
        )}
      </div>

      {/* History */}
      <h4 style={{ ...labelStyle, color: "var(--primary-light)", marginTop: 24, marginBottom: 12 }}>Historique des envois ({list.length})</h4>
      {loading && <Activity size={20} className="spin" />}
      <div style={{ maxHeight: 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((n) => (
        <div key={n.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>{n.subject}</span>
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: 8 }}>#{n.id} · {n.audience} · {new Date(n.created_at).toLocaleString()}</span>
            </div>
            <span style={{
              fontSize: "0.65rem", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", fontWeight: 700,
              background: n.status === "done" ? "rgba(22, 163, 74,0.15)" : n.status === "sending" ? "rgba(217, 119, 6,0.15)" : n.status === "cancelled" ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)",
              color: n.status === "done" ? "var(--success)" : n.status === "sending" ? "var(--accent)" : n.status === "cancelled" ? "var(--danger)" : "var(--text-muted)",
            }}>{n.status}</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            par {n.sent_by_username ?? "?"} · {n.sent_count}/{n.recipient_count} envoyés · {n.failed_count} échecs
          </div>
          {(n.status === "queued" || n.status === "sending") && (
            <button onClick={() => cancel(n.id)} style={{ marginTop: 6, fontSize: "0.7rem", padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.05)", color: "var(--danger)", cursor: "pointer" }}>
              Annuler
            </button>
          )}
        </div>
      ))}
      </div>
      </>)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 4. DATASET REPLACE — upload CSV with dry-run + replace
// ════════════════════════════════════════════════════════════════════
const CONFIRM_PHRASE = "I_UNDERSTAND_THIS_WIPES_CONTRIBUTIONS";

export function DatasetReplacePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"dry_run" | "append" | "replace">("dry_run");
  const [confirm, setConfirm] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [imports, setImports] = useState<any[]>([]);

  const loadImports = async () => {
    const d = await adminFetch<{ imports: any[] }>("/api/m/x/dataset/imports");
    setImports(d?.imports ?? []);
  };
  useEffect(() => { loadImports(); }, []);

  const upload = async () => {
    if (!file) { alert("Fichier CSV requis"); return; }
    if (mode === "replace" && confirm !== CONFIRM_PHRASE) {
      alert(`Pour 'replace', tape EXACTEMENT :\n\n${CONFIRM_PHRASE}\n\ndans le champ confirmation. Cette opération supprime TOUTES les contributions via CASCADE.`);
      return;
    }
    if (mode === "replace" && !adminPassword) {
      alert("Ton mot de passe admin est requis pour confirmer l'opération destructive.");
      return;
    }
    if (mode === "replace" && !window.confirm(`DERNIÈRE CONFIRMATION : remplacer TOUT le dataset ? Toutes les contributions seront PERDUES.`)) return;

    setBusy(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    if (mode === "replace") {
      fd.append("confirm", confirm);
      fd.append("adminPassword", adminPassword);
    }

    const { data, error } = await apiMultipart<any>("/api/m/x/dataset/replace", fd);
    setBusy(false);
    setResult(data ?? { error: error ?? "unknown error" });
    setAdminPassword(""); // never keep the password in state after the call
    if (data?.success || data?.mode === "dry_run") loadImports();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Database size={20} color="var(--primary-light)" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Dataset — Import / Remplacement</h3>
      </div>

      <div style={{ ...cardStyle, borderColor: mode === "replace" ? "rgba(248,113,113,0.3)" : "var(--border)" }}>
        <div style={labelStyle}>Fichier CSV</div>
        <input type="file" accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ marginBottom: 16, display: "block" }} />
        {file && (
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 12 }}>
            {file.name} · {(file.size / 1024 / 1024).toFixed(1)} Mo
          </div>
        )}

        <div style={labelStyle}>Mode</div>
        <select value={mode} onChange={(e) => { setMode(e.target.value as any); setConfirm(""); }}
          className="input" style={{ fontSize: "0.9rem", padding: "10px", marginBottom: 12 }}>
          <option value="dry_run">Dry-run (analyse seulement, n'écrit rien)</option>
          <option value="append">Append (insère sans toucher à l'existant)</option>
          <option value="replace">Replace (TRUNCATE phrases CASCADE — détruit contributions)</option>
        </select>

        {mode === "replace" && (
          <>
            <div style={{ ...cardStyle, padding: 12, marginBottom: 12, background: "rgba(248,113,113,0.05)", borderColor: "rgba(248,113,113,0.3)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertTriangle size={16} color="var(--danger)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--danger)" }}>Opération destructive</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    TRUNCATE phrases CASCADE supprime aussi : contributions, contribution_tags, validations, votes, phrase_locks, phrase_skips. Irréversible.
                  </div>
                </div>
              </div>
            </div>
            <div style={labelStyle}>Tape exactement pour confirmer</div>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_PHRASE} className="input"
              style={{ fontSize: "0.9rem", padding: "10px", marginBottom: 12, fontFamily: "monospace" }} />
            <div style={labelStyle}>Ton mot de passe admin (re-authentification)</div>
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••" className="input" autoComplete="current-password"
              style={{ fontSize: "0.9rem", padding: "10px", marginBottom: 12 }} />
          </>
        )}

        <button onClick={upload} disabled={busy || !file || (mode === "replace" && (confirm !== CONFIRM_PHRASE || !adminPassword))}
          className="btn-primary" style={{ width: "100%", padding: 14, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {busy ? <><Activity size={14} className="spin" /> Traitement… (peut prendre plusieurs minutes)</> : <><Upload size={14} /> {mode === "dry_run" ? "Analyser" : mode === "append" ? "Ajouter" : "REMPLACER"}</>}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ ...cardStyle, borderColor: result.error ? "rgba(248,113,113,0.2)" : "rgba(22, 163, 74,0.2)" }}>
          {result.error
            ? <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}><AlertTriangle size={14} style={{ display: "inline" }} /> {result.error}</div>
            : result.mode === "dry_run"
              ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--success)", marginBottom: 8 }}>Dry-run OK · {result.csv?.rowsProcessed} lignes</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Headers : {result.csv?.headers?.join(", ")}<br/>
                    Langues : {Object.entries(result.csv?.byLang ?? {}).map(([k, v]) => `${k}:${v}`).join(" · ")}<br/>
                    Origines top : {(result.csv?.byOriginTop ?? []).slice(0, 6).map(([k, v]: any) => `${k}:${v}`).join(" · ")}<br/>
                    {result.csv?.errors?.length > 0 && <span style={{ color: "var(--danger)" }}>Erreurs : {result.csv.errors.slice(0, 3).join("; ")}</span>}
                  </div>
                  <div style={{ fontSize: "0.78rem", marginTop: 8, color: "var(--text-secondary)" }}>
                    DB actuel : <strong>{result.currentDb?.phrases ?? 0}</strong> phrases · <strong>{result.currentDb?.contributions ?? 0}</strong> contributions<br/>
                    Si mode <code>replace</code> : <strong style={{ color: "var(--danger)" }}>{result.wouldLoseContributions} contributions PERDUES</strong>.
                  </div>
                </div>
              )
              : (
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--success)" }}><CheckCircle size={14} style={{ display: "inline" }} /> Import #{result.importId} OK</div>
                  <div style={{ fontSize: "0.78rem", marginTop: 4, color: "var(--text-secondary)" }}>
                    Insérées : {result.inserted} · Ignorées : {result.skipped} · Erreurs : {result.errors}
                    {result.contributionsLost > 0 && <span style={{ color: "var(--danger)" }}> · Contributions perdues : {result.contributionsLost}</span>}
                  </div>
                </div>
              )
          }
        </div>
      )}

      {/* History */}
      <h4 style={{ ...labelStyle, color: "var(--primary-light)", marginTop: 20, marginBottom: 12 }}>Imports récents</h4>
      {imports.map((i) => (
        <div key={i.id} style={{ ...cardStyle, padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>#{i.id} · {i.mode}</span>
            <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase",
              background: i.status === "success" ? "rgba(22, 163, 74,0.15)" : i.status === "failed" ? "rgba(248,113,113,0.15)" : "rgba(217, 119, 6,0.15)",
              color: i.status === "success" ? "var(--success)" : i.status === "failed" ? "var(--danger)" : "var(--accent)" }}>{i.status}</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {i.file_name} · {(i.file_size_bytes / 1024 / 1024).toFixed(1)} Mo · par {i.performed_by_username ?? "?"} · {new Date(i.started_at).toLocaleString()}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: 2 }}>
            Insérées : {i.rows_inserted ?? 0} · Skipped : {i.rows_skipped ?? 0} · Errors : {i.rows_errors ?? 0}
            {i.contributions_lost > 0 && <span style={{ color: "var(--danger)" }}> · {i.contributions_lost} contributions perdues</span>}
          </div>
          {i.error && <div style={{ fontSize: "0.7rem", color: "var(--danger)", marginTop: 2 }}>Erreur : {i.error}</div>}
        </div>
      ))}
    </div>
  );
}
