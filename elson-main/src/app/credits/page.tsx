"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav, TopBar } from "@/components/Navigation";
import { Plus, Trash2, Check, Loader2, Award, CheckCircle, EyeOff } from "lucide-react";
import { isLoggedIn, tryRestoreSession, logout, getMyCredits, saveMyCredits, adminGetAllCredits, getMyProfile } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";

type Row = { name: string; whatsapp: string; consent: "cite" | "anonymous" };

const card: React.CSSProperties = { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 14 };
const input: React.CSSProperties = { width: "100%", padding: "11px 13px", fontSize: "0.9rem", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", outline: "none" };

export default function CreditsPage() {
  const router = useRouter();
  const { t, rtl } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ name: "", whatsapp: "", consent: "cite" }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [all, setAll] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; cited: number; anonymous: number } | null>(null);

  useEffect(() => {
    (async () => {
      if (!isLoggedIn()) { const r = await tryRestoreSession(); if (!r) { router.push("/login"); return; } }
      setAuthed(true);
      const { data } = await getMyCredits();
      if (data?.credits?.length) setRows(data.credits.map((c) => ({ name: c.name, whatsapp: c.whatsapp || "", consent: c.consent })));
      getMyProfile().then(({ data: p }) => {
        if (p?.profile?.role === "admin") {
          setIsAdmin(true);
          adminGetAllCredits().then(({ data: a }) => { if (a) { setAll(a.credits || []); setStats({ total: a.total, cited: a.cited, anonymous: a.anonymous }); } });
        }
      }).catch(() => {});
    })();
  }, []);

  const upd = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addRow = () => setRows((rs) => [...rs, { name: "", whatsapp: "", consent: "cite" }]);
  const removeRow = (i: number) => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs);
  const save = async () => {
    setSaving(true);
    const payload = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), whatsapp: r.whatsapp.trim() || null, consent: r.consent }));
    const { error } = await saveMyCredits(payload);
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  if (!authed) return null;

  return (
    <div className={rtl ? "rtl" : ""} dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: 90 }}>
      <TopBar onLogout={() => { logout(); router.replace("/login"); }} />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Award size={22} color="var(--primary-light)" />
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("credits.title")}</h1>
        </div>
        <p style={{ fontSize: "0.86rem", color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.6 }}>{t("credits.intro")}</p>

        {/* rows */}
        {rows.map((r, i) => (
          <div key={i} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-muted)" }}>{i === 0 ? t("credits.you") : `${t("credits.person")} ${i + 1}`}</span>
              {rows.length > 1 && <button onClick={() => removeRow(i)} title={t("credits.remove")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}><Trash2 size={16} /></button>}
            </div>
            <input value={r.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder={t("credits.namePlaceholder")} style={{ ...input, marginBottom: 8 }} maxLength={120} />
            <input value={r.whatsapp} onChange={(e) => upd(i, "whatsapp", e.target.value)} placeholder={t("credits.whatsappPlaceholder")} style={{ ...input, marginBottom: 12 }} maxLength={30} dir="ltr" />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => upd(i, "consent", "cite")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 10, border: `1.5px solid ${r.consent === "cite" ? "var(--accent-green)" : "var(--border)"}`, background: r.consent === "cite" ? "var(--accent-green-soft)" : "transparent", color: r.consent === "cite" ? "var(--accent-green)" : "var(--text-secondary)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                <CheckCircle size={15} /> {t("credits.consentCite")}
              </button>
              <button onClick={() => upd(i, "consent", "anonymous")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 10, border: `1.5px solid ${r.consent === "anonymous" ? "var(--primary-light)" : "var(--border)"}`, background: r.consent === "anonymous" ? "var(--surface-3)" : "transparent", color: r.consent === "anonymous" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                <EyeOff size={15} /> {t("credits.consentAnon")}
              </button>
            </div>
          </div>
        ))}

        <button onClick={addRow} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1px dashed var(--border-hover)", background: "transparent", color: "var(--text-secondary)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", marginBottom: 16 }}>
          <Plus size={16} /> {t("credits.add")}
        </button>

        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16, background: "var(--surface-1)", padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}>
          ℹ️ {t("credits.consentNote")}
        </p>

        <button onClick={save} disabled={saving} className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: 14, fontSize: "0.95rem" }}>
          {saving ? <><Loader2 size={16} className="spin" /> …</> : saved ? <><Check size={16} /> {t("credits.saved")}</> : t("credits.save")}
        </button>

        {/* ADMIN: all submissions */}
        {isAdmin && (
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-light)", marginBottom: 10 }}>
              {t("credits.adminTitle")} {stats && `· ${stats.total} (${stats.cited} ✓ / ${stats.anonymous} ⊘)`}
            </div>
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {all.length === 0 && <div style={{ padding: 16, fontSize: "0.82rem", color: "var(--text-muted)" }}>—</div>}
              {all.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--separator)", fontSize: "0.82rem" }}>
                  <span style={{ flex: 1, fontWeight: 700, color: "var(--text-primary)" }}>{c.name}</span>
                  <span dir="ltr" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{c.whatsapp || "—"}</span>
                  <span style={{ fontSize: "0.66rem", fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: c.consent === "cite" ? "var(--accent-green-soft)" : "var(--surface-3)", color: c.consent === "cite" ? "var(--accent-green)" : "var(--text-muted)" }}>
                    {c.consent === "cite" ? t("credits.consentCite") : t("credits.consentAnon")}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", minWidth: 70, textAlign: rtl ? "left" : "right" }}>{c.owner_username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
