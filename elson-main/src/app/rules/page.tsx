"use client";

import Link from "next/link";
import { BottomNav, TopBar } from "@/components/Navigation";
import { useRouter } from "next/navigation";
import {
  Star, Mic, CheckCircle, Shield, Zap,
  Trophy, ArrowLeft, Users, BookOpen, Type, Tag
} from "lucide-react";
import { HASSANIYA_LETTERS } from "@/lib/hassaniya";
import { useI18n } from "@/lib/i18n-context";
import { logout } from "@/lib/api";

export default function RulesPage() {
  const router = useRouter();
  const { t, rtl } = useI18n();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className={rtl ? "rtl" : ""} dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "var(--bg-dark)", paddingBottom: 100 }}>
      <TopBar onLogout={handleLogout} />
      <BottomNav />

      <div className="page-container" style={{ maxWidth: 600, margin: "0 auto", padding: "16px 20px" }}>
        <Link href="/contribute" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: "0.9rem", fontWeight: 500, marginBottom: 20, textDecoration: "none" }}>
          <ArrowLeft size={16} /> {t("rules.back")}
        </Link>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <BookOpen size={24} color="var(--primary)" /> {t("rules.title")}
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 32 }}>{t("rules.subtitle")}</p>

        <Section icon={<Mic size={20} />} title={t("rules.contributing")} color="var(--primary)">
          <Rule label={t("rules.translateAndRecord")} points={15} />
          <Note>{t("rules.audioNote")}</Note>
        </Section>

        <Section icon={<Shield size={20} />} title={t("rules.peerReview")} color="#8b5cf6">
          <Rule label={t("rules.validateOther")} points={3} />
          <Rule label={t("rules.getApproved")} points={10} />
          <Note>{t("rules.peerNote")}</Note>
        </Section>

        <Section icon={<Zap size={20} />} title={t("rules.streaks")} color="#f59e0b">
          <Rule label={t("rules.dailyStreak")} points={5} />
          <Rule label={t("rules.milestone10")} points={50} />
          <Rule label={t("rules.milestone50")} points={200} />
          <Rule label={t("rules.milestone100")} points={500} />
        </Section>

        <Section icon={<Tag size={20} />} title={t("rules.tags")} color="#059669">
          <Rule label={t("rules.addTag")} points={2} />
          <Note>{t("rules.tagNote")}</Note>
        </Section>

        <Section icon={<Trophy size={20} />} title={t("rules.levels")} color="#10b981">
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { name: "Beginner", pts: "0+", nameAr: "مبتدئ" },
              { name: "Contributor", pts: "100+", nameAr: "مساهم" },
              { name: "Expert", pts: "500+", nameAr: "خبير" },
              { name: "Champion", pts: "2,000+", nameAr: "بطل" },
              { name: "Legend", pts: "10,000+", nameAr: "أسطورة" },
            ].map((l) => (
              <div key={l.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "var(--surface-1)", borderRadius: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{l.name}</span>
                  <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: "0.85rem" }}>{l.nameAr}</span>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.9rem" }}>{l.pts} {t("common.pts")}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<Type size={20} />} title={t("rules.letters")} color="#06b6d4">
          <Note>{t("rules.lettersNote")}</Note>
          <div style={{ display: "grid", gap: 2, marginTop: 12 }}>
            {HASSANIYA_LETTERS.hassaniya.map((l) => (
              <div key={l.letter} style={{ display: "grid", gridTemplateColumns: "56px 1fr", alignItems: "center", padding: "12px 0", borderBottom: "0.5px solid var(--separator)" }}>
                <span style={{ fontSize: "2rem", fontFamily: "'Cairo', sans-serif", textAlign: "center", color: "var(--primary)" }}>{l.letter}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <strong style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>{l.name}</strong>
                    <span style={{ color: "var(--accent)", fontSize: "0.8rem", background: "rgba(217, 119, 6,0.1)", padding: "2px 8px", borderRadius: 6 }}>/{l.sound}/</span>
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: 0, lineHeight: 1.5 }}>{l.hint}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", margin: "2px 0 0", fontFamily: "'Cairo', sans-serif" }} dir="rtl">{l.example}</p>
                </div>
              </div>
            ))}
          </div>
          <Note><strong>{t("rules.lettersImportant")}</strong></Note>
        </Section>

        <div style={{ marginTop: 32, padding: 24, borderRadius: 16, background: "linear-gradient(135deg, rgba(0, 0, 0,0.08), rgba(139,92,246,0.08))", border: "1px solid rgba(0, 0, 0,0.15)", textAlign: "center" }}>
          <Users size={28} color="var(--primary)" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>{t("rules.whyTitle")}</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>{t("rules.whyText")}</p>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, color }}>{icon} {title}</h2>
      <div style={{ padding: "16px 20px", background: "var(--surface-1)", borderRadius: 14, border: "1px solid var(--border-light)" }}>{children}</div>
    </div>
  );
}

function Rule({ label, points }: { label: string; points: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid var(--separator)" }}>
      <span style={{ color: "var(--text-primary)", fontSize: "0.9rem" }}>{label}</span>
      <span style={{ color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 4 }}>+{points} <Star size={12} fill="currentColor" /></span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: 12, padding: "12px", background: "rgba(0,0,0,0.15)", borderRadius: 10 }}>{children}</p>
  );
}
