"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav, TopBar } from "@/components/Navigation";
import { Shield, Users, AlertTriangle, Activity, CheckCircle, XCircle, Eye, Ban, KeyRound, BarChart3, Settings, Zap, FileText, Clock, Upload, Plus, Lock, Trash2, MapPin, Vote, Database, RotateCcw, Download, UserCheck, Bell, RefreshCw, Search, Hourglass, TrendingUp, Trophy, Target, ShieldCheck } from "lucide-react";
import { isLoggedIn, tryRestoreSession, logout, getMyProfile, apiFetch, adminDeleteContributions, adminGetFlashTournamentParticipants, adminGetFlashParticipantContributions, adminGetFlashParticipantContributionIds, adminHideContributions, adminListFlashTournaments, adminSetFlashTournamentExcluded, type FlashTournament, type FlashTournamentAmbassadorEntry, type FlashTournamentContribution, type FlashTournamentParticipant } from "@/lib/api";
import { WaveformAudio } from "@/components/WaveformAudio";
import { AuthAudio } from "@/components/AuthAudio";
import { InscritsPanel, CompetitionConfigPanel, NotificationsPanel, DatasetReplacePanel, DatasetQueuePanel, ThroughputSimulatorPanel } from "./v15-panels";
import { CreditTrackingPanel } from "./credit-panel";
import { FailedSubmissionsPanel } from "./failed-panel";
import { AntiFraudPanel } from "./antifraud-panel";
import { EvalMatrixPanel } from "./eval-matrix-panel";
import PointsPanel from "./points-panel";
import { UserContributionsManager } from "./contributions-manager";
import { ProductivityPanel } from "./productivity-panel";
import { PhraseAssignPanel } from "./assign-panel";
import { DisclaimerPanel } from "./disclaimer-panel";

async function adminFetch(path: string) {
  const { data } = await apiFetch<any>(path);
  return data ?? {};
}

async function adminPost(path: string, body: any) {
  const { data } = await apiFetch<any>(path, { method: "POST", body: JSON.stringify(body) });
  return data ?? {};
}

async function adminDelete(path: string) {
  const { data } = await apiFetch<any>(path, { method: "DELETE" });
  return data ?? {};
}

type Tab = "realtime" | "productivity" | "users" | "phrases" | "import" | "audit" | "config" | "security" | "consensus" | "dataset" | "inscrits" | "competition" | "flash" | "notify" | "replace" | "antifraud" | "points" | "evalmatrix" | "credit" | "failed" | "assign" | "disclaimer";

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"json" | "csv" | "manual">("json");
  const [text, setText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const sampleJson = `[
  { "source_text": "The sun rises in the east.", "source_lang": "en", "category": "general", "difficulty": 1, "hassaniya_reference": "grp001" },
  { "source_text": "Le soleil se lève à l'est.", "source_lang": "fr", "category": "general", "difficulty": 1, "hassaniya_reference": "grp001" },
  { "source_text": "تشرق الشمس من الشرق.", "source_lang": "ar", "category": "general", "difficulty": 1, "hassaniya_reference": "grp001" }
]`;

  const sampleCsv = `source_text|source_lang|category|difficulty|hassaniya_reference
The sun rises in the east.|en|general|1|grp001
Le soleil se lève à l'est.|fr|general|1|grp001
تشرق الشمس من الشرق.|ar|general|1|grp001`;

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      let body: any;
      if (mode === "json") {
        const parsed = JSON.parse(text);
        body = { phrases: Array.isArray(parsed) ? parsed : [parsed] };
      } else if (mode === "csv") {
        body = { csv: text, delimiter: "|" };
      } else {
        // Manual: parse lines as individual phrases
        const lines = text.trim().split("\n").filter(l => l.trim());
        const lang = prompt("Langue des phrases (en/fr/ar):", "fr") || "fr";
        const cat = prompt("Catégorie:", "general") || "general";
        body = {
          phrases: lines.map((line, i) => ({
            source_text: line.trim(),
            source_lang: lang,
            category: cat,
            difficulty: 1,
            hassaniya_reference: `manual_${Date.now()}_${i}`,
          })),
        };
      }

      const result = await adminPost("/api/m/bulk-import", body);
      setResult(result);
      if (result.success) setTimeout(onDone, 2000);
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setImporting(false);
  };

  const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 8 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Upload size={20} color="var(--primary-light)" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Import de phrases en masse</h3>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([
          { key: "json" as const, label: "JSON" },
          { key: "csv" as const, label: "CSV (pipe)" },
          { key: "manual" as const, label: "Texte libre" },
        ]).map((m) => (
          <button key={m.key} onClick={() => { setMode(m.key); setText(""); setResult(null); }} style={{
            flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
            fontSize: "0.8rem", fontWeight: 600,
            background: mode === m.key ? "var(--gradient-brand)" : "rgba(255,255,255,0.03)",
            color: mode === m.key ? "white" : "var(--text-muted)",
            border: mode === m.key ? "none" : "1px solid var(--border)",
          }}>{m.label}</button>
        ))}
      </div>

      {/* Instructions */}
      <div style={{ ...card, padding: 14 }}>
        <div style={label}>Format attendu</div>
        {mode === "json" && (
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8 }}>
              Array JSON avec <code>source_text</code>, <code>source_lang</code> (en/fr/ar), <code>category</code>, <code>difficulty</code> (1-3), <code>hassaniya_reference</code> (lie les langues ensemble).
            </p>
            <button onClick={() => setText(sampleJson)} style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--primary-light)", cursor: "pointer" }}>
              Charger l'exemple
            </button>
          </div>
        )}
        {mode === "csv" && (
          <div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8 }}>
              Format pipe-delimited (<code>|</code>). Première ligne = header. Colonnes: <code>source_text|source_lang|category|difficulty|hassaniya_reference</code>
            </p>
            <button onClick={() => setText(sampleCsv)} style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--primary-light)", cursor: "pointer" }}>
              Charger l'exemple
            </button>
          </div>
        )}
        {mode === "manual" && (
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Collez vos phrases, une par ligne. Langue et catégorie seront demandées au moment de l'import.
          </p>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={mode === "json" ? "Collez votre JSON ici..." : mode === "csv" ? "Collez votre CSV ici..." : "Une phrase par ligne..."}
        style={{
          width: "100%", minHeight: 200, padding: 16, borderRadius: 14,
          background: "var(--surface-1)", border: "1px solid var(--border)",
          color: "var(--text-primary)", fontSize: "0.85rem", fontFamily: "monospace",
          resize: "vertical", outline: "none", lineHeight: 1.6,
        }}
      />

      {text.trim() && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
          {mode === "manual" ? text.trim().split("\n").filter(l => l.trim()).length + " phrases détectées" :
           mode === "json" ? (() => { try { const p = JSON.parse(text); return (Array.isArray(p) ? p.length : 1) + " phrases dans le JSON"; } catch { return "JSON invalide"; } })() :
           (text.trim().split("\n").length - 1) + " lignes de données"}
        </div>
      )}

      {/* Import button */}
      <button onClick={handleImport} disabled={!text.trim() || importing} className="btn-primary"
        style={{ width: "100%", marginTop: 16, padding: 16, borderRadius: 14 }}>
        {importing ? <><Activity size={16} className="spin" /> Import en cours...</> : <><Plus size={16} /> Importer les phrases</>}
      </button>

      {/* Result */}
      {result && (
        <div style={{ ...card, marginTop: 16, borderColor: result.success ? "rgba(22, 163, 74,0.2)" : "rgba(248,113,113,0.2)" }}>
          {result.success ? (
            <div>
              <div style={{ color: "var(--success)", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={16} /> Import réussi !
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <strong>{result.inserted}</strong> phrases insérées sur {result.total} ({result.skipped} ignorées)
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: "var(--danger)", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={16} /> Erreur
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{result.error}</div>
              {result.details && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8, maxHeight: 150, overflow: "auto" }}>
                  {result.details.map((d: string, i: number) => <div key={i}>{d}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SecurityPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    adminFetch("/api/m/ip-whitelist").then((d) => { setData(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newIp.trim()) return;
    setSaving(true);
    setError("");
    const r = await adminPost("/api/m/ip-whitelist", { ip_address: newIp.trim(), label: newLabel.trim() || undefined });
    if (r.success) { setNewIp(""); setNewLabel(""); load(); }
    else setError(r.error ?? "Erreur");
    setSaving(false);
  };

  const handleRemove = async (id: number, ip: string) => {
    if (!confirm(`Retirer ${ip} de la whitelist ?`)) return;
    const r = await adminDelete(`/api/m/ip-whitelist/${id}`);
    if (r.success) load();
    else alert(r.error ?? "Erreur");
  };

  const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 4 };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}><Activity size={28} className="spin" style={{ margin: "0 auto" }} /></div>;

  const isEmpty = !data?.ips?.length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Lock size={20} color="var(--primary-light)" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Whitelist IP Admin</h3>
      </div>

      {/* Status banner */}
      <div style={{ ...card, borderColor: isEmpty ? "rgba(217, 119, 6,0.3)" : "rgba(22, 163, 74,0.2)", background: isEmpty ? "rgba(217, 119, 6,0.04)" : "rgba(22, 163, 74,0.04)", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isEmpty ? <AlertTriangle size={16} color="var(--warning)" /> : <Shield size={16} color="var(--success)" />}
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: isEmpty ? "var(--warning)" : "var(--success)" }}>
            {isEmpty ? "Mode setup ·accès admin ouvert à tous les admins" : `${data.ips.length} IP(s) autorisée(s) ·accès restreint`}
          </span>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6, marginBottom: 0 }}>
          {isEmpty
            ? "Ajoutez au moins une IP pour activer la restriction. Tant que la liste est vide, tout admin peut accéder."
            : "Seules les IPs listées ci-dessous peuvent accéder aux routes /admin."}
        </p>
      </div>

      {/* Client IP hint */}
      <div style={{ ...card, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <MapPin size={14} color="var(--primary-light)" />
        <div>
          <div style={label}>Votre IP actuelle</div>
          <code style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--primary-light)" }}>{data?.clientIp || "-"}</code>
        </div>
        <button
          onClick={() => setNewIp(data?.clientIp ?? "")}
          style={{ marginLeft: "auto", fontSize: "0.7rem", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--primary-light)", cursor: "pointer" }}
        >
          Utiliser cette IP
        </button>
      </div>

      {/* Add IP form */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12, color: "var(--primary-light)" }}>Ajouter une IP</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={label}>Adresse IP *</div>
            <input
              className="input"
              type="text"
              placeholder="192.168.1.1"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              style={{ fontSize: "0.9rem" }}
            />
          </div>
          <div>
            <div style={label}>Label (optionnel)</div>
            <input
              className="input"
              type="text"
              placeholder="Bureau Nouakchott"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              style={{ fontSize: "0.9rem" }}
            />
          </div>
        </div>
        {error && <div style={{ fontSize: "0.8rem", color: "var(--danger)", marginBottom: 8 }}>{error}</div>}
        <button
          onClick={handleAdd}
          disabled={saving || !newIp.trim()}
          className="btn-primary"
          style={{ padding: "10px 20px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}
        >
          {saving ? <Activity size={14} className="spin" /> : <Plus size={14} />}
          Ajouter
        </button>
      </div>

      {/* IP list */}
      {data?.ips?.length > 0 ? (
        <div>
          <div style={{ ...label, marginBottom: 12, color: "var(--primary-light)" }}>IPs autorisées ({data.ips.length})</div>
          {data.ips.map((entry: any) => (
            <div key={entry.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
              <div style={{ flex: 1 }}>
                <code style={{ fontSize: "0.9rem", fontWeight: 700 }}>{entry.ip_address}</code>
                {entry.label && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 10 }}>{entry.label}</span>}
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 3 }}>
                  Ajouté {entry.added_by_username ? `par ${entry.added_by_username}` : ""} ·{new Date(entry.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => handleRemove(entry.id, entry.ip_address)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.05)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem" }}
              >
                <Trash2 size={13} /> Retirer
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Aucune IP ·ajoutez-en une pour activer la restriction.
        </div>
      )}
    </div>
  );
}

function FlashTournamentAdminPanel() {
  const [tournaments, setTournaments] = useState<FlashTournament[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<FlashTournamentParticipant[]>([]);
  const [ambassadorEntries, setAmbassadorEntries] = useState<FlashTournamentAmbassadorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Record<number, boolean>>({}); // checked contributions (bulk delete)
  // Pagination of contributions PER person (beyond the 1000 in the summary).
  const [pages, setPages] = useState<Record<string, { items: FlashTournamentContribution[]; total: number; offset: number; loading: boolean }>>({});
  const PAGE = 50;

  const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 4 };
  const smallBtn: React.CSSProperties = { padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.7rem", fontWeight: 700 };
  const selected = tournaments.find((t) => t.id === selectedId) ?? null;
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  const loadTournaments = async () => {
    setLoading(true);
    setError("");
    const { data, error: apiError } = await adminListFlashTournaments();
    if (apiError) {
      setError(apiError);
      setLoading(false);
      return;
    }
    const list = data?.tournaments ?? [];
    setTournaments(list);
    const nextId = selectedId && list.some((t) => t.id === selectedId) ? selectedId : list[0]?.id ?? null;
    setSelectedId(nextId);
    if (!nextId) {
      setParticipants([]);
      setAmbassadorEntries([]);
      setLoading(false);
      return;
    }
    await loadParticipants(nextId);
  };

  const loadParticipants = async (id = selectedId) => {
    if (!id) return;
    setLoading(true);
    setError("");
    const { data, error: apiError } = await adminGetFlashTournamentParticipants(id);
    if (apiError) setError(apiError);
    setParticipants(data?.participants ?? []);
    setAmbassadorEntries(data?.ambassadorEntries ?? []);
    setLoading(false);
  };

  useEffect(() => { loadTournaments(); }, []);
  useEffect(() => {
    if (selectedId) loadParticipants(selectedId);
  }, [selectedId]);

  const filtered = participants.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return String(p.username ?? "").toLowerCase().includes(q) || p.user_id.toLowerCase().includes(q);
  });
  const activeParticipants = participants.filter((p) => !p.excluded);
  const reached = activeParticipants.filter((p) => p.reached_target).length;
  const totalFlash = activeParticipants.reduce((sum, p) => sum + p.tournament_contributions, 0);
  const excludedCount = participants.filter((p) => p.excluded).length;
  const activeRankByUser = new Map(activeParticipants.map((p, i) => [p.user_id, i + 1]));

  const setExcluded = async (p: FlashTournamentParticipant, excluded: boolean) => {
    if (!selectedId) return;
    const answer = excluded ? prompt(`Raison d'exclusion pour ${p.username ?? p.user_id}:`, "Contribution invalide pour le tournoi flash") : "";
    if (answer === null) return;
    const reason = answer ?? "";
    setBusy(`exclude-${p.user_id}`);
    const { error: apiError } = await adminSetFlashTournamentExcluded(selectedId, p.user_id, excluded, reason);
    if (apiError) alert(apiError);
    await loadParticipants(selectedId);
    setBusy(null);
  };

  const hideContribution = async (c: FlashTournamentContribution, hidden: boolean) => {
    if (!selectedId) return;
    setBusy(`hide-${c.id}`);
    const { error: apiError } = await adminHideContributions([c.id], hidden);
    if (apiError) alert(apiError);
    await loadParticipants(selectedId);
    setBusy(null);
  };

  // Load a page of contributions for a person (50 per page).
  const loadPage = async (userId: string, offset: number) => {
    if (!selectedId) return;
    setPages((pg) => ({ ...pg, [userId]: { items: pg[userId]?.items ?? [], total: pg[userId]?.total ?? 0, offset, loading: true } }));
    const { data } = await adminGetFlashParticipantContributions(selectedId, userId, offset, PAGE);
    setPages((pg) => ({ ...pg, [userId]: { items: data?.contributions ?? [], total: data?.total ?? 0, offset, loading: false } }));
  };

  const deleteContribution = async (c: FlashTournamentContribution) => {
    if (!selectedId) return;
    if (!confirm(`Supprimer définitivement la contribution #${c.id} ?\n\n• Audio supprimé définitivement\n• Phrase remise dans le corpus (re-traduite)\n• Points retirés à la personne (−15, −1 contribution)`)) return;
    setBusy(`delete-${c.id}`);
    const { error: apiError } = await adminDeleteContributions([c.id], true, true);
    if (apiError) alert(apiError);
    await loadPage(c.user_id, pages[c.user_id]?.offset ?? 0);
    await loadParticipants(selectedId);
    setBusy(null);
  };

  // BULK delete (multiple selection for one person).
  const bulkDelete = async (userId: string, ids: number[]) => {
    if (!selectedId || !ids.length) return;
    if (!confirm(`Supprimer définitivement ${ids.length} contribution(s) ?\n\n• Audio supprimé définitivement\n• Phrases remises dans le corpus (re-traduites)\n• Points retirés à la personne (−15 par contribution)`)) return;
    setBusy("bulk");
    const { error: apiError } = await adminDeleteContributions(ids, true, true);
    if (apiError) alert(apiError);
    setSel({});
    await loadPage(userId, 0);
    await loadParticipants(selectedId);
    setBusy(null);
  };

  // Delete ALL of a person's flash contributions (beyond the displayed page).
  const deleteAllForUser = async (p: FlashTournamentParticipant) => {
    if (!selectedId) return;
    setBusy(`delall-${p.user_id}`);
    const { data, error: idErr } = await adminGetFlashParticipantContributionIds(selectedId, p.user_id);
    const ids = data?.ids ?? [];
    if (idErr || !ids.length) { alert(idErr || "Aucune contribution flash."); setBusy(null); return; }
    if (!confirm(`Supprimer TOUTES les ${ids.length} contributions flash de ${p.username ?? p.user_id} ?\n\n• Audio supprimé définitivement\n• Phrases remises dans le corpus\n• Points retirés (−15 par contribution)\n\nIRRÉVERSIBLE.`)) { setBusy(null); return; }
    const CH = 500;
    for (let i = 0; i < ids.length; i += CH) {
      const { error: apiError } = await adminDeleteContributions(ids.slice(i, i + CH), true, true);
      if (apiError) { alert(apiError); break; }
    }
    setSel({});
    await loadPage(p.user_id, 0);
    await loadParticipants(selectedId);
    setBusy(null);
  };

  const toggleHistory = (userId: string) => {
    setExpanded((prev) => {
      const willOpen = !prev[userId];
      if (willOpen && !pages[userId]) loadPage(userId, 0);
      return { ...prev, [userId]: willOpen };
    });
  };

  const renderContribution = (c: FlashTournamentContribution) => (
    <div key={c.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>
          <input type="checkbox" checked={!!sel[c.id]} onChange={() => setSel((s) => ({ ...s, [c.id]: !s[c.id] }))} style={{ cursor: "pointer" }} />
          #{c.id} · phrase {c.phrase_id} · {formatDate(c.created_at)} · {c.has_audio ? "audio" : "sans audio"}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ fontSize: "0.62rem", padding: "2px 7px", borderRadius: 999, background: c.quarantined ? "rgba(217,119,6,0.12)" : "rgba(16,185,129,0.10)", color: c.quarantined ? "#d97706" : "var(--success)" }}>
            {c.quarantined ? "masquée" : c.status}
          </span>
          {c.flash_tagged && (
            <span style={{ fontSize: "0.62rem", padding: "2px 7px", borderRadius: 999, background: "rgba(8,221,184,0.12)", color: "var(--primary-light)", fontWeight: 800 }}>
              tag flash
            </span>
          )}
          <button disabled={busy === `hide-${c.id}`} onClick={() => hideContribution(c, !c.quarantined)} style={smallBtn}>
            {c.quarantined ? "Restaurer" : "Masquer"}
          </button>
          <button disabled={busy === `delete-${c.id}`} onClick={() => deleteContribution(c)} style={{ ...smallBtn, borderColor: "rgba(248,113,113,0.25)", color: "var(--danger)" }}>
            Supprimer
          </button>
        </div>
      </div>
      <p dir={c.source_lang === "ar" ? "rtl" : "ltr"} style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 5 }}>{c.source_text}</p>
      <p dir="rtl" style={{ fontSize: "0.95rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.65, marginBottom: c.audio_url ? 8 : 0 }}>{c.hassaniya_text}</p>
      {c.audio_url && <WaveformAudio src={c.audio_url} />}
    </div>
  );

  if (loading && !selected) {
    return <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}><Activity size={28} className="spin" style={{ margin: "0 auto" }} /></div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Trophy size={20} color="var(--primary-light)" />
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Tournoi flash</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Suivi des participants, contributions flash, exclusions et nettoyage.</p>
        </div>
        <button onClick={() => loadTournaments()} style={{ ...smallBtn, marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} /> Rafraîchir
        </button>
      </div>

      {error && <div style={{ ...card, borderColor: "rgba(248,113,113,0.25)", color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}

      {!tournaments.length ? (
        <div style={{ ...card, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Aucun tournoi flash créé. Crée-le depuis l'onglet Compétition.
        </div>
      ) : (
        <>
          <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, alignItems: "end" }}>
            <div>
              <div style={label}>Tournoi</div>
              <select value={selectedId ?? ""} onChange={(e) => setSelectedId(Number(e.target.value))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}>
                {tournaments.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              {selected && (
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 6 }}>
                  {formatDate(selected.starts_at ?? selected.startsAt)} → {formatDate(selected.ends_at ?? selected.endsAt)} · {selected.status}
                </div>
              )}
            </div>
            {[
              { k: "Participants", v: activeParticipants.length },
              { k: "Contrib. flash", v: totalFlash },
              { k: "Objectif atteint", v: reached },
              { k: "Exclus", v: excludedCount },
            ].map((m) => (
              <div key={m.k} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary-light)" }}>{m.v}</div>
                <div style={label}>{m.k}</div>
              </div>
            ))}
          </div>

          {(selected?.ambassador_enabled ?? selected?.ambassadorEnabled) && (
            <div style={{ ...card, borderColor: "rgba(217,119,6,0.28)", background: "rgba(217,119,6,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ambassadeurs flash</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 3 }}>
                    Top {selected?.ambassador_winner_count ?? selected?.ambassadorWinnerCount ?? 5} parrains. Un filleul compte avec {selected?.ambassador_target_contributions ?? selected?.ambassadorTargetContributions ?? 10} contributions approuvees et au plus {selected?.ambassador_dormant_max_contributions ?? selected?.ambassadorDormantMaxContributions ?? 2} contributions dans les {selected?.ambassador_dormant_days ?? selected?.ambassadorDormantDays ?? 7} jours avant.
                  </div>
                </div>
                <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent)" }}>{ambassadorEntries.length}</span>
              </div>
              {selected?.ambassador_prize_text || selected?.ambassadorPrizeText ? (
                <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", padding: "8px 10px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--border)", marginBottom: 10 }}>
                  {selected.ambassador_prize_text ?? selected.ambassadorPrizeText}
                </div>
              ) : null}
              {ambassadorEntries.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>Aucun parrain qualifie pour le moment.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ambassadorEntries.slice(0, 20).map((a) => (
                    <div key={a.referrer_id ?? a.code ?? a.rank} style={{ padding: "9px 10px", borderRadius: 11, background: "var(--surface-1)", border: `1px solid ${a.prizeEligible ? "var(--accent)" : "var(--border)"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 28, fontWeight: 900, color: a.prizeEligible ? "var(--accent)" : "var(--text-muted)" }}>#{a.rank}</span>
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 800, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.username ?? a.code ?? a.referrer_id}</span>
                        {a.prizeEligible && <span style={{ fontSize: "0.58rem", fontWeight: 900, padding: "2px 7px", borderRadius: 999, background: "rgba(217,119,6,0.14)", color: "var(--accent)" }}>prix bonus</span>}
                        <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--text-primary)" }}>{a.qualified_referees ?? a.qualifiedReferees ?? 0} filleul(s)</span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{a.referee_contributions ?? a.refereeContributions ?? 0} approuvees</span>
                      </div>
                      {a.referees?.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {a.referees.map((r) => (
                            <span key={r.userId} title={`${r.approvedFlash} approuvees, ${r.submittedFlash} soumises, ${r.preWindowContribs} avant tournoi`} style={{ fontSize: "0.64rem", color: "var(--text-secondary)", padding: "4px 7px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                              {r.username ?? r.userId}: {r.approvedFlash}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un participant..." style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }} />
            </div>
          </div>

          {loading && <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}><Activity size={22} className="spin" style={{ margin: "0 auto" }} /></div>}

          {!loading && filtered.length === 0 && (
            <div style={{ ...card, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucun participant pour ce filtre.</div>
          )}

          {filtered.map((p, index) => {
            const isOpen = !!expanded[p.user_id];
            const rank = p.excluded ? null : activeRankByUser.get(p.user_id) ?? index + 1;
            const prizeEligible = !p.excluded && p.reached_target && rank != null && rank <= Number(selected?.winner_count ?? selected?.winnerCount ?? 0);
            return (
              <div key={p.user_id} style={{ ...card, borderColor: p.excluded ? "rgba(248,113,113,0.28)" : prizeEligible ? "rgba(16,185,129,0.3)" : "var(--border)", opacity: p.excluded ? 0.78 : 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 800, color: p.excluded ? "var(--danger)" : "var(--accent)" }}>{rank ? `#${rank}` : "EX"}</span>
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => toggleHistory(p.user_id)} style={{ background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer", padding: 0, fontSize: "0.92rem", fontWeight: 800 }}>
                        {p.username ?? p.user_id}
                      </button>
                      {p.reached_target && <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "var(--success)" }}>objectif</span>}
                      {prizeEligible && <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(217,119,6,0.14)", color: "var(--accent)" }}>prix</span>}
                      {p.excluded && <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>exclu tournoi</span>}
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>validées: {p.approved_contributions}/{selected?.target_contributions ?? selected?.targetContributions ?? 0}</span>
                      <span>soumises: {p.tournament_contributions}</span>
                      <span>lignes: {p.flash_rows}</span>
                      <span>masquées: {p.hidden_contributions}</span>
                      <span>rejetées: {p.rejected_contributions}</span>
                      <span>score départ: {p.official_points}{p.official_rank ? ` (#${p.official_rank})` : ""}</span>
                      <span>dernier: {formatDate(p.last_contribution_at)}</span>
                    </div>
                    {p.exclusion_reason && <div style={{ fontSize: "0.66rem", color: "var(--danger)", marginTop: 4 }}>Raison: {p.exclusion_reason}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => toggleHistory(p.user_id)} style={smallBtn}>
                      {isOpen ? "Fermer" : "Historique"}
                    </button>
                    <button disabled={busy === `delall-${p.user_id}`} onClick={() => deleteAllForUser(p)} style={{ ...smallBtn, borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)", color: "var(--danger)" }}>
                      {busy === `delall-${p.user_id}` ? "Suppression…" : "🗑️ Supprimer TOUT"}
                    </button>
                    <button disabled={busy === `exclude-${p.user_id}`} onClick={() => setExcluded(p, !p.excluded)} style={{ ...smallBtn, borderColor: p.excluded ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)", color: p.excluded ? "var(--success)" : "var(--danger)" }}>
                      {p.excluded ? "Réintégrer" : "Exclure"}
                    </button>
                  </div>
                </div>
                {isOpen && (() => {
                  const pg = pages[p.user_id];
                  const items = pg?.items ?? [];
                  const total = pg?.total ?? 0;
                  const offset = pg?.offset ?? 0;
                  const ids = items.map((c) => c.id);
                  const selIds = ids.filter((id) => sel[id]);
                  const allSel = ids.length > 0 && selIds.length === ids.length;
                  const pageNum = Math.floor(offset / PAGE) + 1;
                  const totalPages = Math.max(1, Math.ceil(total / PAGE));
                  return (
                    <div style={{ marginTop: 12 }}>
                      {pg?.loading ? (
                        <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.78rem" }}>Chargement…</div>
                      ) : total === 0 ? (
                        <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.78rem" }}>Aucune contribution flash listée.</div>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                            <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", fontWeight: 700 }}>{total} contributions</span>
                            <button onClick={() => setSel((s) => { const n = { ...s }; ids.forEach((id) => { n[id] = !allSel; }); return n; })} style={smallBtn}>
                              {allSel ? "Désélectionner la page" : "Sélectionner la page"}
                            </button>
                            <button disabled={!selIds.length || busy === "bulk"} onClick={() => bulkDelete(p.user_id, selIds)} style={{ ...smallBtn, borderColor: "rgba(248,113,113,0.25)", color: "var(--danger)", opacity: selIds.length ? 1 : 0.45 }}>
                              🗑️ Supprimer la sélection ({selIds.length})
                            </button>
                            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>audio + points retirés, phrase recyclée</span>
                          </div>
                          {items.map(renderContribution)}
                          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "10px 0" }}>
                            <button disabled={offset === 0 || pg?.loading} onClick={() => loadPage(p.user_id, Math.max(0, offset - PAGE))} style={{ ...smallBtn, opacity: offset === 0 ? 0.4 : 1 }}>‹ Précédent</button>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>page {pageNum} / {totalPages}</span>
                            <button disabled={offset + PAGE >= total || pg?.loading} onClick={() => loadPage(p.user_id, offset + PAGE)} style={{ ...smallBtn, opacity: offset + PAGE >= total ? 0.4 : 1 }}>Suivant ›</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("realtime");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phraseLang, setPhraseLang] = useState("en");
  const [phrasePage, setPhrasePage] = useState(1);
  const [phraseSearch, setPhraseSearch] = useState("");
  const [phraseSearchInput, setPhraseSearchInput] = useState("");
  const [selectedPhrase, setSelectedPhrase] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.push("/login"); return; }
      }
      getMyProfile().then(({ data: d }) => {
        if (d?.profile?.role !== "admin") { router.push("/contribute"); return; }
        setAuthorized(true);
      });
    }
    init();
  }, []);

  const loadTab = () => {
    if (!authorized) return;
    // These tabs are self-contained (manage their own data fetching)
    if (tab === "security" || tab === "inscrits" || tab === "competition" || tab === "flash" || tab === "notify" || tab === "replace" || tab === "antifraud" || tab === "points" || tab === "evalmatrix" || tab === "credit" || tab === "failed" || tab === "productivity" || tab === "assign" || tab === "disclaimer") {
      setLoading(false);
      return;
    }
    setLoading(true);
    const endpoints: Record<Exclude<Tab, "security" | "inscrits" | "competition" | "flash" | "notify" | "replace" | "antifraud" | "points" | "evalmatrix" | "credit" | "failed" | "productivity" | "assign" | "disclaimer">, string> = {
      realtime: "/api/m/realtime",
      users: "/api/m/list",
      phrases: `/api/m/phrases?lang=${phraseLang}&page=${phrasePage}&limit=20${phraseSearch ? `&search=${encodeURIComponent(phraseSearch)}` : ""}`,
      import: "/api/m/pipeline-stats",
      audit: "/api/m/audit-log?limit=50",
      config: "/api/m/config",
      consensus: "/api/m/consensus",
      dataset: "/api/m/dataset",
    };
    adminFetch(endpoints[tab as keyof typeof endpoints]).then((d) => { setData(d); setLoading(false); });
  };

  useEffect(loadTab, [tab, authorized, phraseLang, phrasePage, phraseSearch]);

  // Debounce search input → phraseSearch (resets page to 1)
  useEffect(() => {
    if (tab !== "phrases") return;
    const t = setTimeout(() => {
      if (phraseSearchInput !== phraseSearch) {
        setPhrasePage(1);
        setPhraseSearch(phraseSearchInput.trim());
      }
    }, 350);
    return () => clearTimeout(t);
  }, [phraseSearchInput, tab]);

  // Auto-refresh realtime every 15s
  useEffect(() => {
    if (tab !== "realtime" || !authorized) return;
    const id = setInterval(loadTab, 15000);
    return () => clearInterval(id);
  }, [tab, authorized]);

  const handleLogout = async () => { await logout(); router.push("/"); };

  if (!authorized) return null;

  const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginBottom: 12 };
  const label: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 4 };
  const metric: React.CSSProperties = { fontSize: "1.4rem", fontWeight: 800, background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" };

  return (
    <div className="noise-bg admin-premium" style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800&display=swap');
        /* Premium retheme (ElevenLabs-style) — overrides the design tokens on the admin
           root so every var()-based inline style shifts to monochrome + teal, premium
           solid surfaces, without touching individual components. */
        .admin-premium{
          --accent-green:#08DDB8; --accent-green-soft:rgba(8,221,184,.14);
          --primary-light:#2ee6c6;
          --gradient-brand:linear-gradient(135deg,#5EEAD4 0%,#08DDB8 100%);
          --surface-1:#141414; --surface-2:#1b1b1b; --bg-card:#141414;
          --border:#262626; --border-hover:#3a3a3a;
          background-image:radial-gradient(820px 480px at 85% -10%, rgba(8,221,184,.07), transparent 70%);
        }
        .admin-premium h1,.admin-premium h2,.admin-premium h3{font-family:'Inter Tight','Inter',system-ui,sans-serif;letter-spacing:-.025em}
        .admin-premium ::-webkit-scrollbar{height:7px;width:7px}
        .admin-premium ::-webkit-scrollbar-track{background:transparent}
        .admin-premium ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:7px}
        .admin-premium ::-webkit-scrollbar-thumb:hover{background:#3a3a3a}
      `}</style>
      <TopBar onLogout={handleLogout} />
      <BottomNav />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px calc(var(--nav-height) + 20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Shield size={24} color="var(--primary-light)" />
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Admin Panel</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface-1)", borderRadius: 12, padding: 4, border: "1px solid var(--border)", overflowX: "auto" }}>
          {([
            { key: "realtime" as Tab, label: "Live", icon: <Zap size={13} /> },
            { key: "productivity" as Tab, label: "Productivité", icon: <TrendingUp size={13} /> },
            { key: "inscrits" as Tab, label: "Inscrits", icon: <UserCheck size={13} /> },
            { key: "competition" as Tab, label: "Compétition", icon: <Clock size={13} /> },
            { key: "flash" as Tab, label: "Tournoi flash", icon: <Trophy size={13} /> },
            { key: "credit" as Tab, label: "Crédit", icon: <Hourglass size={13} /> },
            { key: "assign" as Tab, label: "Cibler", icon: <Target size={13} /> },
            { key: "disclaimer" as Tab, label: "Lancement", icon: <ShieldCheck size={13} /> },
            { key: "failed" as Tab, label: "Sauvetage", icon: <RotateCcw size={13} /> },
            { key: "notify" as Tab, label: "Notifier", icon: <Bell size={13} /> },
            { key: "replace" as Tab, label: "Replace", icon: <RefreshCw size={13} /> },
            { key: "antifraud" as Tab, label: "Anti-fraude", icon: <Shield size={13} /> },
            { key: "evalmatrix" as Tab, label: "Évaluations", icon: <Vote size={13} /> },
            { key: "points" as Tab, label: "Points", icon: <BarChart3 size={13} /> },
            { key: "users" as Tab, label: "Users", icon: <Users size={13} /> },
            { key: "phrases" as Tab, label: "Phrases", icon: <FileText size={13} /> },
            { key: "import" as Tab, label: "Import", icon: <Upload size={13} /> },
            { key: "audit" as Tab, label: "Audit", icon: <Eye size={13} /> },
            { key: "consensus" as Tab, label: "Consensus", icon: <Vote size={13} /> },
            { key: "dataset" as Tab, label: "Dataset", icon: <Database size={13} /> },
            { key: "config" as Tab, label: "Config", icon: <Settings size={13} /> },
            { key: "security" as Tab, label: "Security", icon: <Lock size={13} /> },
          ]).map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedPhrase(null); }} style={{
              flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", cursor: "pointer",
              fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              background: tab === t.key ? "var(--gradient-brand)" : "transparent",
              color: tab === t.key ? "white" : "var(--text-muted)",
              boxShadow: tab === t.key ? "0 2px 10px var(--primary-glow)" : "none",
              transition: "all 0.2s",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading && tab !== "security" && tab !== "inscrits" && tab !== "competition" && tab !== "flash" && tab !== "notify" && tab !== "replace" && tab !== "antifraud" && tab !== "evalmatrix" && tab !== "credit" && tab !== "productivity" && tab !== "assign" && tab !== "disclaimer" ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <Activity size={32} className="spin" style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          </div>
        ) : tab === "productivity" ? (
          <ProductivityPanel />
        ) : tab === "assign" ? (
          <PhraseAssignPanel />
        ) : tab === "disclaimer" ? (
          <DisclaimerPanel />
        ) : tab === "credit" ? (
          <CreditTrackingPanel />
        ) : tab === "failed" ? (
          <FailedSubmissionsPanel />
        ) : tab === "inscrits" ? (
          <InscritsPanel />
        ) : tab === "competition" ? (
          <CompetitionConfigPanel />
        ) : tab === "flash" ? (
          <FlashTournamentAdminPanel />
        ) : tab === "notify" ? (
          <NotificationsPanel />
        ) : tab === "replace" ? (
          <DatasetReplacePanel />
        ) : tab === "antifraud" ? (
          <AntiFraudPanel />
        ) : tab === "evalmatrix" ? (
          <EvalMatrixPanel />
        ) : tab === "points" ? (
          <PointsPanel />
        ) : tab === "realtime" ? (
          /* ══ REALTIME ══ */
          <div>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 20 }}>
              {[
                { v: data?.stats?.total_users, l: "Inscrits" },
                { v: data?.activeUsers, l: "Actifs (1h)" },
                { v: data?.stats?.total_contributions, l: "Traductions" },
                { v: data?.stats?.total_approved, l: "Validées" },
                { v: data?.stats ? `${data.stats.phrases_covered ?? 0}/${data.stats.total_phrases ?? 0}` : null, l: "Couverture" },
              ].map((s, i) => (
                <div key={i} style={{ ...card, textAlign: "center", padding: 16 }}>
                  <div style={metric}>{s.v ?? "-"}</div>
                  <div style={label}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Leaderboard */}
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginBottom: 12 }}>Classement temps réel</h3>
            {data?.leaderboard?.map((u: any, i: number) => {
              const bot = u.bot_score ?? 0;
              const botColor = bot >= 60 ? "var(--danger)" : bot >= 35 ? "#D97706" : bot >= 20 ? "#9CA3AF" : "var(--text-muted)";
              const botBg = bot >= 60 ? "rgba(239,68,68,0.12)" : bot >= 35 ? "rgba(251,191,36,0.14)" : "var(--surface-1)";
              return (
              <div key={u.id} style={{ ...card, display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: 12, padding: "12px 16px", border: bot >= 60 ? "1px solid var(--danger)" : "1px solid var(--border)" }}>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: i < 3 ? "var(--accent)" : "var(--text-muted)", textAlign: "center" }}>#{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {u.username} <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Lv{u.level}</span>
                    {u.account_tag === "pool" && <span style={{ fontSize: "0.58rem", fontWeight: 800, padding: "1px 7px", borderRadius: 100, background: "rgba(239,68,68,0.14)", color: "var(--danger)" }}>👥 POOL</span>}
                    {u.account_tag === "alone" && <span style={{ fontSize: "0.58rem", fontWeight: 800, padding: "1px 7px", borderRadius: 100, background: "rgba(16,185,129,0.14)", color: "var(--success, #10b981)" }}>👤 SEUL</span>}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                    <span>{u.total_contributions}c</span>
                    <span>{u.total_validations}v</span>
                    <span>{u.approved_count}✓</span>
                    <span>{u.rejected_count}✗</span>
                    <span>Q:{u.quality_ratio}</span>
                    <span>T:{u.validator_trust}</span>
                    <span>🔥{u.streak_days}j</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ ...metric, fontSize: "1.1rem" }}>{u.points}</span>
                  {u.bot_evals != null && (
                    <span
                      title={`Bot score ${bot}/100 — cadence méd. ${u.bot_gap}s · régularité(CV) ${u.bot_cv} · ${u.bot_hours}h actives/24 · burst ${u.bot_burst}/min · ${u.bot_oui}% oui · ${u.bot_evals} évals. (>60 = script probable)`}
                      style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: 100, background: botBg, color: botColor, whiteSpace: "nowrap", cursor: "help" }}>
                      🤖 {bot}
                    </span>
                  )}
                  <button
                    onClick={async () => { const next = u.account_tag === "alone" ? "pool" : u.account_tag === "pool" ? "" : "alone"; await adminPost("/api/m/account-tag", { userId: u.id, tag: next }); loadTab(); }}
                    title="Tagger le compte : aucun → 👤 seul → 👥 pool"
                    style={{ fontSize: "0.56rem", fontWeight: 800, padding: "3px 8px", borderRadius: 100, cursor: "pointer", border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {u.account_tag === "pool" ? "👥 pool" : u.account_tag === "alone" ? "👤 seul" : "+ tag"}
                  </button>
                </div>
              </div>
              );
            })}

            {/* Recent activity */}
            {/* Activity chart (last 24h) */}
            {data?.hourlyRate?.length > 0 && (
              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginBottom: 12 }}>Contributions / heure (24h)</h3>
                <div style={{ ...card, padding: "16px", display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
                  {(() => {
                    const rates = (data.hourlyRate as any[]).slice(0, 24).reverse();
                    const max = Math.max(...rates.map((r: any) => r.count), 1);
                    return rates.map((r: any, i: number) => (
                      <div key={i} title={`${new Date(r.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${r.count}`} style={{
                        flex: 1, minWidth: 8, borderRadius: "4px 4px 0 0", transition: "all 0.3s",
                        height: `${Math.max((r.count / max) * 100, 4)}%`,
                        background: r.count > 0 ? "var(--gradient-brand)" : "rgba(255,255,255,0.05)",
                      }} />
                    ));
                  })()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 4 }}>
                  <span>{data.hourlyRate?.length > 0 ? new Date(data.hourlyRate[data.hourlyRate.length - 1].hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  <span>maintenant</span>
                </div>
              </div>
            )}

            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary-light)", marginTop: 24, marginBottom: 12 }}>Activité récente (30 min)</h3>
            {data?.recentActivity?.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucune activité</p>}
            {data?.recentActivity?.map((a: any, i: number) => (
              <div key={i} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.78rem", display: "flex", justifyContent: "space-between" }}>
                <span><span style={{ color: "var(--primary-light)", fontWeight: 600 }}>{a.action}</span> ·{a.username ?? "?"}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{new Date(a.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        ) : tab === "users" ? (
          /* ══ USERS ══ */
          selectedUser ? (
            /* User detail view */
            <div>
              <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", color: "var(--primary-light)", cursor: "pointer", fontSize: "0.85rem", marginBottom: 16 }}>← Retour</button>
              {userLoading ? <div style={{ textAlign: "center", padding: 40 }}><Activity size={24} className="spin" style={{ color: "var(--primary)", opacity: 0.4 }} /></div> : (
                <div>
                  {/* User header */}
                  <div style={{ ...card, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{selectedUser.user?.username}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 8 }}>Lv{selectedUser.user?.level} ·{selectedUser.user?.role}</span>
                      </div>
                      <span style={{ ...metric, fontSize: "1.2rem" }}>{selectedUser.user?.points} pts</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                      <div><span style={label}>Nom</span><br />{selectedUser.user?.first_name} {selectedUser.user?.last_name}</div>
                      <div><span style={label}>Email</span><br />{selectedUser.user?.email}</div>
                      <div><span style={label}>NNI</span><br />{selectedUser.user?.nni || "-"}</div>
                      <div><span style={label}>WhatsApp</span><br />{selectedUser.user?.whatsapp || "-"}</div>
                      <div><span style={label}>Langue</span><br />{selectedUser.user?.preferred_lang?.toUpperCase()}</div>
                      <div><span style={label}>Inscrit le</span><br />{new Date(selectedUser.user?.created_at).toLocaleDateString()}</div>
                      <div><span style={label}>Connexions</span><br />{selectedUser.logins?.length ?? 0}</div>
                      <div><span style={label}>Streak</span><br />{selectedUser.user?.streak_days}j</div>
                      <div><span style={label}>Trust</span><br />{selectedUser.user?.validator_trust}</div>
                    </div>
                  </div>

                  {/* Admin overrides: eval-gate exemption + leaderboard visibility */}
                  <div style={{ ...card, marginBottom: 16 }}>
                    <div style={{ ...label, color: "var(--primary-light)", marginBottom: 10 }}>Contrôles admin</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={async () => {
                          const next = !(selectedUser.user?.eval_exempt && selectedUser.user?.leaderboard_hidden);
                          await adminPost(`/api/m/x/users/${selectedUser.user.id}/invisible-validator`, { value: next });
                          setSelectedUser(await adminFetch(`/api/m/user/${selectedUser.user.id}`));
                        }}
                        style={{ flex: "1 1 100%", minWidth: 220, padding: "12px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: "0.8rem",
                          border: `1px solid ${selectedUser.user?.eval_exempt && selectedUser.user?.leaderboard_hidden ? "rgba(8,221,184,0.45)" : "var(--border)"}`,
                          background: selectedUser.user?.eval_exempt && selectedUser.user?.leaderboard_hidden ? "rgba(8,221,184,0.12)" : "rgba(255,255,255,0.03)",
                          color: selectedUser.user?.eval_exempt && selectedUser.user?.leaderboard_hidden ? "var(--primary-light)" : "var(--text-secondary)" }}>
                        {selectedUser.user?.eval_exempt && selectedUser.user?.leaderboard_hidden ? "OK " : ""}Validateur invisible
                      </button>
                      <button onClick={async () => {
                          await adminPost(`/api/m/x/users/${selectedUser.user.id}/eval-exempt`, { value: !selectedUser.user.eval_exempt });
                          setSelectedUser(await adminFetch(`/api/m/user/${selectedUser.user.id}`));
                        }}
                        style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem",
                          border: `1px solid ${selectedUser.user?.eval_exempt ? "rgba(16,185,129,0.4)" : "var(--border)"}`,
                          background: selectedUser.user?.eval_exempt ? "rgba(16,185,129,0.12)" : "transparent",
                          color: selectedUser.user?.eval_exempt ? "var(--success)" : "var(--text-secondary)" }}>
                        {selectedUser.user?.eval_exempt ? "✓ " : ""}Exempt de la limite d'évaluation
                      </button>
                      <button onClick={async () => {
                          await adminPost(`/api/m/x/users/${selectedUser.user.id}/leaderboard-hidden`, { value: !selectedUser.user.leaderboard_hidden });
                          setSelectedUser(await adminFetch(`/api/m/user/${selectedUser.user.id}`));
                        }}
                        style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: "0.78rem",
                          border: `1px solid ${selectedUser.user?.leaderboard_hidden ? "rgba(217,119,6,0.4)" : "var(--border)"}`,
                          background: selectedUser.user?.leaderboard_hidden ? "rgba(217,119,6,0.12)" : "transparent",
                          color: selectedUser.user?.leaderboard_hidden ? "#d97706" : "var(--text-secondary)" }}>
                        {selectedUser.user?.leaderboard_hidden ? "✓ " : ""}Masqué du leaderboard
                      </button>
                    </div>
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
                      « Exempt » : peut évaluer sans le seuil de contributions validées. « Masqué » : n'apparaît plus dans le classement public (ni dans le calcul des rangs).
                    </div>
                  </div>

                  {/* Per-user contributions — lazy-loaded + hide/restore */}
                  {selectedUser.user?.id && <UserContributionsManager userId={selectedUser.user.id} />}

                  {/* Stats row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                    {[
                      { v: selectedUser.user?.total_contributions ?? selectedUser.contributions?.length, l: "Traductions" },
                      { v: selectedUser.user?.total_validations ?? selectedUser.validations?.length, l: "Validations" },
                      { v: selectedUser.user?.total_votes ?? selectedUser.votes?.length, l: "Votes" },
                      { v: selectedUser.user?.approved_count ?? selectedUser.contributions?.filter((c: any) => c.status === "approved").length, l: "Approuvées" },
                    ].map((s, i) => (
                      <div key={i} style={{ ...card, textAlign: "center", padding: 12 }}>
                        <div style={metric}>{s.v ?? 0}</div>
                        <div style={label}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Daily activity chart */}
                  {selectedUser.dailyActivity?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ ...label, color: "var(--primary-light)", marginBottom: 10 }}>Activité (14 derniers jours)</h3>
                      <div style={{ ...card, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, marginBottom: 8 }}>
                          {selectedUser.dailyActivity.map((d: any, i: number) => {
                            const total = d.contributions + d.validations + d.votes;
                            const max = Math.max(...selectedUser.dailyActivity.map((x: any) => x.contributions + x.validations + x.votes), 1);
                            return (
                              <div key={i} title={`${new Date(d.day).toLocaleDateString()}: ${d.contributions}c ${d.validations}v ${d.votes}vo ${d.logins_count}login`}
                                style={{ flex: 1, borderRadius: "3px 3px 0 0", transition: "all 0.3s",
                                  height: `${Math.max((total / max) * 100, 4)}%`,
                                  background: total > 0 ? "var(--gradient-brand)" : "rgba(255,255,255,0.05)",
                                }} />
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.55rem", color: "var(--text-muted)" }}>
                          <span>{new Date(selectedUser.dailyActivity[0]?.day).toLocaleDateString([], { day: "2-digit", month: "2-digit" })}</span>
                          <span>aujourd'hui</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: "0.6rem", color: "var(--text-muted)" }}>
                          <span>Total: {selectedUser.dailyActivity.reduce((s: number, d: any) => s + d.contributions, 0)} traductions</span>
                          <span>{selectedUser.dailyActivity.reduce((s: number, d: any) => s + d.validations, 0)} validations</span>
                          <span>{selectedUser.dailyActivity.reduce((s: number, d: any) => s + d.votes, 0)} votes</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contributions list moved to the lazy-loaded UserContributionsManager above
                      (paginated + hide/delete) — no more eager render of thousands of rows. */}

                  {/* Validations */}
                  <h3 style={{ ...label, color: "var(--primary-light)", marginTop: 20, marginBottom: 12 }}>Validations effectuées ({selectedUser.validations?.length})</h3>
                  {selectedUser.validations?.slice(0, 20).map((v: any) => (
                    <div key={v.id} style={{ ...card, padding: "8px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.78rem" }}>{v.is_valid ? "✓" : "✗"} texte:{v.text_accuracy}/5 audio:{v.audio_clarity ?? "-"}/5</span>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{new Date(v.created_at).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>→ {v.contributor_name}: "{v.hassaniya_text?.slice(0, 50)}" ({v.contribution_status})</div>
                    </div>
                  ))}

                  {/* Votes */}
                  <h3 style={{ ...label, color: "var(--primary-light)", marginTop: 20, marginBottom: 12 }}>Votes ({selectedUser.votes?.length})</h3>
                  {selectedUser.votes?.map((v: any) => (
                    <div key={v.id} style={{ ...card, padding: "8px 14px" }}>
                      <div style={{ fontSize: "0.78rem" }}>A choisi: <strong>{v.chosen_contributor}</strong> ·"{v.hassaniya_text?.slice(0, 50)}"</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{v.source_lang?.toUpperCase()}: {v.source_text?.slice(0, 60)} ·{new Date(v.created_at).toLocaleString()}</div>
                    </div>
                  ))}

                  {/* Logins */}
                  <h3 style={{ ...label, color: "var(--primary-light)", marginTop: 20, marginBottom: 12 }}>Connexions récentes ({selectedUser.logins?.length})</h3>
                  {selectedUser.logins?.map((l: any, i: number) => (
                    <div key={i} style={{ padding: "4px 0", fontSize: "0.72rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                      {new Date(l.created_at).toLocaleString()} ·IP: {l.ip_address || "-"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* User list view */
            <div>
              {/* Recherche */}
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={15} style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Rechercher un utilisateur (nom, email, WhatsApp)…" style={{ width: "100%", padding: "10px 34px", fontSize: "0.85rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none" }} />
                {userSearch && <button onClick={() => setUserSearch("")} style={{ position: "absolute", insetInlineEnd: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" }}><XCircle size={15} /></button>}
              </div>
              {(() => {
                const q = userSearch.trim().toLowerCase();
                const list = (data?.users || []).filter((u: any) => !q || (u.username || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.whatsapp || "").toLowerCase().includes(q));
                return (<>
                  <div style={label}>{list.length} utilisateur{list.length > 1 ? "s" : ""}{q ? ` / ${data?.users?.length ?? 0}` : ""}</div>
                  {list.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: "0.85rem" }}>Aucun utilisateur trouvé.</div>}
                  {list.map((u: any) => (
                <div key={u.id} style={{ ...card, cursor: "pointer", transition: "all 0.2s" }} onClick={async () => {
                  setUserLoading(true); setSelectedUser({});
                  const detail = await adminFetch(`/api/m/user/${u.id}`);
                  setSelectedUser(detail); setUserLoading(false);
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>{u.username}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 8 }}>Lv{u.level} ·{u.preferred_lang?.toUpperCase()}</span>
                      {u.role === "admin" && <span style={{ fontSize: "0.6rem", marginLeft: 6, padding: "2px 6px", borderRadius: 4, background: "var(--gradient-brand)", color: "white" }}>ADMIN</span>}
                      {u.eval_exempt && u.leaderboard_hidden && <span style={{ fontSize: "0.6rem", marginLeft: 6, padding: "2px 6px", borderRadius: 4, background: "rgba(8,221,184,0.14)", color: "var(--primary-light)", fontWeight: 800 }}>VALIDATEUR INVISIBLE</span>}
                      {u.disqualified && <span style={{ fontSize: "0.6rem", marginLeft: 6, padding: "2px 6px", borderRadius: 4, background: "rgba(217,119,6,0.15)", color: "var(--accent)" }}>DQ</span>}
                    </div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)" }}>{u.points} pts</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                    <div><span style={label}>Contributions</span><br />{u.total_contributions}</div>
                    <div><span style={label}>Validations</span><br />{u.total_validations}</div>
                    <div><span style={label}>Votes</span><br />{u.total_votes ?? 0}</div>
                    <div><span style={label}>Connexions</span><br />{u.login_count ?? 0}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <button onClick={async (e) => { e.stopPropagation();
                      const pw = prompt("Nouveau mot de passe (6+ chars):");
                      if (pw && pw.length >= 6) { const r = await adminPost("/api/m/reset-password", { userId: u.id, newPassword: pw }); alert(r.success ? "OK!" : r.error); }
                    }} style={{ fontSize: "0.7rem", padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                      <KeyRound size={11} /> Reset PW
                    </button>
                    {u.role !== "admin" && <button onClick={async (e) => { e.stopPropagation();
                      if (confirm(`Ban ${u.username}?`)) { await adminPost("/api/m/ban", { userId: u.id, ban: true }); loadTab(); }
                    }} style={{ fontSize: "0.7rem", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.05)", color: "var(--danger)", cursor: "pointer" }}>
                      <Ban size={11} /> Ban
                    </button>}
                    {u.role !== "admin" && <button onClick={async (e) => { e.stopPropagation();
                      const dq = !u.disqualified;
                      const msg = dq
                        ? `Disqualifier ${u.username} ?\n\n• Ses points → 0\n• Son audio masqué en validation\n• Ses évaluations annulées (les gens qu'il a validés perdent les points liés)\n\nLe compte reste actif. Réversible.`
                        : `Réhabiliter ${u.username} ? (tout est restauré)`;
                      if (confirm(msg)) { const r = await adminPost("/api/m/disqualify", { userId: u.id, disqualify: dq }); if (r.success) loadTab(); else alert(r.error); }
                    }} style={{ fontSize: "0.7rem", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(217,119,6,0.3)", background: u.disqualified ? "rgba(16,185,129,0.08)" : "rgba(217,119,6,0.06)", color: u.disqualified ? "var(--success)" : "var(--accent)", cursor: "pointer" }}>
                      {u.disqualified ? <><UserCheck size={11} /> Réhabiliter</> : <><AlertTriangle size={11} /> Disqualifier</>}
                    </button>}
                    {u.role !== "admin" && <button onClick={async (e) => { e.stopPropagation();
                      const v = !u.email_verified;
                      const msg = v ? `Valider l'email de ${u.username} ? (il t'a contacté par WhatsApp)` : `Annuler la vérification email de ${u.username} ?`;
                      if (confirm(msg)) { const r = await adminPost("/api/m/verify-email", { userId: u.id, verified: v }); if (r.success) loadTab(); else alert(r.error); }
                    }} style={{ fontSize: "0.7rem", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.25)", background: u.email_verified ? "rgba(16,185,129,0.12)" : "transparent", color: u.email_verified ? "var(--success)" : "var(--text-muted)", cursor: "pointer" }}>
                      <CheckCircle size={11} /> {u.email_verified ? "Email vérifié" : "Valider email"}
                    </button>}
                  </div>
                </div>
              ))}
                </>);
              })()}
            </div>
          )
        ) : tab === "phrases" ? (
          /* ══ PHRASES ══ */
          selectedPhrase ? (
            /* Phrase detail view */
            <div>
              <button onClick={() => setSelectedPhrase(null)} style={{ background: "none", border: "none", color: "var(--primary-light)", cursor: "pointer", fontSize: "0.85rem", marginBottom: 16 }}>← Retour</button>
              <div style={card}>
                <div style={label}>{selectedPhrase.phrase?.source_lang?.toUpperCase()} ·{selectedPhrase.phrase?.category}</div>
                <p style={{ fontSize: "1.1rem", fontWeight: 500, lineHeight: 1.7, marginBottom: 16 }}>{selectedPhrase.phrase?.source_text}</p>
                {selectedPhrase.siblings?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={label}>Versions parallèles</div>
                    {selectedPhrase.siblings.map((s: any) => (
                      <div key={s.id} style={{ fontSize: "0.85rem", color: "var(--text-secondary)", padding: "6px 0", borderBottom: "1px solid var(--border)" }} dir={s.source_lang === "ar" ? "rtl" : "ltr"}>
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginRight: 8 }}>{s.source_lang.toUpperCase()}</span>
                        {s.source_text}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vote consensus */}
              {selectedPhrase.voteResults?.length > 0 && (
                <div style={{ marginTop: 20, marginBottom: 16 }}>
                  <h3 style={{ ...label, color: "var(--accent)", marginBottom: 10 }}>Consensus ({selectedPhrase.totalVotes} votes)</h3>
                  {selectedPhrase.voteResults.map((v: any, i: number) => (
                    <div key={v.contribution_id} style={{ ...card, padding: "10px 14px", borderColor: i === 0 && v.vote_count > 0 ? "rgba(217, 119, 6,0.3)" : "var(--border)", background: i === 0 && v.vote_count > 0 ? "rgba(217, 119, 6,0.04)" : undefined }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          {i === 0 && v.vote_count > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--accent)", marginRight: 6 }}>🏆 GAGNANTE</span>}
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{v.username}</span>
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: v.vote_count > 0 ? "var(--accent)" : "var(--text-muted)" }}>{v.vote_count} vote{v.vote_count !== 1 ? "s" : ""}</span>
                      </div>
                      <p dir="rtl" style={{ fontSize: "0.95rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.6, marginTop: 6 }}>{v.hassaniya_text}</p>
                    </div>
                  ))}
                </div>
              )}

              <h3 style={{ ...label, marginTop: 20, marginBottom: 12, color: "var(--primary-light)" }}>Traductions ({selectedPhrase.translations?.length})</h3>
              {selectedPhrase.translations?.map((t: any, i: number) => (
                <div key={t.id} style={{ ...card, borderColor: t.status === "approved" ? "rgba(22, 163, 74,0.2)" : t.status === "rejected" ? "rgba(248,113,113,0.2)" : "var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>#{i + 1} ·{t.username} <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Lv{t.level}</span></span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: t.status === "approved" ? "var(--success)" : t.status === "rejected" ? "var(--danger)" : "var(--text-muted)" }}>
                      {t.status.toUpperCase()} {t.quality_score && `(${t.quality_score})`}
                    </span>
                  </div>
                  <p dir="rtl" style={{ fontSize: "1.1rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.8, padding: 12, background: "var(--surface-1)", borderRadius: 10, marginBottom: 8 }}>{t.hassaniya_text}</p>
                  {t.audio_url && <AuthAudio src={t.audio_url} style={{ marginBottom: 8 }} />}
                  {t.validations?.length > 0 && (
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {t.validations.map((v: any, vi: number) => (
                        <div key={vi} style={{ padding: "4px 0", borderTop: "1px solid var(--separator)" }}>
                          {v.validator} (trust:{v.validator_trust}) ·texte:{v.text_accuracy}/5 {v.is_valid ? "✓" : "✗"} {v.notes && `"${v.notes}"`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Phrase list view */
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                {["en", "fr", "ar"].map(l => (
                  <button key={l} onClick={() => { setPhraseLang(l); setPhrasePage(1); }} style={{
                    padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: "0.8rem", fontWeight: 600,
                    background: phraseLang === l ? "var(--gradient-brand)" : "rgba(255,255,255,0.04)",
                    color: phraseLang === l ? "white" : "var(--text-muted)",
                  }}>{l.toUpperCase()}</button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {data?.total ?? 0} phrases · {data?.totalPages ?? 1} pages
                </span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <input
                  className="input"
                  type="text"
                  placeholder="Rechercher (texte ou ID phrase)..."
                  value={phraseSearchInput}
                  onChange={(e) => setPhraseSearchInput(e.target.value)}
                  dir={phraseLang === "ar" ? "rtl" : "ltr"}
                  style={{ width: "100%", padding: "10px 14px", fontSize: "0.88rem" }}
                />
                {phraseSearchInput && (
                  <button onClick={() => { setPhraseSearchInput(""); setPhraseSearch(""); setPhrasePage(1); }}
                    style={{ marginTop: 6, fontSize: "0.7rem", padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                    Effacer la recherche
                  </button>
                )}
              </div>

              {data?.phrases?.map((p: any) => (
                <div key={p.phrase_id} onClick={async () => {
                  const detail = await adminFetch(`/api/m/phrase/${p.phrase_id}/translations`);
                  setSelectedPhrase(detail);
                }} style={{ ...card, cursor: "pointer", transition: "all 0.2s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>#{p.phrase_id} ·{p.category}</span>
                    <div style={{ display: "flex", gap: 8, fontSize: "0.7rem" }}>
                      <span style={{ color: "var(--success)" }}>{p.approved_count}✓</span>
                      <span style={{ color: "var(--danger)" }}>{p.rejected_count}✗</span>
                      <span style={{ color: "var(--text-muted)" }}>{p.pending_count}⏳</span>
                    </div>
                  </div>
                  <p style={{ fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text-primary)" }} dir={phraseLang === "ar" ? "rtl" : "ltr"}>{p.source_text}</p>
                  {p.best_translator && <div style={{ fontSize: "0.7rem", color: "var(--primary)", marginTop: 6 }}>Meilleure: {p.best_translator} ({p.best_score})</div>}
                </div>
              ))}

              <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
                <button disabled={phrasePage <= 1} onClick={() => setPhrasePage(1)} className="btn-secondary" style={{ padding: "8px 12px", fontSize: "0.75rem" }}>« Première</button>
                <button disabled={phrasePage <= 1} onClick={() => setPhrasePage(p => p - 1)} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.8rem" }}>← Préc</button>
                <input
                  type="number"
                  min={1}
                  max={data?.totalPages ?? 1}
                  value={phrasePage}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v)) setPhrasePage(Math.max(1, Math.min(data?.totalPages ?? 1, v)));
                  }}
                  style={{ width: 80, padding: "8px", textAlign: "center", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: "0.85rem", outline: "none" }}
                />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>/ {data?.totalPages ?? 1}</span>
                <button disabled={phrasePage >= (data?.totalPages ?? 1)} onClick={() => setPhrasePage(p => p + 1)} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.8rem" }}>Suiv →</button>
                <button disabled={phrasePage >= (data?.totalPages ?? 1)} onClick={() => setPhrasePage(data?.totalPages ?? 1)} className="btn-secondary" style={{ padding: "8px 12px", fontSize: "0.75rem" }}>Dernière »</button>
              </div>
            </div>
          )
        ) : tab === "import" ? (
          /* ══ IMPORT ══ */
          <ImportPanel onDone={() => { setTab("phrases"); }} />
        ) : tab === "audit" ? (
          /* ══ AUDIT ══ */
          <div>
            <div style={label}>{data?.count ?? 0} entrées</div>
            {data?.logs?.map((l: any, i: number) => (
              <div key={i} style={{ ...card, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: l.action.includes("reject") || l.action.includes("ban") ? "var(--danger)" : l.action.includes("approved") || l.action.includes("level") ? "var(--success)" : "var(--primary-light)" }}>{l.action}</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{new Date(l.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  {l.username ?? "system"} {l.target_type ? `→ ${l.target_type}:${l.target_id}` : ""} {l.ip_address ? `IP:${l.ip_address}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : tab === "consensus" ? (
          /* ══ CONSENSUS ══ */
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Vote size={20} color="var(--accent)" />
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Consensus des traductions</h3>
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>{data?.phrases?.length ?? 0} phrases en consensus</span>
            </div>

            {data?.phrases?.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Aucune phrase avec 2+ traductions approuvées. Les votes ne peuvent commencer qu'après validation.
              </div>
            )}

            {data?.phrases?.map((p: any) => (
              <div key={p.phrase_id} style={{ ...card, marginBottom: 16 }}>
                {/* Phrase header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{p.source_lang?.toUpperCase()} ·{p.category}</span>
                    <p dir={p.source_lang === "ar" ? "rtl" : "ltr"} style={{ fontSize: "0.95rem", lineHeight: 1.6, marginTop: 4 }}>{p.source_text}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Votes</div>
                    <div style={{ ...metric, fontSize: "1.1rem" }}>{p.total_votes}</div>
                  </div>
                </div>

                {/* Winner badge */}
                {p.winner && (
                  <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(217, 119, 6,0.06)", border: "1px solid rgba(217, 119, 6,0.2)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1rem" }}>🏆</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Gagnante ·{p.winner.vote_count} vote{p.winner.vote_count > 1 ? "s" : ""} ·par {p.winner.username}</div>
                      <p dir="rtl" style={{ fontSize: "1rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.6 }}>{p.winner.hassaniya_text}</p>
                      {p.winner.audio_url && <AuthAudio src={p.winner.audio_url} style={{ marginTop: 6 }} />}
                    </div>
                  </div>
                )}

                {/* All translations */}
                {p.translations?.map((t: any, i: number) => (
                  <div key={t.id} style={{ padding: "8px 12px", borderBottom: i < p.translations.length - 1 ? "1px solid var(--border)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p dir="rtl" style={{ fontSize: "0.9rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.5 }}>{t.hassaniya_text}</p>
                      {t.audio_url && <AuthAudio src={t.audio_url} style={{ marginTop: 4 }} />}
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{t.username} · score: {t.quality_score}</span>
                    </div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: t.vote_count > 0 ? "var(--accent)" : "var(--text-muted)", minWidth: 40, textAlign: "right" }}>{t.vote_count}</span>
                  </div>
                ))}

                {/* Reset button */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <button onClick={async () => {
                    if (!confirm(`Réinitialiser les ${p.total_votes} votes pour cette phrase ? Les users devront revoter.`)) return;
                    await adminPost(`/api/m/consensus/reset/${p.phrase_id}`, {});
                    loadTab();
                  }} style={{ fontSize: "0.7rem", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.05)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <RotateCcw size={11} /> Réinitialiser les votes
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "dataset" ? (
          /* ══ DATASET ══ */
          <div>
            {/* Evaluation queue per dataset (to evaluate / frozen / corpus on-off) */}
            <DatasetQueuePanel />
            {/* Estimation simulator (real throughput + projection) */}
            <ThroughputSimulatorPanel />

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Database size={20} color="var(--primary-light)" />
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Dataset validé (export)</h3>
            </div>

            {/* Stats */}
            {data?.stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 20 }}>
                {[
                  { v: data.stats.total, l: "Total" },
                  { v: data.stats.byLang?.fr ?? 0, l: "FR" },
                  { v: data.stats.byLang?.ar ?? 0, l: "AR" },
                  { v: data.stats.byLang?.en ?? 0, l: "EN" },
                  { v: data.stats.withAudio, l: "Avec audio" },
                  { v: data.stats.avgQuality, l: "Qualité moy." },
                ].map((s, i) => (
                  <div key={i} style={{ ...card, textAlign: "center", padding: 12 }}>
                    <div style={metric}>{s.v}</div>
                    <div style={label}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}

            {data?.entries?.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Aucune traduction approuvée. Le dataset se remplit quand les validations aboutissent.
              </div>
            )}

            {/* Export button */}
            {data?.entries?.length > 0 && (
              <button onClick={() => {
                const json = JSON.stringify(data.entries, null, 2);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `hassaniya_dataset_${new Date().toISOString().slice(0,10)}.json`; a.click();
                URL.revokeObjectURL(url);
              }} className="btn-primary" style={{ marginBottom: 20, padding: "10px 20px", display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={14} /> Exporter JSON ({data.entries.length} entrées)
              </button>
            )}

            {/* Dataset table */}
            {data?.entries?.map((e: any, i: number) => (
              <div key={e.contribution_id} style={{ ...card, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    #{e.phrase_id} ·{e.source_lang?.toUpperCase()} ·{e.category}
                    {e.vote_count > 0 && <span style={{ color: "var(--accent)", marginLeft: 6 }}>🏆 {e.vote_count}/{e.phrase_total_votes} votes</span>}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>score: {e.quality_score} ·{e.contributor}</span>
                </div>
                <p dir={e.source_lang === "ar" ? "rtl" : "ltr"} style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 4 }}>{e.source_text}</p>
                <p dir="rtl" style={{ fontSize: "0.95rem", fontFamily: "'Cairo', sans-serif", lineHeight: 1.6 }}>{e.hassaniya_text}</p>
                {e.audio_url && <AuthAudio src={e.audio_url} style={{ marginTop: 6 }} />}
                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 4 }}>
                  texte: {e.avg_text_score}/5 ·audio: {e.avg_audio_score}/5 ·{e.validation_count} validations ·{e.audio_url ? "🎤 audio" : "pas d'audio"} ·{new Date(e.contributed_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : tab === "config" ? (
          /* ══ CONFIG ══ */
          <div>
            <h3 style={{ ...label, color: "var(--primary-light)", marginBottom: 16 }}>Configuration de la compétition</h3>
            {data?.config?.map((c: any) => (
              <div key={c.key} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{c.key}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Mis à jour: {new Date(c.updated_at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500 }}>{c.value}</span>
                  <button onClick={async () => {
                    const val = prompt(`Nouvelle valeur pour "${c.key}":`, c.value);
                    if (val !== null) {
                      const r = await adminPost("/api/m/config", { key: c.key, value: val });
                      if (r.success) loadTab();
                      else alert(r.error);
                    }
                  }} style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--primary-light)", cursor: "pointer" }}>
                    Modifier
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "security" ? (
          /* ══ SECURITY ══ */
          <SecurityPanel />
        ) : null}
      </div>
    </div>
  );
}
