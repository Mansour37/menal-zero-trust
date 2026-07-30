"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, HelpCircle, ChevronDown, MessageCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/Navigation";
import { useI18n } from "@/lib/i18n-context";

// Order of FAQ entries. Each key maps to faq.<key>.q and faq.<key>.a in i18n.
const FAQ_ITEMS = ["duration", "joinAnytime", "howToWin", "latinScript", "communication", "contact", "sharedAccount", "report"];

const SUPPORT_WHATSAPP = "13138047312";

export default function FaqPage() {
  const { t, rtl } = useI18n();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={`noise-bg grid-bg ${rtl ? "rtl" : ""}`} dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: 60, position: "relative", overflow: "hidden" }}>
      <div className="glow-orb" style={{ width: 500, height: 400, background: "rgba(16, 185, 129, 0.06)", top: "-12%", left: "50%", transform: "translateX(-50%)" }} />

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "12px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(3, 15, 10, 0.7)", backdropFilter: "blur(24px) saturate(140%)", borderBottom: "1px solid var(--border)" }}>
        <Link href="/"><img src="/elson-logo.svg" alt="Elson" style={{ height: 46 }} /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitcher />
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 14, textDecoration: "none" }}>
            {rtl ? <ArrowRight size={14} /> : <ArrowLeft size={14} />} {t("faq.home")}
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "110px 20px 40px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 100, background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.12)", fontSize: "0.8rem", fontWeight: 600, color: "var(--primary-light)", marginBottom: 20 }}>
          <HelpCircle size={14} /> FAQ
        </div>
        <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 2.4rem)", fontWeight: 800, letterSpacing: rtl ? "normal" : "-0.03em", marginBottom: 10 }}>{t("faq.title")}</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.7, marginBottom: 36 }}>{t("faq.subtitle")}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQ_ITEMS.map((key, i) => {
            const isOpen = open === i;
            return (
              <div key={key} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: rtl ? "right" : "left", color: "var(--text-primary)", fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 }}
                >
                  <span>{t(`faq.${key}.q`)}</span>
                  <ChevronDown size={18} style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none", color: "var(--primary-light)" }} />
                </button>
                {isOpen && (
                  <div className="fade-in" style={{ padding: "0 20px 20px", color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.75, whiteSpace: "pre-line" }}>
                    {t(`faq.${key}.a`)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "18px 24px", borderRadius: 16, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "var(--primary-light)", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none" }}>
          <MessageCircle size={18} /> {t("faq.stillNeedHelp")} +1&nbsp;313&nbsp;804&nbsp;7312
        </a>
      </main>
    </div>
  );
}
