"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Target, Check, X, Trash2, User as UserIcon } from "lucide-react";
import {
  adminUsersList, adminPhraseSearch, adminPhraseFacets, adminAssignPhrases, adminAssignByFilter,
  adminListAssignments, adminUnassignPhrase, adminUnassignAll, adminOpenToAll,
  type AdminPhrase, type AdminAssignment,
} from "@/lib/api";

const ALL_TARGET = { id: "__all__", username: "tout le monde" };

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const label: React.CSSProperties = { fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 };
const inp: React.CSSProperties = { padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem", outline: "none" };
const LANGS = [{ v: "", l: "Toutes" }, { v: "fr", l: "FR" }, { v: "en", l: "EN" }, { v: "ar", l: "AR" }];
const toggleVal = (s: Set<string>, v: string) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; };
const chipStyle = (on: boolean): React.CSSProperties => ({
  ...inp, cursor: "pointer", padding: "5px 10px", fontSize: "0.75rem",
  border: `1px solid ${on ? "var(--accent-green)" : "var(--border)"}`,
  background: on ? "var(--accent-green-soft)" : "var(--bg-card)",
  color: on ? "var(--accent-green)" : "var(--text-secondary)", fontWeight: on ? 800 : 500,
});

export function PhraseAssignPanel() {
  // user picker
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [userFilter, setUserFilter] = useState("");
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);

  // phrase search
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("");
  const [origins, setOrigins] = useState<Set<string>>(new Set());
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<AdminPhrase[]>([]);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);
  const [fresh, setFresh] = useState(true); // n'afficher que les phrases jamais servies
  const [facets, setFacets] = useState<{ categories: { value: string; count: number }[]; origins: { value: string; count: number }[] }>({ categories: [], origins: [] });

  // assignments of the selected user
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);
  const [aStats, setAStats] = useState<{ total: number; done: number }>({ total: 0, done: 0 });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminUsersList().then(({ data }) => setUsers(data?.items ?? []));
    adminPhraseFacets().then(({ data }) => data && setFacets(data));
  }, []);

  const filteredUsers = useMemo(() => {
    const f = userFilter.trim().toLowerCase();
    return (f ? users.filter((u) => u.username.toLowerCase().includes(f)) : users).slice(0, 40);
  }, [users, userFilter]);

  const loadAssignments = (uid: string) => adminListAssignments(uid).then(({ data }) => {
    setAssignments(data?.items ?? []);
    setAStats({ total: data?.total ?? 0, done: data?.done ?? 0 });
  });

  const pickUser = (u: { id: string; username: string }) => {
    setUser(u); setMsg(null);
    if (u.id === "__all__") { setAssignments([]); setAStats({ total: 0, done: 0 }); }
    else loadAssignments(u.id);
  };
  const isAll = user?.id === "__all__";

  const search = async () => {
    setSearching(true);
    const { data } = await adminPhraseSearch({ q, lang, origins: [...origins], categories: [...cats], limit: 200, fresh });
    setResults(data?.items ?? []); setTotal(data?.total ?? 0); setSel(new Set()); setSearching(false);
  };

  const assignAll = async () => {
    if (!user || total === 0) return;
    if (isAll) {
      if (!window.confirm(`Ouvrir TOUTES les ${total} phrases correspondantes à TOUT LE MONDE ?`)) return;
      setBusy(true); setMsg(null);
      const { data, error } = await adminOpenToAll({ q, lang, origins: [...origins], categories: [...cats], fresh, max: 1000000 });
      setBusy(false);
      if (error) { setMsg("Erreur : " + error); return; }
      setMsg(`🌍 ${data?.opened ?? 0} phrase(s) ouverte(s) à tout le monde`);
      return;
    }
    if (!window.confirm(`Assigner TOUTES les ${total} phrases correspondantes à @${user.username} ?`)) return;
    setBusy(true); setMsg(null);
    const { data, error } = await adminAssignByFilter(user.id, { q, lang, origins: [...origins], categories: [...cats], max: 1000000, fresh });
    setBusy(false);
    if (error) { setMsg("Erreur : " + error); return; }
    setMsg(`✅ ${data?.assigned ?? 0} phrase(s) assignée(s) à @${user.username} (par filtre)`);
    loadAssignments(user.id);
  };

  const toggle = (id: number) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShown = results.length > 0 && results.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allShown ? new Set() : new Set(results.map((r) => r.id)));

  const assign = async () => {
    if (!user || sel.size === 0) return;
    setBusy(true); setMsg(null);
    if (isAll) {
      const { data, error } = await adminOpenToAll({ phraseIds: [...sel] });
      setBusy(false);
      if (error) { setMsg("Erreur : " + error); return; }
      setMsg(`🌍 ${data?.opened ?? 0} phrase(s) ouverte(s) à tout le monde`);
      setSel(new Set());
      return;
    }
    const { data, error } = await adminAssignPhrases(user.id, [...sel]);
    setBusy(false);
    if (error) { setMsg("Erreur : " + error); return; }
    setMsg(`✅ ${data?.assigned ?? 0} phrase(s) assignée(s) à @${user.username}` + ((data && data.assigned < data.requested) ? ` (${data.requested - data.assigned} ignorées : déjà assignées ou faites)` : ""));
    setSel(new Set());
    loadAssignments(user.id);
  };

  const remove = async (id: number) => {
    await adminUnassignPhrase(id);
    if (user) loadAssignments(user.id);
  };

  const unassignAll = async () => {
    if (!user) return;
    if (!window.confirm(`Retirer TOUTES les ${aStats.total} assignations de @${user.username} ?`)) return;
    await adminUnassignAll(user.id);
    loadAssignments(user.id);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Target size={20} color="var(--accent-green)" />
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Cibler un utilisateur avec des phrases</h2>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 16 }}>
        Sélectionne des phrases et assigne-les à un utilisateur précis. Elles lui seront servies <b>en priorité</b> dans « Contribuer » (toutes langues confondues).
      </p>

      {/* STEP 1 — user */}
      <div style={card}>
        <div style={label}>1 · Utilisateur cible</div>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--accent-green-soft)", color: "var(--accent-green)", fontWeight: 700, fontSize: "0.85rem" }}>
              <UserIcon size={14} /> @{user.username}
            </span>
            <button onClick={() => { setUser(null); setAssignments([]); }} style={{ ...inp, cursor: "pointer", padding: "6px 10px" }}>Changer</button>
            <span style={{ marginInlineStart: "auto", fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {aStats.total > 0 && <>Assignées : <b style={{ color: "var(--text-primary)" }}>{aStats.done}/{aStats.total}</b> faites</>}
            </span>
          </div>
        ) : (
          <>
            <input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="Rechercher un pseudo…" style={{ ...inp, width: "100%", marginBottom: 8 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              <button onClick={() => pickUser(ALL_TARGET)} style={{ ...inp, cursor: "pointer", padding: "6px 11px", fontSize: "0.8rem", background: "var(--accent-green-soft)", color: "var(--accent-green)", border: "1px solid var(--accent-green)", fontWeight: 800 }}>🌍 Tout le monde</button>
              {filteredUsers.map((u) => (
                <button key={u.id} onClick={() => pickUser(u)} style={{ ...inp, cursor: "pointer", padding: "6px 11px", fontSize: "0.8rem" }}>@{u.username}</button>
              ))}
              {filteredUsers.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Aucun utilisateur</span>}
            </div>
          </>
        )}
      </div>

      {/* STEP 2 — search + select phrases */}
      <div style={card}>
        <div style={label}>2 · Choisir les phrases</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Texte contient… (optionnel)" style={{ ...inp, flex: 2, minWidth: 160 }} />
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
            {LANGS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
          </select>
          <button onClick={search} disabled={searching} style={{ ...inp, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, background: "var(--gradient-brand)", color: "#fff", border: "none", fontWeight: 700 }}>
            <Search size={15} /> {searching ? "…" : "Chercher"}
          </button>
        </div>

        {/* multi-select : datasets */}
        <div style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Datasets {origins.size > 0 && `· ${origins.size} sélectionné(s)`}</span>
          {origins.size > 0 && <button onClick={() => setOrigins(new Set())} style={{ ...inp, cursor: "pointer", padding: "1px 7px", fontSize: "0.6rem" }}>vider</button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, maxHeight: 96, overflowY: "auto" }}>
          {facets.origins.map((o) => (
            <button key={o.value} onClick={() => setOrigins(toggleVal(origins, o.value))} style={chipStyle(origins.has(o.value))}>
              {o.value} <span style={{ opacity: 0.6 }}>({o.count})</span>
            </button>
          ))}
        </div>

        {/* multi-select : catégories */}
        <div style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
          <span>Catégories {cats.size > 0 && `· ${cats.size} sélectionnée(s)`}</span>
          {cats.size > 0 && <button onClick={() => setCats(new Set())} style={{ ...inp, cursor: "pointer", padding: "1px 7px", fontSize: "0.6rem" }}>vider</button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, maxHeight: 96, overflowY: "auto" }}>
          {facets.categories.map((c) => (
            <button key={c.value} onClick={() => setCats(toggleVal(cats, c.value))} style={chipStyle(cats.has(c.value))}>
              {c.value} <span style={{ opacity: 0.6 }}>({c.count})</span>
            </button>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} />
          Masquer les phrases déjà servies (n'afficher que les fraîches, jamais traduites)
        </label>

        {results.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={toggleAll} style={{ ...inp, cursor: "pointer", padding: "5px 10px", fontSize: "0.78rem" }}>
                {allShown ? "Tout déselectionner" : "Tout sélectionner"}
              </button>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <b style={{ color: "var(--accent-green)" }}>{sel.size}</b> sélectionnée(s) · {results.length} affichées{total > results.length ? ` / ${total} correspondantes` : ""}
              </span>
              {user && total > results.length && (
                <button onClick={assignAll} disabled={busy} style={{ marginInlineStart: "auto", ...inp, cursor: "pointer", padding: "6px 12px", fontSize: "0.78rem", fontWeight: 800, background: "var(--accent-green-soft)", color: "var(--accent-green)", border: "1px solid var(--accent-green)" }}>
                  {isAll ? `Ouvrir les ${total} → 🌍 tous` : `Assigner les ${total} → @${user.username}`}
                </button>
              )}
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {results.map((p) => {
                const on = sel.has(p.id);
                return (
                  <div key={p.id} onClick={() => toggle(p.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${on ? "var(--accent-green)" : "var(--border)"}`,
                    background: on ? "var(--accent-green-soft)" : "var(--bg-card)",
                  }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "grid", placeItems: "center", border: `1px solid ${on ? "var(--accent-green)" : "var(--border)"}`, background: on ? "var(--accent-green)" : "transparent", color: "#fff" }}>
                      {on && <Check size={13} />}
                    </span>
                    <span style={{ flex: 1, fontSize: "0.85rem", color: "var(--text-primary)" }} dir={p.source_lang === "ar" ? "rtl" : "ltr"}>{p.source_text}</span>
                    <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", flexShrink: 0 }}>{p.source_lang} · {p.category}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* assign action */}
      <button onClick={assign} disabled={!user || sel.size === 0 || busy} style={{
        width: "100%", padding: "13px", borderRadius: 12, border: "none", fontWeight: 800, fontSize: "0.92rem",
        cursor: (!user || sel.size === 0 || busy) ? "not-allowed" : "pointer",
        background: (!user || sel.size === 0) ? "var(--surface-2)" : "var(--gradient-brand)",
        color: (!user || sel.size === 0) ? "var(--text-muted)" : "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Target size={16} /> {busy ? "…" : !user ? "Choisis une cible d'abord" : isAll ? `Ouvrir ${sel.size} phrase(s) à tout le monde` : `Assigner ${sel.size} phrase(s) à @${user.username}`}
      </button>
      {msg && <div style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--text-primary)", textAlign: "center" }}>{msg}</div>}

      {/* STEP 3 — current assignments */}
      {user && !isAll && (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ ...label, display: "flex", alignItems: "center", gap: 10 }}>
            <span>3 · Phrases assignées à @{user.username} ({aStats.done}/{aStats.total} faites)</span>
            {aStats.total > 0 && (
              <button onClick={unassignAll} style={{ ...inp, cursor: "pointer", padding: "3px 10px", fontSize: "0.62rem", marginInlineStart: "auto", color: "var(--danger)", borderColor: "var(--danger)" }}>Tout retirer</button>
            )}
          </div>
          {assignments.length === 0 ? (
            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Aucune phrase assignée.</span>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {assignments.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                  <span style={{ fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: 6, flexShrink: 0,
                    background: a.done ? "var(--accent-green-soft)" : "var(--surface-2)", color: a.done ? "var(--accent-green)" : "var(--text-muted)" }}>
                    {a.done ? "FAIT" : "EN ATTENTE"}
                  </span>
                  <span style={{ flex: 1, fontSize: "0.83rem", color: "var(--text-secondary)" }} dir={a.source_lang === "ar" ? "rtl" : "ltr"}>{a.source_text}</span>
                  <button onClick={() => remove(a.id)} title="Retirer" style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
