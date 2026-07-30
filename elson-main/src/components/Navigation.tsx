"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, CheckCircle, Trophy, User, LogOut, BookOpen, Shield, Globe, Bell, AlertTriangle, MessageSquare, Award, MoreHorizontal, CalendarClock, Mic, Film, ClipboardCheck, Newspaper, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CreditMeter } from "@/components/CreditMeter";
import { NotifToastHost, showNotifToast } from "@/components/NotifToast";
import { Locale } from "@/lib/i18n";
import { isLoggedIn, tryRestoreSession, getMyProfile, getNotifications, markNotificationsRead, getCommunityUnread } from "@/lib/api";

const LOCALE_LABELS: Record<Locale, string> = { en: "EN", fr: "FR", ar: "عر" };
const LOCALE_ORDER: Locale[] = ["en", "fr", "ar"];

// Module-level cache: survives client-side navigation (the module isn't reloaded),
// so once we know the user is admin, the Admin tab is present immediately on every
// subsequent page — no async pop-in that shifts the navbar order between pages.
// Starts false (SSR + first render are consistent → no hydration mismatch).
let cachedIsAdmin = false;

// Runs before the browser paints on the client (no visible flash), falls back to a
// no-op on the server (avoids the SSR useLayoutEffect warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(cachedIsAdmin);
  const [communityUnread, setCommunityUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const { t, rtl } = useI18n();

  // Close the "More" dropdown whenever the route changes (a menu item was tapped).
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  // Seed admin status from localStorage BEFORE paint, so even a hard reload (F5)
  // renders the Admin tab in its final position immediately — the tab order never
  // shifts, on navigation OR reload.
  useIsoLayoutEffect(() => {
    try {
      if (!cachedIsAdmin && localStorage.getItem("elson_isAdmin") === "1") {
        cachedIsAdmin = true;
        setIsAdmin(true);
      }
    } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        const restored = await tryRestoreSession();
        if (!restored) return;
      }
      getMyProfile().then(({ data }) => {
        const admin = data?.profile?.role === "admin";
        cachedIsAdmin = admin;
        setIsAdmin(admin);
        try { localStorage.setItem("elson_isAdmin", admin ? "1" : "0"); } catch { /* private mode */ }
      });
    }
    init();
  }, []);

  // +N badge: count of new community posts (refetched on navigation + every 30s)
  useEffect(() => {
    const loadUnread = () => getCommunityUnread().then(({ data }) => { if (data) setCommunityUnread(data.count); }).catch(() => {});
    loadUnread();
    const id = setInterval(loadUnread, 30_000);
    return () => clearInterval(id);
  }, [pathname]);

  // Primary actions stay visible at all times; everything else lives in "More".
  const mainTabs = [
    { href: "/contribute", icon: PenLine, labelKey: "nav.contribute" },
    { href: "/validate", icon: CheckCircle, labelKey: "nav.validate" },
    { href: "/leaderboard", icon: Trophy, labelKey: "nav.leaderboard" },
  ];
  const moreItems = [
    { href: "/studio", icon: Mic, labelKey: "nav.studio", badge: 0, soon: true },
    { href: "/community", icon: MessageSquare, labelKey: "nav.community", badge: communityUnread, soon: false },
    { href: "/my-agenda", icon: CalendarClock, labelKey: "nav.myAgenda", badge: 0, soon: false },
    { href: "/credits", icon: Award, labelKey: "nav.credits", badge: 0, soon: false },
    { href: "/dashboard", icon: User, labelKey: "nav.dashboard", badge: 0, soon: false },
    { href: "/rules", icon: BookOpen, labelKey: "nav.rules", badge: 0, soon: false },
    ...(isAdmin ? [{ href: "/admin", icon: Shield, labelKey: "nav.admin", badge: 0, soon: false }] : []),
    ...(isAdmin ? [{ href: "/media-studio", icon: Film, labelKey: "nav.mediaStudio", badge: 0, soon: false }] : []),
    ...(isAdmin ? [{ href: "/reviewer", icon: ClipboardCheck, labelKey: "nav.reviewer", badge: 0, soon: false }] : []),
    ...(isAdmin ? [{ href: "/news-bot", icon: Newspaper, labelKey: "nav.newsBot", badge: 0, soon: false }] : []),
    ...(isAdmin ? [{ href: "/eval-control", icon: ShieldCheck, labelKey: "nav.evalControl", badge: 0, soon: false }] : []),
  ];
  const moreActive = moreOpen || moreItems.some((m) => m.href === pathname);
  // Unread community posts surface on the "More" trigger when the menu is closed.
  const moreBadge = pathname !== "/community" ? communityUnread : 0;

  // Each item = icon ABOVE its label (labels ALWAYS visible). The active one
  // becomes a filled brand-gradient chip with a soft glow that lifts slightly —
  // premium and alive. Inactive items stay muted. Stacked layout keeps all four
  // labelled items comfortably within a small (≈360px) phone width.
  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    textDecoration: "none", border: "none", cursor: "pointer",
    padding: active ? "7px 14px" : "6px 10px",
    borderRadius: 15,
    background: active ? "var(--gradient-brand)" : "transparent",
    color: active ? "var(--on-primary)" : "var(--text-muted)",
    boxShadow: active ? "0 5px 16px var(--primary-glow)" : "none",
    transform: active ? "translateY(-1px)" : "none",
    transition: "background .3s ease, color .25s ease, box-shadow .35s ease, padding .3s ease, transform .3s ease",
    minWidth: 0, flexShrink: 1,
  });
  const labelStyle: React.CSSProperties = {
    fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80,
  };

  return (
    // Explicit dir based on locale → the tab order is consistent on EVERY page,
    // regardless of whether the page wraps its content in dir="rtl" (which used to
    // flip the fixed navbar between pages).
    <nav className="elson-nav elson-bottomnav" dir={rtl ? "rtl" : "ltr"} style={{
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
      left: "50%", transform: "translateX(-50%)",
      width: "calc(100% - 24px)", maxWidth: 480, zIndex: 50,
    }}>
      {/* "More" dropdown — opens ABOVE the bar (the bar is pinned to the bottom). */}
      {moreOpen && (
        <>
          <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
          <div className="fade-in" style={{
            position: "absolute", bottom: "calc(100% + 10px)", insetInlineEnd: 4, zIndex: 51,
            minWidth: 210, padding: 6,
            background: "var(--bg-glass)", backdropFilter: "blur(24px) saturate(150%)",
            WebkitBackdropFilter: "blur(24px) saturate(150%)",
            border: "1px solid var(--border)", borderRadius: 16,
            boxShadow: "0 12px 40px var(--shadow)",
          }}>
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 11,
                  textDecoration: "none", fontSize: "0.9rem", fontWeight: 700,
                  color: active ? "var(--accent-green)" : "var(--text-secondary)",
                  background: active ? "var(--accent-green-soft)" : "transparent",
                }}>
                  <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
                    <Icon size={20} strokeWidth={active ? 2.5 : 1.9} />
                    {item.badge > 0 && (
                      <span style={{
                        position: "absolute", top: -6, insetInlineEnd: -6, minWidth: 15, height: 15,
                        padding: "0 4px", borderRadius: 8, background: "var(--danger)", color: "#fff",
                        fontSize: "8px", fontWeight: 800, lineHeight: "15px", textAlign: "center",
                      }}>{item.badge > 9 ? "9+" : item.badge}</span>
                    )}
                  </span>
                  {t(item.labelKey)}
                  {item.soon && (
                    <span style={{
                      marginInlineStart: "auto", padding: "2px 8px", borderRadius: 7,
                      background: "var(--accent-green-soft)", color: "var(--accent-green)",
                      fontSize: "9px", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
                    }}>Soon</span>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, padding: "7px 8px" }}>
        {mainTabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link key={tab.href} href={tab.href} aria-label={t(tab.labelKey)} style={itemStyle(isActive)}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.9} style={{ flexShrink: 0 }} />
              <span style={labelStyle}>{t(tab.labelKey)}</span>
            </Link>
          );
        })}

        {/* Thin divider so "More" reads as a menu, not a 4th tab */}
        <span aria-hidden style={{ width: 1, height: 30, background: "var(--border)", opacity: 0.7, flexShrink: 0, marginInline: 1 }} />

        {/* "More" trigger */}
        <button onClick={() => setMoreOpen((o) => !o)} aria-label={t("nav.more")} aria-expanded={moreOpen} style={itemStyle(moreActive)}>
          <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
            <MoreHorizontal size={20} strokeWidth={moreActive ? 2.5 : 1.9} />
            {moreBadge > 0 && !moreOpen && (
              <span style={{
                position: "absolute", top: -6, insetInlineEnd: -6, minWidth: 15, height: 15,
                padding: "0 4px", borderRadius: 8, background: "var(--danger)", color: "#fff",
                fontSize: "8px", fontWeight: 800, lineHeight: "15px", textAlign: "center",
                boxShadow: "0 0 0 2px var(--surface-1)",
              }}>{moreBadge > 9 ? "9+" : moreBadge}</span>
            )}
          </span>
          <span style={labelStyle}>{t("nav.more")}</span>
        </button>
      </div>
    </nav>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10,
        border: "1px solid var(--border)", background: "var(--surface-1)", cursor: "pointer",
        color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 600,
      }}>
        <Globe size={16} color="var(--primary-light)" />
        {LOCALE_LABELS[locale]}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 99,
            background: "var(--bg-glass)", backdropFilter: "blur(20px)",
            border: "1px solid var(--border)", borderRadius: 12, padding: 4, minWidth: 120,
            boxShadow: "0 8px 32px var(--shadow)",
          }}>
            {LOCALE_ORDER.map((l) => (
              <button key={l} onClick={() => { setLocale(l); setOpen(false); }} style={{
                display: "block", width: "100%", padding: "10px 16px", borderRadius: 8,
                border: "none", cursor: "pointer", textAlign: "left",
                fontSize: "0.8rem", fontWeight: locale === l ? 700 : 500,
                color: locale === l ? "var(--primary-light)" : "var(--text-secondary)",
                background: locale === l ? "rgba(0, 0, 0,0.08)" : "transparent",
                fontFamily: l === "ar" ? "'Cairo', sans-serif" : "inherit",
              }}>
                {LOCALE_LABELS[l]} {l === "en" ? "English" : l === "fr" ? "Français" : "العربية"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function TopBar({ onLogout, creditActivity }: { onLogout?: () => void; creditActivity?: "contribute" | "validate" }) {
  const { t, rtl } = useI18n();
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      getNotifications().then(({ data }) => {
        if (data) {
          setNotifs(data.items || []);
          setUnread(data.unread || 0);
          // New announcement since last seen → sliding toast card + chime.
          showNotifToast((data.items || []) as any);
        }
      }).catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const toggleNotif = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && unread > 0) {
      markNotificationsRead().catch(() => {});
      setUnread(0);
    }
  };

  const levelColor = (lvl: string) => lvl === "warning" ? "#d97706" : lvl === "success" ? "#10b981" : "#6366f1";

  // Email verification — soft prompt. Since automatic code emails are currently
  // unavailable, we route users to WhatsApp for MANUAL validation.
  const SUPPORT_WHATSAPP = "13138047312";
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [waLink, setWaLink] = useState(`https://wa.me/${SUPPORT_WHATSAPP}`);
  useEffect(() => {
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const check = () => {
      getMyProfile().then(({ data }) => {
        if (stopped || !data?.profile) return;
        // Only flag as unverified on an EXPLICIT false — never on a missing field,
        // so the banner can never show for everyone by accident.
        const v = data.profile.email_verified ?? null;
        setEmailVerified(v);
        const msg = `Bonjour, je souhaite valider mon compte Elson. Pseudo : ${data.profile.username ?? ""} — Email : ${data.profile.email ?? ""}`;
        setWaLink(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`);
        // Once verified (e.g. an admin just validated the account), the banner is
        // gone — stop polling.
        if (v === true && intervalId) { clearInterval(intervalId); intervalId = null; }
      }).catch(() => {});
    };
    check();
    // Re-check periodically AND when the tab regains focus, so an admin validation
    // makes the banner disappear without the user having to reload.
    intervalId = setInterval(check, 45_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; if (intervalId) clearInterval(intervalId); window.removeEventListener("focus", onFocus); };
  }, []);

  useEffect(() => {
    const fetchOnline = () => {
      fetch(`${API_URL}/api/public/stats`)
        .then(r => r.json())
        .then(d => {
          if (d.onlineUsers !== undefined) setOnlineUsers(d.onlineUsers);
          if (Array.isArray(d.onlineNames)) setOnlineNames(d.onlineNames);
        })
        .catch(() => {});
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Facebook-style toast: new announcements slide in from the right + chime */}
      <NotifToastHost rtl={rtl} />
      {emailVerified === false && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "11px 18px", paddingTop: "calc(env(safe-area-inset-top, 0px) + 11px)",
          background: "rgba(251,191,36,0.12)", borderBottom: "1px solid rgba(251,191,36,0.25)", color: "var(--warning)",
          fontSize: "0.82rem", lineHeight: 1.5, position: "relative", zIndex: 41,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, color: "var(--warning)" }} />
          <span style={{ flex: 1, minWidth: 180, fontWeight: 600 }}>{t("emailBanner.text")}</span>
          <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
            flexShrink: 0, background: "#16a34a", color: "#fff", textDecoration: "none",
            padding: "7px 16px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700,
            whiteSpace: "nowrap",
          }}>{t("emailBanner.action")}</a>
        </div>
      )}
      <header className="elson-nav" dir={rtl ? "rtl" : "ltr"} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px",
      paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
      backdropFilter: "blur(24px) saturate(150%)",
      WebkitBackdropFilter: "blur(24px) saturate(150%)",
      borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, var(--accent-green-soft), transparent)" }} />

      <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <img src="/elson-logo.svg" alt="Elson" className="app-logo" style={{ height: 44 }} />
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Theme toggle (light / dark) */}
        <ThemeToggle />
        {/* Online users counter */}
        {onlineUsers > 0 && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setOnlineOpen((o) => !o)} aria-expanded={onlineOpen} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 8,
              background: onlineOpen ? "var(--accent-green-soft)" : "var(--surface-2)",
              border: `1px solid ${onlineOpen ? "var(--accent-green)" : "var(--border)"}`,
              fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }} />
              <span style={{ color: "var(--accent-green)", fontWeight: 700 }}>{onlineUsers}</span>
              <span>{t("nav.online")}</span>
            </button>
            {onlineOpen && (
              <>
                <div onClick={() => setOnlineOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 10px)", insetInlineEnd: 0, zIndex: 61,
                  width: 260, maxWidth: "calc(100vw - 32px)", maxHeight: 340, overflowY: "auto",
                  padding: 6, background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 14, boxShadow: "0 12px 40px var(--shadow)", textAlign: rtl ? "right" : "left",
                }}>
                  <div style={{ padding: "9px 10px", borderBottom: "1px solid var(--border)", fontSize: "0.74rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {onlineUsers} {t("nav.online")}
                  </div>
                  {onlineNames.length === 0 ? (
                    <div style={{ padding: "18px 10px", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {t("community.noneOnline")}
                    </div>
                  ) : (
                    onlineNames.map((name) => (
                      <div key={name} style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "9px 10px", borderRadius: 10,
                        color: "var(--text-secondary)", fontSize: "0.82rem", fontWeight: 700,
                      }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "var(--accent-green-soft)", color: "var(--accent-green)",
                          fontSize: "0.72rem", fontWeight: 900,
                        }}>{name.charAt(0).toUpperCase()}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {/* HYBRID credit meter (renders nothing when no credit plan applies) */}
        {creditActivity && <CreditMeter activity={creditActivity} />}
        {/* Notifications bell */}
        <div style={{ position: "relative" }}>
          <button onClick={toggleNotif} aria-label="Notifications" style={{
            background: "var(--surface-1)", border: "1px solid var(--border)",
            color: notifOpen ? "var(--primary-light)" : "var(--text-muted)", padding: "8px 10px", borderRadius: 10,
            cursor: "pointer", display: "flex", alignItems: "center", position: "relative",
            transition: "all 0.25s",
          }}>
            <Bell size={16} />
            {unread > 0 && (
              <span style={{
                position: "absolute", top: -5, insetInlineEnd: -5, minWidth: 16, height: 16,
                padding: "0 4px", borderRadius: 8, background: "var(--danger)", color: "#fff",
                fontSize: "9px", fontWeight: 800, lineHeight: "16px", textAlign: "center",
                boxShadow: "0 0 0 2px var(--bg-glass)",
              }}>{unread > 9 ? "9+" : unread}</span>
            )}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", insetInlineEnd: 0, zIndex: 61,
                width: 320, maxWidth: "calc(100vw - 32px)", maxHeight: 420, overflowY: "auto",
                background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14,
                boxShadow: "0 12px 40px var(--shadow)", textAlign: rtl ? "right" : "left",
              }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("notif.title")}
                </div>
                {notifs.length === 0 ? (
                  <div style={{ padding: "28px 16px", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {t("notif.empty")}
                  </div>
                ) : (
                  notifs.map((n) => (
                    <div key={n.id} style={{
                      padding: "13px 16px", borderBottom: "1px solid var(--border)",
                      borderInlineStart: `3px solid ${levelColor(n.level)}`,
                    }}>
                      {n.title && <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{n.title}</div>}
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: 6 }}>
                        {new Date(n.created_at).toLocaleString(rtl ? "ar" : "fr")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        {onLogout && (
          <button onClick={onLogout} style={{
            background: "var(--surface-1)", border: "1px solid var(--border)",
            color: "var(--text-muted)", padding: "8px 10px", borderRadius: 10,
            cursor: "pointer", display: "flex", alignItems: "center",
            transition: "all 0.25s",
          }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)"; e.currentTarget.style.color = "var(--danger)"; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
    </>
  );
}
