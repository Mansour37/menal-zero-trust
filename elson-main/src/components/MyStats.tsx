"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Trophy, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { getMyProfile } from "@/lib/api";

type Stats = { points: number; rank: number | null; quality: number; hasContribs: boolean };

// Pages dispatch this after a contribution/evaluation so the bar refreshes
// instantly instead of waiting for the next poll tick.
export const STATS_REFRESH_EVENT = "elson:stats-refresh";
export function refreshMyStats() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STATS_REFRESH_EVENT));
}

/**
 * Real-time personal score strip shown on Contribute + Evaluate.
 * Three cards — points, rank, quality % — so the user always sees their note
 * without opening the leaderboard. Polls every 20s, refetches on window focus,
 * and updates immediately when a page fires STATS_REFRESH_EVENT. A value that
 * just improved flashes green.
 */
export function MyStats() {
  const { t, rtl } = useI18n();
  const [s, setS] = useState<Stats | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null); // which card's explanation is open
  const prev = useRef<Stats | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;

    const pop = (k: string) => {
      setFlash(k);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1000);
    };

    const load = async () => {
      const { data } = await getMyProfile();
      if (stopped || !data?.profile) return;
      const next: Stats = {
        points: data.profile.points ?? 0,
        rank: data.rank ?? null,
        quality: Math.round((data.qualityRatio ?? 0) * 100),
        hasContribs: (data.profile.total_contributions ?? 0) > 0,
      };
      const p = prev.current;
      if (p) {
        if (next.points > p.points) pop("points");
        if (next.rank != null && p.rank != null && next.rank < p.rank) pop("rank"); // lower rank = better
        if (next.quality > p.quality) pop("quality");
      }
      prev.current = next;
      setS(next);
    };

    load();
    const id = setInterval(load, 20_000);
    window.addEventListener(STATS_REFRESH_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      stopped = true;
      clearInterval(id);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      window.removeEventListener(STATS_REFRESH_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const cards = [
    {
      key: "points",
      icon: <Star size={16} fill="currentColor" strokeWidth={0} />,
      iconBg: "var(--accent-green)",
      iconColor: "var(--on-primary)",
      value: s ? s.points.toLocaleString() : "—",
      label: t("mystats.points"),
      tip: t("mystats.tipPoints"),
    },
    {
      key: "rank",
      icon: <Trophy size={16} strokeWidth={2.2} />,
      iconBg: "rgba(245, 196, 64, 0.16)",
      iconColor: "#F5C440",
      value: s?.rank != null ? `#${s.rank}` : "—",
      label: t("mystats.rank"),
      tip: t("mystats.tipRank"),
    },
    {
      key: "quality",
      icon: <Sparkles size={16} strokeWidth={2.2} />,
      iconBg: "var(--accent-green-soft)",
      iconColor: "var(--accent-green)",
      value: s && s.hasContribs ? `${s.quality}%` : "—",
      label: t("mystats.quality"),
      tip: t("mystats.tipQuality"),
    },
  ];
  const openTip = cards.find((c) => c.key === tip);

  return (
    <div className="fade-in" dir={rtl ? "rtl" : "ltr"} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 9 }}>
        {cards.map((c) => {
          const lit = flash === c.key;
          const active = tip === c.key;
          return (
            <div
              key={c.key}
              role="button"
              onClick={() => setTip(active ? null : c.key)}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 12px",
                cursor: "pointer",
                background: "var(--surface-2)",
                border: `1px solid ${lit || active ? "var(--accent-green)" : "var(--border)"}`,
                borderRadius: 16,
                boxShadow: lit ? "0 0 0 3px var(--accent-green-soft)" : "none",
                transition: "border-color .25s ease, box-shadow .4s ease",
              }}
            >
              <div
                style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: c.iconBg, color: c.iconColor,
                }}
              >
                {c.icon}
              </div>
              <div style={{ minWidth: 0, lineHeight: 1.15 }}>
                <div
                  style={{
                    fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)", whiteSpace: "nowrap",
                    transform: lit ? "scale(1.06)" : "scale(1)", transition: "transform .3s ease",
                  }}
                >
                  {c.value}
                </div>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    fontSize: "0.6rem", fontWeight: 600, color: "var(--text-muted)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}
                >
                  {c.label}
                  <span style={{ fontSize: "0.62rem", color: active ? "var(--accent-green)" : "var(--text-muted)", opacity: 0.7 }}>ⓘ</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {openTip && (
        <div
          style={{
            marginTop: 8, fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5,
            background: "var(--surface-2)", border: "1px solid var(--accent-green-soft)", borderRadius: 12, padding: "10px 12px",
            direction: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left",
          }}
        >
          {openTip.tip}
        </div>
      )}
    </div>
  );
}
