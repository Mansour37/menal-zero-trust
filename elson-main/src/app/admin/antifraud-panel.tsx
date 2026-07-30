"use client";

import { useEffect, useState } from "react";
import { Shield, AlertTriangle, Users, MapPin, Smartphone, Globe, Activity, Search, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SignupForensic {
  id: string;
  username: string;
  email: string;
  nni: string | null;
  whatsapp: string | null;
  role: string;
  created_at: string;
  device_fingerprint: string | null;
  signup_ip: string | null;
  signup_geo: any;
  signup_ua: string | null;
  fraud_score: number;
  fraud_flags: string[];
  same_fp_count: number;
  same_ip_count: number;
}

interface SecurityData {
  stats: { high_score_count: number; any_score_count: number; no_fingerprint_count: number; total_users: number };
  suspectSignups: SignupForensic[];
  fpClusters: { device_fingerprint: string; user_count: number; members: { id: string; username: string; created_at: string }[] }[];
  ipClusters: { signup_ip: string; user_count: number; members: { id: string; username: string; created_at: string; fraud_score: number }[] }[];
  rejected: { details: any; ip_address: string; created_at: string }[];
}

const card: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 10 };
const label: React.CSSProperties = { fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 4 };

function scoreColor(score: number) {
  if (score >= 80) return "var(--danger)";
  if (score >= 50) return "#D97706";
  if (score >= 30) return "#9CA3AF";
  return "var(--text-muted)";
}

export function AntiFraudPanel() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: d } = await apiFetch<SecurityData>("/api/m/x/security");
    setData(d);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Activity size={24} className="spin" /></div>;
  if (!data) return <div>Erreur chargement</div>;

  const filtered = data.suspectSignups.filter(s => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return s.username.toLowerCase().includes(f)
      || s.email?.toLowerCase().includes(f)
      || s.signup_ip?.includes(f)
      || s.fraud_flags?.some(fl => fl.includes(f));
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Shield size={20} color="var(--primary-light)" />
        <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Sécurité & Anti-fraude</h3>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--danger)" }}>{data.stats.high_score_count}</div>
          <div style={label}>Fraud Score &gt; 50</div>
        </div>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#D97706" }}>{data.stats.any_score_count}</div>
          <div style={label}>Score &gt; 0</div>
        </div>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{data.fpClusters.length}</div>
          <div style={label}>Fingerprint clusters</div>
        </div>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{data.ipClusters.length}</div>
          <div style={label}>IP clusters</div>
        </div>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{data.rejected.length}</div>
          <div style={label}>Rejected (7j)</div>
        </div>
      </div>

      {/* Search filter */}
      <div style={{ marginBottom: 12, position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: 14, color: "var(--text-muted)" }} />
        <input className="input" placeholder="Filtrer (username, email, IP, flag)…"
          value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ width: "100%", paddingLeft: 34, fontSize: "0.85rem" }} />
      </div>

      {/* Suspect signups list */}
      <h4 style={{ ...label, color: "var(--primary)", marginTop: 16, marginBottom: 8 }}>
        🚨 Inscriptions suspectes ({filtered.length})
      </h4>
      {filtered.map(s => (
        <div key={s.id} style={{ ...card, padding: 14, borderColor: s.fraud_score >= 50 ? "rgba(220, 38, 38, 0.3)" : "var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>{s.username}</span>
              <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {new Date(s.created_at).toLocaleString()}
              </span>
            </div>
            <span style={{ fontWeight: 800, fontSize: "0.9rem", color: scoreColor(s.fraud_score) }}>
              {s.fraud_score}/100
            </span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 6 }}>
            {s.email} · NNI {s.nni} · {s.whatsapp}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {s.fraud_flags?.map(f => (
              <span key={f} style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 8, background: "rgba(220, 38, 38, 0.08)", color: "var(--danger)", fontWeight: 600 }}>
                {f}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {s.signup_ip && <span><Globe size={11} style={{ display: "inline" }} /> {s.signup_ip}</span>}
            {s.signup_geo?.country && <span><MapPin size={11} style={{ display: "inline" }} /> {s.signup_geo.city}, {s.signup_geo.country} ({s.signup_geo.isp})</span>}
            {s.signup_geo?.proxy && <span style={{ color: "var(--warning)", fontWeight: 700 }}>⚠ PROXY</span>}
            {s.signup_geo?.hosting && <span style={{ color: "var(--warning)", fontWeight: 700 }}>⚠ HOSTING</span>}
            {s.signup_geo?.mobile && <span><Smartphone size={11} style={{ display: "inline" }} /> Mobile network</span>}
            {s.device_fingerprint && <span title={s.device_fingerprint}>FP: {s.device_fingerprint.slice(0, 8)}…</span>}
            {s.same_fp_count > 0 && <span style={{ color: "var(--danger)", fontWeight: 700 }}>⚠ {s.same_fp_count} autres comptes même FP</span>}
            {s.same_ip_count > 1 && <span style={{ color: "var(--warning)", fontWeight: 700 }}>⚠ {s.same_ip_count} autres comptes même IP</span>}
          </div>
          {s.signup_ua && (
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace" }}>
              {s.signup_ua.slice(0, 120)}
            </div>
          )}
        </div>
      ))}

      {/* Fingerprint clusters */}
      <h4 style={{ ...label, color: "var(--primary)", marginTop: 24, marginBottom: 8 }}>
        🧬 Clusters par fingerprint ({data.fpClusters.length})
      </h4>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 12 }}>
        Plusieurs comptes utilisant le même device (probable multi-account fraud).
      </div>
      {data.fpClusters.map(c => (
        <div key={c.device_fingerprint} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{c.device_fingerprint?.slice(0, 24)}…</span>
            <span style={{ fontWeight: 700, color: "var(--danger)" }}>{c.user_count} comptes</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {c.members?.map(m => (
              <span key={m.id} style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 8, background: "rgba(0, 0, 0, 0.06)" }}>
                {m.username}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* IP clusters */}
      <h4 style={{ ...label, color: "var(--primary)", marginTop: 24, marginBottom: 8 }}>
        🌐 Clusters par IP ({data.ipClusters.length})
      </h4>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 12 }}>
        Plusieurs inscriptions depuis la même IP — peut être normal (famille/cybercafé) ou suspect.
      </div>
      {data.ipClusters.map(c => (
        <div key={c.signup_ip} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{c.signup_ip}</span>
            <span style={{ fontWeight: 700 }}>{c.user_count} comptes</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {c.members?.map(m => (
              <span key={m.id} style={{ fontSize: "0.78rem", padding: "4px 10px", borderRadius: 8, background: m.fraud_score > 50 ? "rgba(220, 38, 38, 0.08)" : "rgba(0, 0, 0, 0.06)", color: m.fraud_score > 50 ? "var(--danger)" : "inherit" }}>
                {m.username} {m.fraud_score > 0 && `(${m.fraud_score})`}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Rejected attempts */}
      {data.rejected.length > 0 && (
        <>
          <h4 style={{ ...label, color: "var(--primary)", marginTop: 24, marginBottom: 8 }}>
            <XCircle size={11} style={{ display: "inline" }} /> Inscriptions rejetées (7 derniers jours)
          </h4>
          {data.rejected.map((r, i) => (
            <div key={i} style={{ ...card, padding: 10 }}>
              <div style={{ fontSize: "0.75rem" }}>
                <strong>{r.details?.username}</strong> · {r.details?.email} · NNI {r.details?.nni} · score {r.details?.score}/100
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 4 }}>
                {new Date(r.created_at).toLocaleString()} · IP {r.ip_address} · flags: {r.details?.flags?.join(", ")}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
