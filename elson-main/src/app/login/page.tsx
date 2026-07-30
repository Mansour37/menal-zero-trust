"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, UserPlus, ArrowLeft, Lock, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { LanguageSwitcher } from "@/components/Navigation";
import { login, register, getRegistrationInfo, verifyWhatsapp, resendWhatsapp } from "@/lib/api";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [regOpen, setRegOpen] = useState(true);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [nni, setNni] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [sourceLang, setSourceLang] = useState("fr"); // Language preference for phrases
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [referralCode, setReferralCode] = useState("");
  // WhatsApp OTP verification step (shown right after signup)
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const router = useRouter();
  const { t, rtl } = useI18n();

  // Show a notice when redirected here after being signed out on another device.
  // Also capture a referral code from the ?ref= link → land straight on signup.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_revoked") {
      setNotice(t("login.sessionRevoked"));
    }
    const ref = params.get("ref");
    if (ref) { setReferralCode(ref.trim().toUpperCase()); setMode("signup"); }
  }, [t]);

  // Registration kill-switch: hide the signup form when admin has closed signups.
  useEffect(() => {
    getRegistrationInfo().then(({ open, inviteOnly: io }) => {
      setRegOpen(open);
      setInviteOnly(io);
      if (!open) setMode("login");
    });
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await login(nni, password);
    if (err) { setError(err); }
    else {
      // Sync UI language with user's preferred language
      if (data?.preferredLang && ["en", "fr", "ar"].includes(data.preferredLang)) {
        localStorage.setItem("dialect-locale", data.preferredLang);
      }
      // Email verification is a soft prompt now — never trap unverified users on the
      // verify page; send everyone into the app (a banner nudges them to verify).
      router.push("/contribute");
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);
    setError("");
    if (email.trim() && !email.trim().includes("@")) { setError(t("login.emailRequired")); setLoading(false); return; }
    if (password.length < 6) { setError(t("login.passwordTooShort")); setLoading(false); return; }
    if (whatsapp.trim().length < 6) { setError(t("login.whatsappRequired")); setLoading(false); return; }
    const { error: err } = await register({
      email: email.trim() || undefined,
      password,
      sourceLang,
      // WhatsApp is required — it's the verification channel (OTP).
      whatsapp: whatsapp.trim(),
      referralCode: referralCode.trim() || undefined,
    });
    if (err) setError(err);
    else {
      localStorage.setItem("dialect-locale", sourceLang);
      // Account created + a WhatsApp OTP was sent → show the verification step.
      setOtpStep(true);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await verifyWhatsapp(otpCode.trim());
    if (err || !data?.success) setError(err || t("login.otpInvalid"));
    else router.push("/contribute");
    setLoading(false);
  };

  const handleResendOtp = async () => {
    setError(""); setNotice("");
    const { data, error: err } = await resendWhatsapp();
    if (err) setError(err);
    else if (data?.success) setNotice(t("login.otpResent"));
  };

  const handleSubmit = () => { if (mode === "login") handleLogin(); else handleSignup(); };

  const loginDigits = nni.replace(/\D/g, "");
  const loginReady = (nni.trim().length >= 6 || loginDigits.length >= 8 || nni.includes("@")) && password.length >= 6;
  const signupReady = password.length >= 6 && whatsapp.trim().length >= 6 && (!email.trim() || email.trim().includes("@")) && !(inviteOnly && !referralCode);

  const labelStyle = {
    display: "block" as const, marginBottom: 8, fontSize: "0.75rem",
    fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase" as const, letterSpacing: "0.1em"
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-dark)", padding: 24, direction: rtl ? "rtl" : "ltr",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(16, 185, 129, 0.1) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

      {/* UI Language switcher — only here and landing */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100 }}>
        <LanguageSwitcher />
      </div>

      <div className="glass-card fade-in" style={{ maxWidth: 440, width: "100%", padding: "44px 36px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/elson-logo.svg" alt="Elson" style={{ height: 56, margin: "0 auto 24px", display: "block" }} />
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 8 }}>
            {otpStep ? t("login.verifyTitle") : mode === "login" ? t("login.title") : t("login.createAccount")}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {otpStep ? `${t("login.verifySubtitle")} ${whatsapp.trim()}` : mode === "login" ? t("login.loginSubtitle") : t("login.signupSubtitle")}
          </p>
        </div>

        {notice && !error && (
          <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: "0.85rem", marginBottom: 20, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", color: "var(--accent)" }}>
            {notice}
          </div>
        )}

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: "0.85rem", marginBottom: 20, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {otpStep && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>{t("login.otpCode")}</label>
              <input className="input" type="text" inputMode="numeric" maxLength={6}
                placeholder="••••••" value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && otpCode.length === 6 && handleVerifyOtp()}
                style={{ fontSize: "1.5rem", letterSpacing: "0.5em", textAlign: "center", fontWeight: 700 }} autoFocus />
            </div>
            <button className="btn-primary" style={{ width: "100%", padding: "16px" }}
              onClick={handleVerifyOtp} disabled={loading || otpCode.length !== 6}>
              {loading ? t("login.loading") : t("login.verifyBtn")}
            </button>
            <button onClick={handleResendOtp} disabled={loading}
              style={{ background: "none", border: "none", color: "var(--primary-light)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
              {t("login.otpResend")}
            </button>
          </div>
        )}

        {!otpStep && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "signup" && (
            <>
              {inviteOnly && !referralCode && (
                <div style={{ padding: "14px", borderRadius: 12, background: "rgba(99,102,241,0.08)", border: "1px solid var(--border-brand)", fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.6, textAlign: "center" }}>
                  🔒 Inscription <b>sur invitation uniquement</b>.<br />
                  Tu ne peux créer un compte qu'avec le <b>code d'invitation</b> d'un membre <b>déjà actif</b> sur Elson (qui a déjà contribué). Demande-lui son code, puis ouvre son lien d'invitation pour t'inscrire.
                </div>
              )}
              {referralCode && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", fontSize: "0.82rem", color: "#10b981", fontWeight: 600 }}>
                  🤝 {t("login.referredBy")} <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{referralCode}</span>
                </div>
              )}
              <div>
                <label style={labelStyle}>{t("login.email")}</label>
                <input className="input" type="email" placeholder="name@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>

              {/* ═══ SOURCE LANGUAGE SELECTION ═══ */}
              <div>
                <label style={labelStyle}>
                  <Globe size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  {t("login.sourceLangLabel")}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { code: "fr", label: "Français", desc: "Je lis en français" },
                    { code: "ar", label: "العربية", desc: "أقرأ بالعربية" },
                    { code: "en", label: "English", desc: "I read in English" },
                  ].map((l) => (
                    <button key={l.code} onClick={() => setSourceLang(l.code)} style={{
                      flex: 1, padding: "12px 8px", borderRadius: 12, cursor: "pointer",
                      textAlign: "center", transition: "all 0.25s",
                      background: sourceLang === l.code ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                      border: sourceLang === l.code ? "2px solid var(--primary)" : "1px solid var(--border)",
                      color: sourceLang === l.code ? "var(--primary-light)" : "var(--text-muted)",
                    }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: 2 }}>{l.label}</div>
                      <div style={{ fontSize: "0.6rem", opacity: 0.7 }}>{l.desc}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                  {t("login.sourceLangHelp")}
                </div>
              </div>
            </>
          )}

          {/* NNI or email — login only (signup uses the email field below) */}
          {mode === "login" && (
            <div>
              <label style={labelStyle}>{t("login.nniOrEmail")}</label>
              <input className="input" type="text"
                placeholder={t("login.nniLoginPlaceholder")}
                maxLength={255}
                value={nni}
                onChange={(e) => setNni(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={{ fontSize: "1rem", fontWeight: 600 }}
              />
            </div>
          )}

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={labelStyle}>{t("login.password")} *</label>
              {mode === "login" && (
                <Link href="/reset-password" style={{ fontSize: "0.7rem", color: "var(--primary-light)", textDecoration: "none" }}>
                  {t("login.forgotPassword")}
                </Link>
              )}
            </div>
            <input className="input" type="password" placeholder={mode === "signup" ? t("login.passwordPlaceholder") : t("login.password")} value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {mode === "signup" && (
            <>
              <div>
                <label style={labelStyle}>{t("login.whatsapp")} *</label>
                <input className="input" type="tel" placeholder={t("login.whatsappPlaceholder")} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{t("login.whatsappOtpHelp")}</div>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 12, fontSize: "0.78rem", lineHeight: 1.6, background: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.1)", color: "var(--text-muted)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Lock size={16} style={{ flexShrink: 0, marginTop: 2, color: "#10b981" }} />
                <div>
                  <strong style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>Privacy</strong><br />
                  {t("login.privacyNote")}
                </div>
              </div>
            </>
          )}

          <button className="btn-primary" style={{ width: "100%", marginTop: 4, padding: "16px" }}
            onClick={handleSubmit}
            disabled={loading || !(mode === "login" ? loginReady : signupReady)}>
            {loading ? t("login.loading") : mode === "login" ? (
              <><LogIn size={18} /> {t("login.signIn")}</>
            ) : (
              <><UserPlus size={18} /> {t("login.createMyAccount")}</>
            )}
          </button>
        </div>
        )}

        {!otpStep && (
        <div style={{ textAlign: "center", marginTop: 28, paddingTop: 28, borderTop: "1px solid var(--border)" }}>
          {regOpen ? (
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 }}
            >
              {mode === "login" ? t("login.noAccount") : t("login.haveAccount")}
              <span style={{ color: "var(--primary-light)", fontWeight: 600 }}>
                {mode === "login" ? t("login.signUp") : t("login.signInLink")}
              </span>
            </button>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: "0.88rem", fontWeight: 500 }}>{t("login.registrationClosed")}</div>
          )}
        </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/" style={{ color: "var(--text-muted)", fontSize: "0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> {t("login.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
