"use client";

import { useEffect, useState } from "react";
import { Users, Copy, Check, Gift, Hourglass } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { getMyReferrals, collectReferral, MyReferrals } from "@/lib/api";

const ACTIVATION = 20; // first N approved contributions earn no commission

export function ReferralPanel() {
  const { t, rtl } = useI18n();
  const [data, setData] = useState<MyReferrals | null>(null);
  const [copied, setCopied] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);

  const load = async () => { const { data } = await getMyReferrals(); if (data) setData(data); };
  useEffect(() => { load(); }, []);

  if (!data || data.enabled === false) return null; // system off → hide entirely

  const link = typeof window !== "undefined" ? `${window.location.origin}/login?ref=${data.code}` : `/login?ref=${data.code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const collect = async () => {
    setCollecting(true);
    const { data: r } = await collectReferral();
    setCollecting(false);
    if (r && r.collected > 0) { setFlash(r.collected); setTimeout(() => setFlash(null), 2600); }
    load();
  };

  const capUsed = data.cap > 0 ? Math.min(100, Math.round((data.ambassadorPoints / data.cap) * 100)) : 0;

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 20, padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Users size={15} color="var(--accent-green)" />
        <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--accent-green)" }}>{t("referral.title")}</span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{t("referral.subtitle")}</div>

      {/* Share link */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, color: "var(--accent-green)" }}>{data.code}</span>
          <span style={{ opacity: 0.6 }}>{link}</span>
        </div>
        <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", borderRadius: 10, fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", background: copied ? "var(--accent-green-soft)" : "var(--accent-green)", color: copied ? "var(--accent-green)" : "var(--on-primary)", border: "none", whiteSpace: "nowrap" }}>
          {copied ? <><Check size={14} /> {t("referral.copied")}</> : <><Copy size={14} /> {t("referral.copy")}</>}
        </button>
      </div>

      {/* Ambassador points + cap bar */}
      <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            <Gift size={16} color="var(--accent-green)" /> {data.ambassadorPoints.toLocaleString()} <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)" }}>{t("referral.ambassadorPoints")}</span>
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t("referral.cap")} {data.cap.toLocaleString()} ({data.capPct}%)</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ width: `${capUsed}%`, height: "100%", background: capUsed >= 100 ? "var(--warning, #D97706)" : "var(--accent-green)", transition: "width .4s ease" }} />
        </div>
        <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{t("referral.capHint")}</div>
      </div>

      {/* Collect */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          onClick={collect}
          disabled={collecting || data.collectable <= 0}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px",
            borderRadius: 11, fontWeight: 800, fontSize: "0.85rem", cursor: data.collectable > 0 ? "pointer" : "default",
            background: data.collectable > 0 ? "var(--accent-green)" : "var(--surface-2)",
            color: data.collectable > 0 ? "var(--on-primary)" : "var(--text-muted)",
            border: data.collectable > 0 ? "none" : "1px solid var(--border)", opacity: collecting ? 0.6 : 1,
          }}
        >
          {flash != null
            ? <>✓ +{flash} {t("referral.ambassadorPoints")}</>
            : data.collectable > 0
              ? <><Gift size={15} /> {t("referral.collect")} {data.collectable.toLocaleString()}</>
              : data.capRemaining <= 0 && data.totalPending > 0
                ? t("referral.capReached")
                : t("referral.nothingToCollect")}
        </button>
      </div>

      {/* Referees */}
      <div style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>
        {t("referral.referees")} · {data.refereeCount}
      </div>
      {data.referees.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>{t("referral.noReferees")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {data.referees.map((r, i) => {
            const inActivation = r.approved < ACTIVATION;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-green-soft)", color: "var(--accent-green)", fontWeight: 800, fontSize: 13 }}>
                  {r.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.username}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{r.approved} {t("referral.approved")}</div>
                </div>
                <div style={{ textAlign: "end", flexShrink: 0 }}>
                  {inActivation ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.68rem", color: "var(--text-muted)" }}>
                      <Hourglass size={11} /> {r.approved}/{ACTIVATION}
                    </span>
                  ) : (
                    <>
                      {r.pending > 0 && <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--accent-green)" }}>+{r.pending}</div>}
                      <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{r.collected} {t("referral.collected")}</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
