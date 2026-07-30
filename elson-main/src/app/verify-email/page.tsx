"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, RefreshCw, CheckCircle, ShieldCheck } from "lucide-react";
import { isLoggedIn, tryRestoreSession, verifyEmail, resendVerification, getEmailStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.push("/login"); return; }
      }
      const { data } = await getEmailStatus();
      if (data?.emailVerified) { router.replace("/contribute"); return; }
      if (data?.email) setEmail(data.email);
    }
    init();
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && next.every(d => d)) {
      handleVerify(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      const next = text.split("");
      setDigits(next);
      inputRefs.current[5]?.focus();
      handleVerify(text);
    }
  };

  const handleVerify = async (code: string) => {
    setLoading(true);
    setError("");
    const { data, error: err } = await verifyEmail(code);
    if (err) {
      setError(err);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } else if (data?.success) {
      setSuccess(true);
      setTimeout(() => router.push("/contribute"), 2000);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    const { error: err } = await resendVerification();
    if (err) setError(err);
    else setCooldown(60); // 60s cooldown
    setResending(false);
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c)
    : "";

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-dark)", padding: 24 }}>
        <div className="glass-card fade-in" style={{ maxWidth: 440, width: "100%", padding: "48px 36px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0, 0, 0,0.1)", border: "2px solid rgba(0, 0, 0,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <CheckCircle size={32} style={{ color: "#10b981" }} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>{t("verify.success")}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            {t("verify.successMsg")}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 16 }}>{t("verify.redirect")}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-dark)", padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(0, 0, 0,0.08) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

      <div className="glass-card fade-in" style={{ maxWidth: 460, width: "100%", padding: "44px 36px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/elson-logo.svg" alt="Elson" style={{ height: 48, margin: "0 auto 20px", display: "block" }} />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
            {t("verify.title")}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            {t("verify.codeSent")}<br />
            <strong style={{ color: "var(--text-secondary)" }}>{maskedEmail}</strong>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: "0.85rem", marginBottom: 20, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {/* 6-digit input boxes */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              style={{
                width: 52, height: 60, textAlign: "center", fontSize: "1.6rem", fontWeight: 800,
                fontFamily: "monospace", borderRadius: 14, border: d ? "2px solid var(--primary)" : "2px solid var(--border)",
                background: d ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.02)", color: "var(--primary-light)",
                outline: "none", transition: "all 0.2s",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--primary)"; e.target.style.boxShadow = "0 0 0 3px var(--primary-glow)"; }}
              onBlur={e => { e.target.style.borderColor = d ? "var(--primary)" : "var(--border)"; e.target.style.boxShadow = "none"; }}
            />
          ))}
        </div>

        {/* Verify button */}
        <button
          className="btn-primary"
          style={{ width: "100%", padding: 16 }}
          disabled={loading || digits.some(d => !d)}
          onClick={() => handleVerify(digits.join(""))}
        >
          {loading ? t("verify.verifying") : t("verify.verifyBtn")}
        </button>

        {/* Resend */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            style={{
              background: "none", border: "none", cursor: cooldown > 0 ? "default" : "pointer",
              color: cooldown > 0 ? "var(--text-muted)" : "var(--primary-light)", fontSize: "0.9rem", fontWeight: 500,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <RefreshCw size={14} />
            {cooldown > 0 ? `${t("verify.resendIn")}${cooldown}s` : resending ? t("verify.resending") : t("verify.resend")}
          </button>
        </div>

        {/* Info box */}
        <div style={{
          marginTop: 28, padding: "14px 18px", borderRadius: 12, fontSize: "0.8rem", lineHeight: 1.6,
          background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.08)", color: "var(--text-muted)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--primary-light)" }} />
          <div>
            <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>{t("verify.required")}</strong><br />
            {t("verify.requiredMsg")}
          </div>
        </div>

        {/* Participate now (email verification is optional to participate) */}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <button onClick={() => router.push("/contribute")} className="btn-primary" style={{ padding: "12px 30px", fontSize: "0.9rem" }}>
            {t("verify.participateNow")}
          </button>
        </div>

        {/* Back */}
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.85rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> {t("verify.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
