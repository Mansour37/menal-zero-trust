"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, KeyRound, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { forgotPasswordWhatsapp, resetPasswordWhatsapp } from "@/lib/api";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [step, setStep] = useState<"email" | "code">("email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSendCode = async () => {
    if (!identifier.trim()) return;
    setLoading(true); setError("");
    const { error: err } = await forgotPasswordWhatsapp(identifier.trim());
    if (err) setError(err);
    else setStep("code");
    setLoading(false);
  };

  const handleReset = async () => {
    if (!code.trim() || !newPassword || newPassword.length < 6) {
      setError(t("reset.passwordMin")); return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("reset.mismatch")); return;
    }
    setLoading(true); setError("");
    const { error: err } = await resetPasswordWhatsapp(identifier.trim(), code.trim(), newPassword);
    if (err) setError(err);
    else setSuccess(true);
    setLoading(false);
  };

  const labelStyle: React.CSSProperties = { fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 6, display: "block" };

  if (success) {
    return (
      <div className="noise-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(22, 163, 74,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle size={32} color="var(--success)" />
          </div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>{t("reset.success")}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 24, lineHeight: 1.6 }}>{t("reset.successMsg")}</p>
          <Link href="/login" className="btn-primary" style={{ padding: "14px 32px", display: "inline-flex" }}>
            {t("reset.backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="noise-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 24, textDecoration: "none" }}>
          <ArrowLeft size={16} /> {t("reset.backToLogin")}
        </Link>

        <img src="/elson-logo.svg" alt="Elson" style={{ height: 48, marginBottom: 24 }} />
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>{t("reset.title")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 28, lineHeight: 1.6 }}>
          {step === "email" ? t("reset.enterWhatsapp") : t("reset.enterCode")}
        </p>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "var(--danger)", fontSize: "0.85rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {step === "email" ? (
          <div>
            <label style={labelStyle}>{t("reset.whatsappLabel")}</label>
            <input className="input" type="tel" placeholder={t("login.whatsappPlaceholder")}
              value={identifier} onChange={e => setIdentifier(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendCode()}
              style={{ marginBottom: 16 }}
            />
            <button className="btn-primary" onClick={handleSendCode} disabled={loading || !identifier.trim()}
              style={{ width: "100%", padding: 16 }}>
              {loading ? <Loader2 size={18} className="spin" /> : <><MessageCircle size={16} /> {t("reset.sendCode")}</>}
            </button>
          </div>
        ) : (
          <div>
            <label style={labelStyle}>{t("reset.codeLabel")}</label>
            <input className="input" type="text" placeholder="123456" maxLength={6}
              value={code} onChange={e => setCode(e.target.value)}
              style={{ marginBottom: 12, textAlign: "center", fontSize: "1.2rem", letterSpacing: "0.3em" }}
            />

            <label style={labelStyle}>{t("reset.newPassword")}</label>
            <input className="input" type="password" placeholder={t("reset.newPasswordPlaceholder")}
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            <label style={labelStyle}>{t("reset.confirmPassword")}</label>
            <input className="input" type="password" placeholder={t("reset.confirmPasswordPlaceholder")}
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReset()}
              style={{ marginBottom: 16 }}
            />

            <button className="btn-primary" onClick={handleReset} disabled={loading || !code.trim() || !newPassword}
              style={{ width: "100%", padding: 16 }}>
              {loading ? <Loader2 size={18} className="spin" /> : <><KeyRound size={16} /> {t("reset.resetBtn")}</>}
            </button>

            <button onClick={handleSendCode} disabled={loading}
              style={{ width: "100%", marginTop: 10, padding: 12, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem" }}>
              {t("reset.resend")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
