"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, PenLine, Mic, CheckCircle, Star } from "lucide-react";
import { isLoggedIn, tryRestoreSession, completeOnboarding } from "@/lib/api";
import { useI18n } from "@/lib/i18n-context";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const { t } = useI18n();

  const STEPS = [
    {
      title: t("onboarding.step1Title"),
      items: [
        { text: t("onboarding.s1i1") },
        { text: t("onboarding.s1i2") },
        { text: t("onboarding.s1i3") },
      ],
      icon: PenLine,
      color: "#6366f1",
    },
    {
      title: t("onboarding.step2Title"),
      items: [
        { text: t("onboarding.s2i1") },
        { text: t("onboarding.s2i2") },
        { text: t("onboarding.s2i3") },
        { text: t("onboarding.s2i4") },
      ],
      icon: Mic,
      color: "#10b981",
    },
    {
      title: t("onboarding.step3Title"),
      items: [
        { text: t("onboarding.s3i1") },
        { text: t("onboarding.s3i2") },
        { text: t("onboarding.s3i3") },
        { text: t("onboarding.s3i4") },
      ],
      icon: CheckCircle,
      color: "#f59e0b",
    },
  ];

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) { router.push("/login"); return; }
      }
    }
    init();
  }, []);

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleComplete = async () => {
    setCompleting(true);
    await completeOnboarding();
    router.push("/contribute");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 500, width: "100%" }}>
        <img src="/elson-logo.svg" alt="Elson" style={{ height: 44, marginBottom: 24, display: "block" }} />

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? current.color : "var(--border)",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {/* Step counter */}
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {t("onboarding.step")} {step + 1} {t("onboarding.of")} {STEPS.length}
        </p>

        {/* Card */}
        <div className="glass-card" style={{ padding: "32px 28px", marginBottom: 24 }}>

          {/* Icon + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${current.color}15`, border: `1px solid ${current.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={22} style={{ color: current.color }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>{current.title}</h2>
            </div>
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {current.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ color: current.color, fontWeight: 700, fontSize: "0.85rem", minWidth: 20, marginTop: 1 }}>{i + 1}.</span>
                <div>
                  <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "var(--text-primary)" }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Points reminder on last step */}
        {isLast && (
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "var(--surface-1)", border: "1px solid var(--border)", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Star size={16} style={{ color: "#f59e0b" }} />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t("onboarding.pointsSummary")}</span>
            </div>
            <div style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <span>{t("onboarding.translationAudio")} <strong style={{ color: "var(--text-primary)" }}>+15 pts</strong></span>
              <span>{t("onboarding.validation")} <strong style={{ color: "var(--text-primary)" }}>+3 pts</strong></span>
              <span>{t("onboarding.approved")} <strong style={{ color: "var(--text-primary)" }}>+10 pts bonus</strong></span>
              <span>{t("onboarding.tagsMax")} <strong style={{ color: "var(--text-primary)" }}>+2 pts {t("onboarding.each")}</strong></span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 12 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, padding: 14, borderRadius: 12, cursor: "pointer",
                background: "var(--surface-1)", border: "1px solid var(--border)",
                color: "var(--text-muted)", fontSize: "0.95rem", fontWeight: 500,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <ChevronLeft size={18} /> {t("onboarding.previous")}
            </button>
          )}

          {!isLast ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="btn-primary"
              style={{ flex: 1, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {t("onboarding.next")} <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="btn-primary"
              style={{ flex: 1, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              {completing ? t("onboarding.loading") : t("onboarding.understood")}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
