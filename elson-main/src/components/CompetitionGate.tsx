"use client";

import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

interface Props {
  code: string | null;
  startsAt?: string | null;
}

/**
 * Shared empty-state for pages blocked by the competition gate.
 * Used on /contribute, /validate, /leaderboard when the API returns
 * COMPETITION_NOT_ACTIVE / NOT_ACTIVATED_YET / NOT_ACTIVATED / COMPETITION_ENDED.
 */
export function CompetitionGate({ code, startsAt }: Props) {
  const { t } = useI18n();
  const isEnded = code === "COMPETITION_ENDED";
  const isNotActivated = code === "NOT_ACTIVATED";

  return (
    <div className="fade-in" style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "rgba(217, 119, 6, 0.08)",
        color: "var(--warning)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 24px",
      }}>
        <Clock size={36} />
      </div>
      <h3 style={{ fontSize: "1.3rem", marginBottom: 10, fontWeight: 700 }}>
        {isEnded ? t("contribute.competitionEnded") : t("contribute.notActive")}
      </h3>
      {startsAt && !isEnded && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
          {t("contribute.startsAt").replace("{date}", new Date(startsAt).toLocaleString())}
        </p>
      )}
      {isNotActivated && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: 8 }}>
          {t("contribute.notActivated")}
        </p>
      )}
    </div>
  );
}

/**
 * Helper to detect if an API response code/error is a gate block.
 */
export function isGateCode(code: string | null | undefined): boolean {
  return code === "COMPETITION_NOT_ACTIVE"
    || code === "NOT_ACTIVATED_YET"
    || code === "NOT_ACTIVATED"
    || code === "COMPETITION_ENDED";
}
