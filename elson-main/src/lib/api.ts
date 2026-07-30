/**
 * API Client — ALL communication goes through here.
 *
 * Security model:
 * - Access token: stored in memory only (JS variable) — expires in 15min
 * - Refresh token: httpOnly cookie set by the server — NOT accessible to JS
 *   → Immune to XSS attacks (JavaScript cannot read or steal the cookie)
 *   → Sent automatically by browser on /api/auth/* routes
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Session API key — issued by the backend on login/refresh, stored in memory only
let sessionApiKey: string | null = null;

const baseHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "X-Requested-By": "elson-web", // CSRF defense: backend rejects mutating reqs without this
  ...(sessionApiKey ? { "X-Api-Key": sessionApiKey } : {}),
});

// ── Access token stored in memory only (not localStorage) ──
// Survives page navigation (SPA) but NOT page refresh (by design — forces re-auth via cookie)
let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearTokens() {
  accessToken = null;
  sessionApiKey = null;
}

/**
 * Check if user is logged in by verifying access token exists and is not expired.
 * If access token is missing/expired, tries a silent refresh via httpOnly cookie.
 */
export function isLoggedIn(): boolean {
  if (!accessToken) return false;

  // Decode JWT payload (base64) to check expiry without a library
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    // exp is in seconds, Date.now() in ms
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Try to restore session on page load via httpOnly cookie.
 * The browser sends the cookie automatically — we just call /refresh.
 *
 * SINGLE-FLIGHT: on page load several authenticated calls fire at once (profile,
 * notifications, community badge…). Without dedup, each would POST /refresh in
 * parallel with the SAME cookie → the server rotates the refresh token on the
 * first, then sees the now-revoked token on the others and trips its token-reuse
 * alarm, revoking the whole session → the user is logged out on every refresh.
 * We collapse all concurrent callers onto ONE in-flight /refresh promise.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function tryRestoreSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: baseHeaders(),
      credentials: "include",
    });

    if (!res.ok) {
      clearTokens();
      // Single-session: opened on another device → bounce to login with a notice.
      // Guarded against loops (server already cleared the refresh cookie) and we
      // never redirect away from the login page itself.
      const body = await res.json().catch(() => ({}));
      if (
        body.code === "SESSION_REVOKED" &&
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        window.location.href = "/login?reason=session_revoked";
      }
      return false;
    }

    const data = await res.json();
    accessToken = data.accessToken;
    if (data.apiKey) sessionApiKey = data.apiKey;

    // Sync UI language with user's preferred language (on page refresh)
    if (data.preferredLang && ["en", "fr", "ar"].includes(data.preferredLang)) {
      const current = localStorage.getItem("dialect-locale");
      if (!current) localStorage.setItem("dialect-locale", data.preferredLang);
    }

    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/**
 * Auto-refresh: if access token expired, use httpOnly cookie
 */
async function refreshAccessToken(): Promise<boolean> {
  return tryRestoreSession();
}

/**
 * Core fetch with auto-retry on 401 (token expired)
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<{ data: T | null; error: string | null; code?: string; meta?: any; status?: number }> {
  if (!accessToken) {
    // Try silent refresh before giving up
    const restored = await tryRestoreSession();
    if (!restored) {
      return { data: null, error: "Not authenticated" };
    }
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include", // include cookies for cross-origin
      headers: {
        ...baseHeaders(),
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    // Auto-refresh on expired token
    if (res.status === 401 && retry) {
      const body = await res.json().catch(() => ({}));
      // Single-session: account was opened on another device → don't retry, sign out.
      if (body.code === "SESSION_REVOKED") {
        clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=session_revoked";
        }
        return { data: null, error: body.error ?? "Session ouverte sur un autre appareil.", code: "SESSION_REVOKED" };
      }
      if (body.code === "TOKEN_EXPIRED") {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return apiFetch<T>(path, options, false); // retry once
        }
      }
      clearTokens();
      return { data: null, error: "Session expired. Please log in again." };
    }

    const json = await res.json();

    if (!res.ok) {
      // Auto-redirect on access blocks. Email verification is NO LONGER a hard
      // block (it's a soft banner now), so we don't force-redirect on it anymore.
      if (typeof window !== "undefined") {
        if (json.code === "ONBOARDING_REQUIRED") {
          window.location.href = "/onboarding";
          return { data: null, error: json.error };
        }
      }
      return { data: null, error: json.error ?? `HTTP ${res.status}`, code: json.code, meta: json, status: res.status };
    }

    return { data: json as T, error: null, status: res.status };
  } catch {
    // status 0 = the request never completed (network drop / abort) → retryable.
    return { data: null, error: "Network error — please check your connection", status: 0 };
  }
}

// ── Auth ──

export interface AuthResponse {
  user: { id: string; role: string; username: string; emailVerified?: boolean };
  accessToken: string;
  preferredLang?: string;
}

export async function login(identifier: string, password: string): Promise<{ data: AuthResponse | null; error: string | null }> {
  try {
    // Auto-detect: email, NNI, or WhatsApp.
    const isEmail = identifier.includes("@");
    const digits = identifier.replace(/\D/g, "");
    const isNni = /^\d{10}$/.test(identifier.trim());
    const isWhatsapp = !isEmail && !isNni && digits.length >= 8;
    const body = isEmail
      ? { email: identifier, password }
      : isWhatsapp
        ? { whatsapp: identifier, password }
        : { nni: identifier, password };

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: baseHeaders(),
      credentials: "include", // receive the httpOnly cookie
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? "Login failed" };

    accessToken = json.accessToken;
    if (json.apiKey) sessionApiKey = json.apiKey;
    return { data: json, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// Public: is signup open? Used by the login page to hide the signup form.
// Fail-open for the UI (the backend is the authoritative gate either way).
export async function getRegistrationStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/registration-status`, { headers: { "X-Requested-By": "elson-web" } });
    if (!res.ok) return true;
    const j = await res.json();
    return j.open !== false;
  } catch {
    return true;
  }
}

export async function getRegistrationInfo(): Promise<{ open: boolean; inviteOnly: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/registration-status`, { headers: { "X-Requested-By": "elson-web" } });
    if (!res.ok) return { open: true, inviteOnly: false };
    const j = await res.json();
    return { open: j.open !== false, inviteOnly: j.inviteOnly === true };
  } catch {
    return { open: true, inviteOnly: false };
  }
}

export async function register(data: {
  email?: string;
  password: string;
  sourceLang: string;
  whatsapp?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  nni?: string;
  birthdate?: string;
  referralCode?: string;
}): Promise<{ data: AuthResponse | null; error: string | null }> {
  // Anti-fraud: compute device fingerprint and include in the signup payload.
  let deviceFingerprint: string | undefined;
  try {
    const { getDeviceFingerprint } = await import("./fingerprint");
    deviceFingerprint = await getDeviceFingerprint();
  } catch { /* fail-open: backend will flag missing fingerprint */ }

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: baseHeaders(),
      credentials: "include", // receive the httpOnly cookie
      body: JSON.stringify({ ...data, deviceFingerprint }),
    });

    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? "Registration failed" };

    accessToken = json.accessToken;
    if (json.apiKey) sessionApiKey = json.apiKey;
    return { data: json, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function logout() {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include", // send cookie so server can revoke it
      headers: {
        "Content-Type": "application/json",
        "X-Requested-By": "elson-web",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  } catch {
    // Logout is best-effort
  }
  clearTokens();
}

// ── Email Verification ──

export async function verifyEmail(code: string) {
  return apiFetch<{ success: boolean; message: string }>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function resendVerification() {
  return apiFetch<{ success: boolean; message: string }>("/api/auth/resend-verification", {
    method: "POST",
  });
}

export async function getEmailStatus() {
  return apiFetch<{ emailVerified: boolean; email: string | null }>("/api/auth/email-status");
}

// ── Password Reset ──

export async function forgotPassword(identifier: string) {
  const isEmail = identifier.includes("@");
  const body = isEmail ? { email: identifier } : { nni: identifier };
  try {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { data: json, error: res.ok ? null : (json.error ?? "Erreur") };
  } catch {
    return { data: null, error: "Erreur reseau" };
  }
}

export async function resetPassword(identifier: string, code: string, newPassword: string) {
  const isEmail = identifier.includes("@");
  const body = isEmail
    ? { email: identifier, code, newPassword }
    : { nni: identifier, code, newPassword };
  try {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { data: json, error: res.ok ? null : (json.error ?? "Erreur") };
  } catch {
    return { data: null, error: "Erreur reseau" };
  }
}

// ── WhatsApp OTP (registration verification + password reset) ──

// Verify the registration OTP (logged-in user) → marks the account verified.
export async function verifyWhatsapp(code: string) {
  return apiFetch<{ success: boolean; message: string }>("/api/auth/verify-whatsapp", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
// Resend the registration OTP.
export async function resendWhatsapp() {
  return apiFetch<{ success: boolean; retryAfter?: number }>("/api/auth/resend-whatsapp", { method: "POST" });
}
// Forgot password: send a reset OTP to the WhatsApp number (always generic response).
export async function forgotPasswordWhatsapp(whatsapp: string) {
  try {
    const res = await fetch(`${API_URL}/api/auth/forgot-password-whatsapp`, {
      method: "POST", headers: baseHeaders(), body: JSON.stringify({ whatsapp }),
    });
    const json = await res.json();
    return { data: json, error: res.ok ? null : (json.error ?? "Erreur") };
  } catch {
    return { data: null, error: "Erreur réseau" };
  }
}
// Reset password using the WhatsApp OTP.
export async function resetPasswordWhatsapp(whatsapp: string, code: string, newPassword: string) {
  try {
    const res = await fetch(`${API_URL}/api/auth/reset-password-whatsapp`, {
      method: "POST", headers: baseHeaders(), body: JSON.stringify({ whatsapp, code, newPassword }),
    });
    const json = await res.json();
    return { data: json, error: res.ok ? null : (json.error ?? "Erreur") };
  } catch {
    return { data: null, error: "Erreur réseau" };
  }
}

// ── Onboarding ──

export async function completeOnboarding() {
  return apiFetch<{ success: boolean }>("/api/users/complete-onboarding", { method: "POST" });
}

// ── Phrases Pipeline ──

export interface PhraseResponse {
  phrase: {
    id: number;
    source_text: string;
    source_lang: string;
    difficulty: number;
    category?: string;
  } | null;
  conversation?: { speaker: string; text: string; target: boolean }[] | null;
  lockId: number | null;
  phase: string;
  reason?: string;
  skippedCount?: number;
}

export async function getNextPhrase(lang: string) {
  return apiFetch<PhraseResponse>(`/api/phrases/next?lang=${lang}`);
}

export async function resetSkips() {
  return apiFetch<{ success: boolean }>("/api/phrases/reset-skips", { method: "POST" });
}

export async function skipPhrase(phraseId: number) {
  return apiFetch<{ success: boolean }>("/api/phrases/skip", {
    method: "POST",
    body: JSON.stringify({ phraseId }),
  });
}

export async function reportPhrase(phraseId: number, reason?: string) {
  return apiFetch<{ success: boolean }>("/api/phrases/report", {
    method: "POST",
    body: JSON.stringify({ phraseId, reason }),
  });
}

export interface SubmitResponse {
  success: boolean;
  contributionId: number;
  points: number;
  flash?: boolean; // true = contribution counted toward the flash tournament (0 official points, mode B)
}

/**
 * Submit translation + audio together (multipart/form-data)
 * Audio is MANDATORY — sent atomically with text
 */
/**
 * Generic multipart upload helper for admin routes.
 * Includes the access token + session API key, refreshes once on 401.
 */
export async function apiMultipart<T = any>(
  path: string,
  formData: FormData,
): Promise<{ data: T | null; error: string | null }> {
  if (!accessToken) {
    const restored = await tryRestoreSession();
    if (!restored) return { data: null, error: "Not authenticated" };
  }
  const doFetch = () => fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Requested-By": "elson-web",
      ...(sessionApiKey ? { "X-Api-Key": sessionApiKey } : {}),
    },
    body: formData,
  });
  try {
    let res = await doFetch();
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) res = await doFetch();
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: json.error ?? `HTTP ${res.status}` };
    return { data: json as T, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message ?? "Network error" };
  }
}

export async function submitContribution(formData: FormData): Promise<{ data: SubmitResponse | null; error: string | null; status?: number }> {
  if (!accessToken) {
    const restored = await tryRestoreSession();
    if (!restored) return { data: null, error: "Not authenticated", status: 401 };
  }

  try {
    const res = await fetch(`${API_URL}/api/phrases/submit`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Requested-By": "elson-web",
        ...(sessionApiKey ? { "X-Api-Key": sessionApiKey } : {}),
        // NO Content-Type header — browser sets multipart boundary automatically
      },
      body: formData,
    });

    // Auto-refresh on 401
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      if (body.code === "TOKEN_EXPIRED") {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const retry = await fetch(`${API_URL}/api/phrases/submit`, {
            method: "POST",
            credentials: "include",
            headers: { Authorization: `Bearer ${accessToken}`, "X-Requested-By": "elson-web", ...(sessionApiKey ? { "X-Api-Key": sessionApiKey } : {}) },
            body: formData,
          });
          const json = await retry.json();
          if (!retry.ok) return { data: null, error: json.error ?? `HTTP ${retry.status}`, status: retry.status };
          return { data: json, error: null, status: retry.status };
        }
      }
      clearTokens();
      return { data: null, error: "Session expired", status: 401 };
    }

    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? `HTTP ${res.status}`, status: res.status };
    return { data: json, error: null, status: res.status };
  } catch {
    return { data: null, error: "Failed to submit. Check your connection.", status: 0 };
  }
}

// ── Validation ──

export interface ContributionToValidate {
  id: number;
  hassaniya_text: string;
  audio_url: string | null;
  audio_duration_ms: number;
  validation_count: number;
  phrases: { source_text: string; source_lang: string; origin: string };
  profiles: { username: string };
}

export async function getNextContribution(target?: string) {
  const qs = target ? `?target=${encodeURIComponent(target)}` : "";
  return apiFetch<{ contribution: ContributionToValidate | null; validateLangs: string[]; targetMode?: boolean }>(`/api/validate/next${qs}`);
}

export async function updateValidateLangs(langs: string[]) {
  return apiFetch<{ success: boolean; validateLangs: string[] }>("/api/validate/langs", {
    method: "PATCH",
    body: JSON.stringify({ langs }),
  });
}

export async function submitValidation(data: {
  contributionId: number;
  textAccuracy: number;
  audioClarity: number | null;
  isValid: boolean;
  notes?: string;
}) {
  return apiFetch<{ success: boolean; points: number; flash?: boolean }>("/api/validate/submit", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


// ── Audio ──

/**
 * Fetch an audio file with auth and return a blob URL.
 * Required because <audio src> can't send Authorization headers.
 */
export async function fetchAuthAudio(path: string | null): Promise<string> {
  if (!path) return "";
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  if (!accessToken) {
    await tryRestoreSession();
  }

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, ...(sessionApiKey ? { "X-Api-Key": sessionApiKey } : {}) },
    });
    if (!res.ok) return "";
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}

/**
 * Convert a relative audio path to a full URL (used for non-auth contexts or fallback).
 */
// ── In-app notifications (bell) ──
export async function getNotifications() {
  return apiFetch<{ items: any[]; unread: number }>("/api/users/notifications");
}
export async function markNotificationsRead() {
  return apiFetch("/api/users/notifications/read", { method: "POST" });
}
export async function adminListNotifications() {
  return apiFetch<{ items: any[] }>("/api/m/app-notifications");
}
export async function adminPostNotification(payload: { title?: string; body: string; level?: string; target?: string }) {
  return apiFetch<{ success: boolean; notification: any }>("/api/m/app-notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export async function adminUsersList() {
  return apiFetch<{ items: { id: string; username: string }[] }>("/api/m/users-list");
}

// ── Phrase targeting (assign phrases to a specific user) ──
export type AdminPhrase = { id: number; source_text: string; source_lang: string; category: string; origin: string };
export type AdminAssignment = { id: number; phrase_id: number; source_text: string; source_lang: string; category: string; created_at: string; done: boolean };

export type PhraseFilter = { q?: string; lang?: string; category?: string; origin?: string; categories?: string[]; origins?: string[]; limit?: number; fresh?: boolean };
export async function adminPhraseSearch(params: PhraseFilter) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.lang) qs.set("lang", params.lang);
  if (params.category) qs.set("category", params.category);
  if (params.origin) qs.set("origin", params.origin);
  if (params.categories?.length) qs.set("categories", params.categories.join(","));
  if (params.origins?.length) qs.set("origins", params.origins.join(","));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.fresh) qs.set("fresh", "1");
  return apiFetch<{ items: AdminPhrase[]; total: number }>(`/api/m/phrase-search?${qs.toString()}`);
}
export async function adminPhraseFacets() {
  return apiFetch<{ categories: { value: string; count: number }[]; origins: { value: string; count: number }[] }>("/api/m/phrase-facets");
}
export async function adminAssignByFilter(userId: string, filter: PhraseFilter & { max?: number }) {
  return apiFetch<{ success: boolean; assigned: number }>(
    "/api/m/assign-by-filter", { method: "POST", body: JSON.stringify({ userId, ...filter }) });
}
export async function adminAssignPhrases(userId: string, phraseIds: number[]) {
  return apiFetch<{ success: boolean; assigned: number; requested: number }>(
    "/api/m/assign-phrases", { method: "POST", body: JSON.stringify({ userId, phraseIds }) });
}
export async function adminListAssignments(userId: string) {
  return apiFetch<{ items: AdminAssignment[]; total: number; done: number }>(
    `/api/m/assignments?userId=${encodeURIComponent(userId)}`);
}
export async function adminUnassignPhrase(id: number) {
  return apiFetch<{ success: boolean }>("/api/m/unassign-phrase", { method: "POST", body: JSON.stringify({ id }) });
}
export async function adminUnassignAll(userId: string, scope?: { origins?: string[]; categories?: string[] }) {
  return apiFetch<{ success: boolean; removed: number }>(
    "/api/m/unassign-all", { method: "POST", body: JSON.stringify({ userId, ...(scope || {}) }) });
}
// Open phrases to EVERYONE (general pool). By ids OR by filter.
export async function adminOpenToAll(body: { phraseIds?: number[] } & PhraseFilter & { max?: number }) {
  return apiFetch<{ success: boolean; opened: number }>(
    "/api/m/open-phrases", { method: "POST", body: JSON.stringify(body) });
}

// ── Disclaimer / Terms & Conditions ──
export async function getDisclaimer() {
  return apiFetch<{ enabled: boolean; version: string; text: string; accepted: boolean }>("/api/users/disclaimer");
}
export async function acceptDisclaimer() {
  return apiFetch<{ success: boolean }>("/api/users/disclaimer/accept", { method: "POST", body: JSON.stringify({}) });
}
export async function adminGetDisclaimer() {
  return apiFetch<{ enabled: boolean; version: string; text: string; acceptedCount: number }>("/api/m/disclaimer");
}
export async function adminSetDisclaimer(body: { enabled?: boolean; text?: string; bumpVersion?: boolean }) {
  return apiFetch<{ success: boolean }>("/api/m/disclaimer", { method: "POST", body: JSON.stringify(body) });
}

// ── Launch config (registration open + invite-only + invite threshold) ──
export async function adminGetLaunchConfig() {
  return apiFetch<{ registrationOpen: boolean; inviteOnly: boolean; inviteMinContributions: number; conversationContext: boolean }>("/api/m/launch-config");
}
export async function adminSetLaunchConfig(body: { registrationOpen?: boolean; inviteOnly?: boolean; inviteMinContributions?: number; conversationContext?: boolean }) {
  return apiFetch<{ success: boolean }>("/api/m/launch-config", { method: "POST", body: JSON.stringify(body) });
}
export async function adminToggleNotification(id: number) {
  return apiFetch<{ success: boolean; id: number; is_active: boolean }>(`/api/m/app-notifications/${id}/toggle`, {
    method: "POST",
  });
}

// ── Community (polls / proposals / feedback) ──
export async function getCommunity() {
  return apiFetch<{ cards: any[]; canPropose: boolean; nextProposalAt: string | null; isAdmin: boolean; online?: string[]; onlineCount?: number; canPost?: boolean; communityTopN?: number; myRank?: number | null }>("/api/community");
}
export async function getCommunityUnread() {
  return apiFetch<{ count: number }>("/api/community/unread");
}
export async function markCommunityRead() {
  return apiFetch("/api/community/read", { method: "POST" });
}
export async function voteCommunityCard(id: number, choice: number) {
  return apiFetch(`/api/community/cards/${id}/vote`, { method: "POST", body: JSON.stringify({ choice }) });
}
export async function likeCommunityCard(id: number) {
  return apiFetch<{ success: boolean; liked: boolean }>(`/api/community/cards/${id}/like`, { method: "POST" });
}
export async function commentCommunityCard(id: number, body: string, media?: { audio?: Blob | null; image?: Blob | null }) {
  const fd = new FormData();
  fd.append("body", body);
  if (media?.audio) fd.append("audio", media.audio, "voice.webm");
  if (media?.image) fd.append("image", media.image, (media.image as File).name || "image.jpg");
  return apiMultipart(`/api/community/cards/${id}/comment`, fd);
}
export async function proposeCommunityCard(question: string, type = "poll", media?: { audio?: Blob | null; image?: Blob | null; video?: Blob | null }) {
  const fd = new FormData();
  fd.append("question", question);
  fd.append("type", type);
  if (media?.audio) fd.append("audio", media.audio, "voice.webm");
  if (media?.image) fd.append("image", media.image, (media.image as File).name || "image.jpg");
  if (media?.video) fd.append("video", media.video, (media.video as File).name || "video.mp4");
  return apiMultipart<{ success: boolean; id: number }>("/api/community/propose", fd);
}

// ── Community VOICES feed (immersive) ──
export type CommunityVoice = {
  id: number; code: string; srcLang: string; srcText: string; tgtText: string;
  audioUrl: string; durationMs: number | null; quality: number | null;
  likes: number; valids: number; myLike: boolean; myValid: boolean;
};
export async function getCommunityVoices(sort = "foryou", offset = 0, limit = 8) {
  return apiFetch<{ voices: CommunityVoice[]; hasMore: boolean; isAdmin: boolean }>(
    `/api/community/voices?sort=${encodeURIComponent(sort)}&offset=${offset}&limit=${limit}`,
  );
}
// @mention autocomplete: search members by username prefix (logged-in users).
export async function mentionSearchCommunity(q: string) {
  return apiFetch<{ users: { id: string; username: string }[] }>(`/api/community/mention-search?q=${encodeURIComponent(q)}`);
}
export async function likeVoice(id: number) {
  return apiFetch<{ success: boolean; liked: boolean }>(`/api/community/voices/${id}/like`, { method: "POST" });
}
export async function endorseVoice(id: number) {
  return apiFetch<{ success: boolean; endorsed: boolean }>(`/api/community/voices/${id}/endorse`, { method: "POST" });
}
// Admin/user publish a card WITH media uploads (audio / image / video). Multipart.
export async function publishCommunityCardMedia(
  payload: { question: string; type?: string; options?: string[]; banner_url?: string; image_url?: string; text_color?: string },
  media?: { audio?: Blob | null; image?: Blob | null; video?: Blob | null },
) {
  const fd = new FormData();
  fd.append("question", payload.question);
  if (payload.type) fd.append("type", payload.type);
  if (payload.options) fd.append("options", JSON.stringify(payload.options));
  if (payload.banner_url) fd.append("banner_url", payload.banner_url);
  if (payload.image_url) fd.append("image_url", payload.image_url);
  if (payload.text_color) fd.append("text_color", payload.text_color);
  if (media?.audio) fd.append("audio", media.audio, "voice.webm");
  if (media?.image) fd.append("image", media.image, (media.image as File).name || "image.jpg");
  if (media?.video) fd.append("video", media.video, (media.video as File).name || "video.mp4");
  return apiMultipart<{ success: boolean; id: number }>("/api/community/admin/cards", fd);
}
// admin
export async function adminCreateCommunityCard(payload: { question: string; type?: string; options?: string[]; image_url?: string; banner_url?: string; text_color?: string }) {
  return apiFetch<{ success: boolean }>("/api/community/admin/cards", { method: "POST", body: JSON.stringify(payload) });
}
export async function adminDeleteCommunityCard(id: number) {
  return apiFetch(`/api/community/admin/cards/${id}`, { method: "DELETE" });
}
export async function adminGetCommunityLimits() {
  return apiFetch<{ communityTopN: number; validateMinContributions: number; adminOnly: boolean }>("/api/community/admin/limits");
}
export async function adminSetCommunityLimits(payload: { communityTopN: number; validateMinContributions: number; adminOnly?: boolean }) {
  return apiFetch<{ success: boolean; communityTopN: number; validateMinContributions: number; adminOnly: boolean }>("/api/community/admin/limits", { method: "POST", body: JSON.stringify(payload) });
}
export async function adminGetCommunityEvalStats() {
  return apiFetch<{ counts: number[] }>("/api/community/admin/eval-stats");
}

// ── Contributor credits & consent ──
export interface CreditEntry { id?: number; name: string; whatsapp: string | null; consent: "cite" | "anonymous"; position?: number; }
export async function getMyCredits() {
  return apiFetch<{ credits: CreditEntry[] }>("/api/credits");
}
export async function saveMyCredits(credits: { name: string; whatsapp: string | null; consent: "cite" | "anonymous" }[]) {
  return apiFetch<{ success: boolean; count: number }>("/api/credits", { method: "POST", body: JSON.stringify({ credits }) });
}
export async function adminGetAllCredits() {
  return apiFetch<{ credits: any[]; total: number; cited: number; anonymous: number }>("/api/credits/admin/all");
}
export async function adminToggleCommunityCard(id: number) {
  return apiFetch(`/api/community/admin/cards/${id}/close`, { method: "POST" });
}
export async function adminDeleteCommunityComment(id: number) {
  return apiFetch(`/api/community/admin/comments/${id}`, { method: "DELETE" });
}
export async function adminSetPause(payload: { target: "validation" | "contribute" | "both"; minutes?: number; from?: string; until?: string; clear?: boolean }) {
  return apiFetch<{ success: boolean; from: string; until: string }>("/api/community/admin/pause", { method: "POST", body: JSON.stringify(payload) });
}
export async function adminGetPause() {
  return apiFetch<Record<string, string>>("/api/community/admin/pause");
}
// ── Community: per-user posting block (v48) ──
export async function adminCommunityBlock(payload: { username?: string; userId?: string; blocked: boolean }) {
  return apiFetch<{ success: boolean }>("/api/community/admin/community-block", { method: "POST", body: JSON.stringify(payload) });
}
export async function adminListCommunityBlocked() {
  return apiFetch<{ blocked: { id: string; username: string }[] }>("/api/community/admin/community-blocked");
}
// ── Community: "example to imitate" (publish a user's audio as a model) ──
export interface ExampleContribution { id: number; hassaniya_text: string; audio_url: string; source_text: string; source_lang: string; status: string }
export async function adminExampleContributions(username: string) {
  return apiFetch<{ contributions: ExampleContribution[] }>(`/api/community/admin/example-contributions?username=${encodeURIComponent(username)}`);
}
export async function adminPublishExample(contributionId: number) {
  return apiFetch<{ success: boolean; id: number }>("/api/community/admin/cards/example", { method: "POST", body: JSON.stringify({ contributionId }) });
}

export function getAudioUrl(path: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

// ── Users ──

export interface UserProfile {
  username: string;
  email: string;
  email_verified?: boolean;
  first_name: string;
  last_name: string;
  role: string;
  preferred_lang: string;
  total_contributions: number;
  total_recordings: number;
  total_validations: number;
  points: number;
  level: number;
  streak_days: number;
  badges: string[];
}

export async function getMyProfile() {
  return apiFetch<{ profile: UserProfile; rank: number | null; qualityRatio: number }>("/api/users/me");
}

export type SlotActivity = "contribute" | "validate" | "both";
export interface ScheduleSlot {
  id: number;
  slot_date?: string;
  start_min: number;
  end_min: number;
  activity: SlotActivity;
  languages: string[];
  note: string;
  enabled?: boolean;
}
export interface ActivityState {
  open: boolean;
  reason: "paused" | "open" | "slot" | "between_slots" | "off" | "credit_ready" | "credit" | "credit_exhausted";
  nextChangeAt: string | null;
  languages: string[] | null; // null = all
  activeSlot?: { start_min: number; end_min: number; languages: string[]; note: string } | null;
  // credit-strategy fields:
  budgetHours?: number;
  startedAt?: string | null;
  remainingMs?: number | null;
}
export interface CompetitionSchedule {
  serverNow: string;
  status: string;
  strategy: "slots" | "credit" | "hybrid";
  pause?: { contribute: boolean; validation: boolean; until: string | null };
  contribute: ActivityState;
  validation: ActivityState;
  slots: ScheduleSlot[];
  /** v42: set when a drained validate slot was auto-promoted to contribution. */
  autoSwitch?: { active: boolean; until: string | null; languages: string[] | null };
  /** v43 HYBRID: per-user active-time credit remaining for each activity. */
  activeCredit?: { contribute: ActiveCreditState; validation: ActiveCreditState };
  /** Active or next programmed flash tournament, shown in the public agenda. */
  flashTournament?: FlashTournament;
}
export async function getCompetitionSchedule() {
  return apiFetch<CompetitionSchedule>("/api/users/competition-schedule");
}

export async function getScheduleWeek() {
  return apiFetch<{ slots: ScheduleSlot[] }>("/api/users/schedule-week");
}

// ── Referral (parrainage) ──
export interface ReferralReferee {
  username: string; approved: number; owed: number; collected: number; pending: number; joinedAt: string;
}
export interface MyReferrals {
  enabled?: boolean; // false when the admin turned the whole referral system off
  code: string; ambassadorPoints: number; ownPoints: number; capPct: number; cap: number; capRemaining: number;
  totalPending: number; collectable: number; refereeCount: number; referees: ReferralReferee[];
}
export async function getMyReferrals() {
  return apiFetch<MyReferrals>("/api/users/me/referrals");
}
export async function collectReferral() {
  return apiFetch<{ success: boolean; collected: number; reason?: string }>("/api/users/me/referrals/collect", { method: "POST" });
}
export interface AmbassadorEntry { code: string; ambassador_points: number; referrals: number; isMe: boolean }
export async function getAmbassadorsLeaderboard() {
  return apiFetch<{ entries: AmbassadorEntry[] }>("/api/users/leaderboard-ambassadors");
}
export async function adminGetReferrals() {
  return apiFetch<{ referrers: { referrer: string; referrer_points: number; ambassador_points: number; referees: number; referees_approved: number }[] }>("/api/users/admin/referrals");
}

// ── Admin scheduling strategy ──
export type ScheduleStrategy = "slots" | "credit" | "hybrid";
export interface StrategyConfig { strategy: ScheduleStrategy; contributeHours: number; validateHours: number; closedByDefault?: boolean; }
export async function adminGetStrategy() {
  return apiFetch<StrategyConfig>("/api/community/admin/strategy");
}
export async function adminSetStrategy(body: StrategyConfig) {
  return apiFetch<{ success: boolean }>("/api/community/admin/strategy", { method: "POST", body: JSON.stringify(body) });
}

// ── HYBRID: per-user active-credit windows + heartbeat ──
export interface ActiveCreditState {
  applies: boolean; budgetSeconds: number; consumedSeconds: number;
  remainingSeconds: number; exhausted: boolean; endsAt: string | null; planId: number | null;
  freeSlot: boolean; selfPaused: boolean; blocked: boolean;
}
export interface CreditPlan {
  id: number; activity: "contribute" | "validate" | "both"; budget_seconds: number;
  starts_at: string; ends_at: string; target_user_id: string | null; enabled: boolean;
  note: string | null; username: string | null;
}
export async function creditPing(activity: "contribute" | "validate") {
  return apiFetch<ActiveCreditState>("/api/users/credit-ping", { method: "POST", body: JSON.stringify({ activity }) });
}
export async function creditPause(activity: "contribute" | "validate", paused: boolean) {
  return apiFetch<ActiveCreditState>("/api/users/credit-pause", { method: "POST", body: JSON.stringify({ activity, paused }) });
}
export interface CreditSelfStats {
  applies: boolean; startsAt: string | null; endsAt: string | null;
  consumedSeconds: number; windowContribs: number; windowEvals: number;
}
export async function creditStats(activity: "contribute" | "validate") {
  return apiFetch<CreditSelfStats>(`/api/users/credit-stats?activity=${activity}`);
}
// Admin credit tracking (v2: every covered user + activity + eval-gate progress)
export interface CreditTrackRow {
  user_id: string; username: string; plan_id: number; activity: "contribute" | "validate" | "both";
  budget_seconds: number; consumed_seconds: number; remaining_seconds: number;
  paused: boolean; blocked: boolean; last_ping_at: string | null; consuming_now: boolean;
  contribs_in_window: number; evals_in_window: number; approved_total: number;
}
export interface UserEvent { type: string; at: string; detail: any; username?: string }
export async function adminCreditTracking() {
  return apiFetch<{ rows: CreditTrackRow[]; evalGateNeed: number; consumingNow: number; recentEvents: UserEvent[] }>("/api/m/credit-tracking");
}
export async function adminCreditBlock(userId: string, blocked: boolean) {
  return apiFetch<{ success: boolean }>("/api/m/credit-block", { method: "POST", body: JSON.stringify({ userId, blocked }) });
}
/** deltaSeconds > 0 = remove time (abuse penalty); < 0 = give time back. */
export async function adminCreditAdjust(userId: string, deltaSeconds: number) {
  return apiFetch<{ success: boolean; state: ActiveCreditState }>("/api/m/credit-adjust", { method: "POST", body: JSON.stringify({ userId, deltaSeconds }) });
}
// "No work is ever lost": rejected-submission vault
export interface FailedSubmission {
  id: number; phrase_id: number | null; hassaniya_text: string | null; has_audio: boolean;
  audio_duration_ms: number | null; reason: string; created_at: string; username: string;
  source_text: string | null; already_has_contribution: boolean;
}
export async function adminFailedSubmissions() {
  return apiFetch<{ rows: FailedSubmission[] }>("/api/m/failed-submissions");
}
export async function adminFailedRecover(id: number) {
  return apiFetch<{ success: boolean; pointsAwarded: number }>("/api/m/failed-recover", { method: "POST", body: JSON.stringify({ id }) });
}
export async function adminCreditHistory(userId: string) {
  return apiFetch<{ consumption: any[]; events: UserEvent[] }>(`/api/m/credit-history/${userId}`);
}
export async function adminCreditUsage(userId: string, hours = 48) {
  return apiFetch<{ usage: { hour: string; seconds: number }[] }>(`/api/m/credit-usage/${userId}?hours=${hours}`);
}
export interface CreditContribution {
  id: number; text: string; source_text: string; status: string; quarantined: boolean;
  has_audio: boolean; validation_count: number; created_at: string;
}
export interface CreditValidation {
  id: number; is_valid: boolean; text_accuracy: number | null; audio_clarity: number | null;
  created_at: string; contribution_text: string;
}
export interface EvalVoidBatch { id: number; created_at: string; window_from: string; window_to: string; n_validations: number; active: boolean }
export async function adminCreditActivity(userId: string) {
  return apiFetch<{ contributions: CreditContribution[]; validations: CreditValidation[]; voidBatches: EvalVoidBatch[] }>(`/api/m/credit-activity/${userId}`);
}
export async function adminContributionQuarantine(contributionId: number, quarantined: boolean) {
  return apiFetch<{ success: boolean }>("/api/m/contribution-quarantine", { method: "POST", body: JSON.stringify({ contributionId, quarantined }) });
}
export async function adminEvalVoid(userId: string, from: string, to: string) {
  return apiFetch<{ success: boolean; n: number; batchId?: number }>("/api/m/eval-void", { method: "POST", body: JSON.stringify({ userId, from, to }) });
}
export async function adminEvalUnvoid(batchId: number) {
  return apiFetch<{ success: boolean }>("/api/m/eval-unvoid", { method: "POST", body: JSON.stringify({ batchId }) });
}
export async function adminListCreditPlans() {
  return apiFetch<{ plans: CreditPlan[] }>("/api/community/admin/credit-plans");
}
export async function adminCreateCreditPlan(body: {
  activity: "contribute" | "validate" | "both"; budgetSeconds: number; startsAt: string; endsAt: string;
  targetUserIds: string[] | null; note?: string;
}) {
  return apiFetch<{ success: boolean; created: number }>("/api/community/admin/credit-plans", { method: "POST", body: JSON.stringify(body) });
}
export async function adminToggleCreditPlan(id: number, enabled: boolean) {
  return apiFetch<{ success: boolean }>(`/api/community/admin/credit-plans/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}
export async function adminDeleteCreditPlan(id: number) {
  return apiFetch<{ success: boolean }>(`/api/community/admin/credit-plans/${id}`, { method: "DELETE" });
}

// ── Admin schedule builder ──
export interface FlashTournament {
  id: number;
  title: string;
  activity?: "contribute" | "validate" | "both";
  starts_at?: string;
  ends_at?: string;
  startsAt?: string;
  endsAt?: string;
  target_contributions?: number;
  targetContributions?: number;
  winner_count?: number;
  winnerCount?: number;
  prize_text?: string;
  prizeText?: string;
  ambassador_enabled?: boolean;
  ambassadorEnabled?: boolean;
  ambassador_target_contributions?: number;
  ambassadorTargetContributions?: number;
  ambassador_winner_count?: number;
  ambassadorWinnerCount?: number;
  ambassador_prize_text?: string;
  ambassadorPrizeText?: string;
  ambassador_dormant_days?: number;
  ambassadorDormantDays?: number;
  ambassador_dormant_max_contributions?: number;
  ambassadorDormantMaxContributions?: number;
  ambassador_min_referees?: number;
  ambassador_count_mode?: string;
  status?: "active" | "closed";
  snapshot_official_score?: boolean;
  snapshotOfficialScore?: boolean;
  created_at?: string;
  closed_at?: string | null;
  entries?: FlashTournamentEntry[];
  ambassadorEntries?: FlashTournamentAmbassadorEntry[];
}
export interface FlashTournamentEntry {
  code: string;
  isMe?: boolean;
  rank: number;
  tournamentContributions: number;
  approvedContributions?: number;
  reachedTarget: boolean;
  prizeEligible: boolean;
  officialPointsAtStart: number;
  officialRankAtStart: number | null;
}
export interface FlashTournamentAmbassadorEntry {
  code?: string;
  isMe?: boolean;
  rank: number;
  prizeEligible: boolean;
  qualifiedReferees?: number;
  refereeContributions?: number;
  referrer_id?: string;
  username?: string | null;
  qualified_referees?: number;
  referee_contributions?: number;
  referees?: {
    userId: string;
    username: string | null;
    approvedFlash: number;
    submittedFlash: number;
    preWindowContribs: number;
  }[];
}
export interface FlashTournamentContribution {
  id: number;
  user_id: string;
  phrase_id: number;
  source_text: string;
  source_lang: string;
  hassaniya_text: string;
  status: string;
  quarantined: boolean;
  created_at: string;
  has_audio: boolean;
  audio_url?: string | null;
  flash_tagged?: boolean;
}
export interface FlashTournamentParticipant {
  user_id: string;
  username: string | null;
  current_points: number;
  total_contributions: number;
  total_recordings: number;
  total_validations: number;
  official_points: number;
  official_rank: number | null;
  tournament_contributions: number;
  approved_contributions: number;
  flash_rows: number;
  hidden_contributions: number;
  rejected_contributions: number;
  last_contribution_at: string | null;
  excluded: boolean;
  excluded_at: string | null;
  exclusion_reason: string | null;
  reached_target: boolean;
  contributions: FlashTournamentContribution[];
}
export async function adminListFlashTournaments() {
  return apiFetch<{ tournaments: FlashTournament[] }>("/api/community/admin/flash-tournaments");
}
export async function adminCreateFlashTournament(body: {
  title: string; startsAt: string; endsAt: string; targetContributions: number;
  winnerCount: number; prizeText: string; snapshotOfficialScore: boolean;
  activity?: "contribute" | "validate" | "both";
  ambassadorEnabled?: boolean; ambassadorTargetContributions?: number; ambassadorWinnerCount?: number;
  ambassadorPrizeText?: string; ambassadorDormantDays?: number; ambassadorDormantMaxContributions?: number;
  ambassadorMinReferees?: number; ambassadorCountMode?: "approved" | "submitted";
}) {
  return apiFetch<{ success: boolean; id: number }>("/api/community/admin/flash-tournaments", { method: "POST", body: JSON.stringify(body) });
}
export async function adminSetFlashTournamentStatus(id: number, status: "active" | "closed") {
  return apiFetch<{ success: boolean; id: number; status: "active" | "closed" }>(`/api/community/admin/flash-tournaments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}
// Extend: new end date (ISO). Reactivates the tournament until that date.
export async function adminExtendFlashTournament(id: number, endsAt: string) {
  return apiFetch<{ success: boolean; id: number }>(`/api/community/admin/flash-tournaments/${id}`, { method: "PATCH", body: JSON.stringify({ endsAt }) });
}
// Permanently delete a flash tournament (missed window / test).
export async function adminDeleteFlashTournament(id: number) {
  return apiFetch<{ success: boolean; id: number }>(`/api/community/admin/flash-tournaments/${id}`, { method: "DELETE" });
}
// Public: active or upcoming flash tournament (for the banner + countdown).
export interface ActiveFlash {
  id: number; title: string; starts_at: string; ends_at: string; activity?: "contribute" | "validate" | "both";
  target_contributions: number; winner_count: number; prize_text: string;
}
export async function getActiveFlash() {
  return apiFetch<{ flash: ActiveFlash | null }>("/api/community/flash/active");
}
export async function adminGetFlashTournamentParticipants(id: number) {
  return apiFetch<{ tournament: FlashTournament; participants: FlashTournamentParticipant[]; ambassadorEntries: FlashTournamentAmbassadorEntry[] }>(`/api/community/admin/flash-tournaments/${id}/participants`);
}
// Flash contributions of a SINGLE person, paginated (to browse all their phrases).
export async function adminGetFlashParticipantContributions(id: number, userId: string, offset = 0, limit = 50) {
  return apiFetch<{ contributions: FlashTournamentContribution[]; total: number; offset: number; limit: number }>(
    `/api/community/admin/flash-tournaments/${id}/contributions?userId=${encodeURIComponent(userId)}&offset=${offset}&limit=${limit}`,
  );
}
// All ids of a person's flash contributions (for "select all / delete all").
export async function adminGetFlashParticipantContributionIds(id: number, userId: string) {
  return apiFetch<{ ids: number[] }>(`/api/community/admin/flash-tournaments/${id}/contributions?userId=${encodeURIComponent(userId)}&idsOnly=1`);
}
export async function adminSetFlashTournamentExcluded(id: number, userId: string, excluded: boolean, reason?: string) {
  return apiFetch<{ success: boolean; tournamentId: number; userId: string; excluded: boolean }>(
    `/api/community/admin/flash-tournaments/${id}/exclude`,
    { method: "POST", body: JSON.stringify({ userId, excluded, reason }) },
  );
}
export async function adminHideContributions(ids: number[], hidden: boolean) {
  return apiFetch<{ success: boolean; updated: number; hidden: boolean }>("/api/m/x/contributions/hide", { method: "POST", body: JSON.stringify({ ids, hidden }) });
}
export async function adminDeleteContributions(ids: number[], deletePoints = false, recycle = true) {
  return apiFetch<{ success: boolean; deleted: number }>("/api/m/x/contributions/delete", { method: "POST", body: JSON.stringify({ ids, deletePoints, recycle }) });
}

export async function adminListSlots() {
  return apiFetch<{ slots: ScheduleSlot[] }>("/api/community/admin/slots");
}
export async function adminCreateSlot(body: {
  slot_date: string; start_min: number; end_min: number; activity: SlotActivity; languages: string[]; note?: string;
}) {
  return apiFetch<{ success: boolean; id: number }>("/api/community/admin/slots", { method: "POST", body: JSON.stringify(body) });
}
export async function adminToggleSlot(id: number, enabled: boolean) {
  return apiFetch<{ success: boolean }>(`/api/community/admin/slots/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}
export async function adminDeleteSlot(id: number) {
  return apiFetch<{ success: boolean }>(`/api/community/admin/slots/${id}`, { method: "DELETE" });
}

export async function getMyQualityFeedback() {
  return apiFetch<{ items: { id: number; source_text: string; translation: string; gained: number; max_points: number; evaluators: number; created_at: string }[] }>("/api/users/me/quality-feedback");
}

export async function updateLang(lang: string) {
  return apiFetch<{ success: boolean }>("/api/users/me/lang", {
    method: "PATCH",
    body: JSON.stringify({ lang }),
  });
}

export interface LeaderboardEntry {
  code: string;
  isMe?: boolean;
  total_contributions: number;
  total_recordings: number;
  total_validations: number;
  points: number;
  level: number;
  streak_days: number;
  contrib_pts?: number;
  eval_pts?: number;
  tag_pts?: number;
  q_gained?: number;
  q_lost?: number;
  /** HYBRID transparency: active time consumed (current window / budget / all-time)
   * + the TOTAL credit granted since the start (any unequal allocation is public). */
  credit_window_seconds?: number;
  credit_budget_seconds?: number;
  credit_total_seconds?: number;
  credit_offered_seconds?: number;
}
export interface CreditRule { budgetSeconds: number; activity: string; endsAt: string }

export async function getLeaderboard() {
  return apiFetch<{ entries: LeaderboardEntry[]; referralEnabled?: boolean; creditRule?: CreditRule; flashTournament?: FlashTournament }>("/api/users/leaderboard");
}

export interface TagType {
  id: number;
  name: string;
  name_ar: string | null;
  category: string;
  color: string;
}

export async function getTags() {
  return apiFetch<{ tags: TagType[] }>("/api/users/tags");
}

// ── Media studio (video/audio annotation) — admin ──
export interface VideoDataset { id: number; name: string; active: boolean; created_at: string; clips: number; transcribed: number }
export interface VideoClip { id: number; media_url: string; kind: string; duration_ms: number | null; start_ms: number | null; end_ms: number | null; is_active: boolean; times_transcribed: number; ingest_job_id: number | null; created_at: string }
export interface MediaJob { id: number; dataset_id: number; source: string; status: string; message: string; clips_created: number; original_url: string | null; original_kind?: string | null; speaker_name?: string | null; speaker_sex?: string | null; video_type?: string | null; created_at: string; updated_at: string }
export interface MediaSpeaker { name: string; sex: string | null; hours: number; clips: number; videos: number }
export async function mediaUpdateJob(id: number, fields: { speaker_name?: string; speaker_sex?: string; video_type?: string }) { return apiFetch<{ success: boolean }>(`/api/media/jobs/${id}`, { method: "PATCH", body: JSON.stringify(fields) }); }
export async function mediaStats() { return apiFetch<{ totalHours: number; totalClips: number; speakers: MediaSpeaker[] }>("/api/media/stats"); }
export async function mediaCleanVideo(jobId: number, afterId: number, limit = 8) { return apiFetch<{ processed: number; removed: number; kept: number; lastId: number; done: boolean }>("/api/media/clean", { method: "POST", body: JSON.stringify({ jobId, afterId, limit }) }); }
export interface MediaHistoryItem { id: number; text: string; status: string; created_at: string; clip_id: number; media_url: string; kind: string; duration_ms: number | null; dataset: string; username: string }

export async function mediaHealth() { return apiFetch<{ ytDlp: boolean }>("/api/media/health"); }
export async function mediaGetConfig() { return apiFetch<{ enabled: boolean; noSkip: boolean; mediaOnly: boolean; assist: boolean }>("/api/media/config"); }
export async function mediaSetConfig(body: { enabled?: boolean; noSkip?: boolean; mediaOnly?: boolean; assist?: boolean }) { return apiFetch<{ success: boolean }>("/api/media/config", { method: "POST", body: JSON.stringify(body) }); }
export async function getMediaMode() { return apiFetch<{ enabled: boolean; mediaOnly: boolean }>("/api/media/mode"); }
export async function mediaListDatasets() { return apiFetch<{ datasets: VideoDataset[] }>("/api/media/datasets"); }
export async function mediaCreateDataset(name: string) { return apiFetch<{ success: boolean; id: number }>("/api/media/datasets", { method: "POST", body: JSON.stringify({ name }) }); }
export async function mediaUpdateDataset(id: number, body: { name?: string; active?: boolean }) { return apiFetch<{ success: boolean }>(`/api/media/datasets/${id}`, { method: "PATCH", body: JSON.stringify(body) }); }
export async function mediaDeleteDataset(id: number) { return apiFetch<{ success: boolean }>(`/api/media/datasets/${id}`, { method: "DELETE" }); }
export async function mediaIngest(datasetId: number, url: string, kind: "video" | "audio" = "video", segLen = 60) { return apiFetch<{ success: boolean; jobId: number }>("/api/media/ingest", { method: "POST", body: JSON.stringify({ datasetId, url, kind, segLen }) }); }
export async function mediaIngestFile(datasetId: number, file: File, kind: "video" | "audio" = "video") {
  const fd = new FormData();
  fd.append("datasetId", String(datasetId));
  fd.append("kind", kind);
  fd.append("file", file);
  return apiMultipart<{ success: boolean; jobId: number }>("/api/media/ingest-file", fd);
}
// Upload WITH progress (XHR exposes upload.onprogress, unlike fetch).
export async function mediaUploadFile(
  datasetId: number, file: File, kind: "video" | "audio",
  onProgress: (pct: number) => void, segLen = 60,
): Promise<{ data: { success: boolean; jobId: number } | null; error: string | null }> {
  if (!accessToken) { const ok = await tryRestoreSession(); if (!ok) return { data: null, error: "Not authenticated" }; }
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append("datasetId", String(datasetId));
    fd.append("kind", kind);
    fd.append("segLen", String(segLen));
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/media/ingest-file`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("X-Requested-By", "elson-web");
    if (sessionApiKey) xhr.setRequestHeader("X-Api-Key", sessionApiKey);
    // Anti-stall watchdog: if there is no progress for 60s (typically Cloudflare's
    // ~100 MB cap), abort with a clear message instead of hanging.
    let lastT = Date.now(), lastLoaded = 0;
    const watch = setInterval(() => {
      if (Date.now() - lastT > 60_000) { clearInterval(watch); xhr.abort(); resolve({ data: null, error: "Upload bloqué (aucune progression depuis 60s). Le fichier dépasse probablement la limite ~100 Mo de Cloudflare — compresse-le (480p) ou colle un lien YouTube." }); }
    }, 5_000);
    const done = () => clearInterval(watch);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) { if (e.loaded > lastLoaded) { lastLoaded = e.loaded; lastT = Date.now(); } onProgress(Math.round((e.loaded / e.total) * 100)); } };
    xhr.onload = () => {
      done();
      try {
        const j = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve({ data: j, error: null });
        else resolve({ data: null, error: j.error || (xhr.status === 413 ? "Fichier trop volumineux (> ~100 Mo Cloudflare). Compresse-le." : `HTTP ${xhr.status}`) });
      } catch { resolve({ data: null, error: xhr.status === 413 ? "Fichier trop volumineux (limite ~100 Mo)." : `HTTP ${xhr.status}` }); }
    };
    xhr.onerror = () => { done(); resolve({ data: null, error: "Erreur réseau pendant l'upload" }); };
    xhr.send(fd);
  });
}
export async function mediaGetJob(id: number) { return apiFetch<{ job: MediaJob }>(`/api/media/jobs/${id}`); }
// CHUNKED upload: splits the file into 8 MB blocks (< Cloudflare's ~100 MB limit),
// sends each block with retry, then finalizes (assembly + ingestion).
export async function mediaUploadFileChunked(
  datasetId: number, file: File, kind: "video" | "audio",
  onProgress: (pct: number) => void, segLen = 30,
): Promise<{ data: { success: boolean; jobId: number } | null; error: string | null }> {
  if (!accessToken) { const ok = await tryRestoreSession(); if (!ok) return { data: null, error: "Not authenticated" }; }
  const rand = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const uploadId = rand.replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  const CHUNK = 8 * 1024 * 1024;
  const total = Math.max(1, Math.ceil(file.size / CHUNK));
  const hdrs = () => ({ Authorization: `Bearer ${accessToken}`, "X-Requested-By": "elson-web", ...(sessionApiKey ? { "X-Api-Key": sessionApiKey } : {}) });

  for (let i = 0; i < total; i++) {
    const blob = file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK));
    const fd = new FormData(); fd.append("chunk", blob, "chunk");
    let ok = false, lastErr = "";
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/media/upload-chunk?uploadId=${uploadId}&index=${i}`, { method: "POST", credentials: "include", headers: hdrs(), body: fd });
        if (res.ok) { ok = true; break; }
        if (res.status === 401) { await refreshAccessToken(); }
        lastErr = `HTTP ${res.status}`;
      } catch { lastErr = "réseau"; }
      if (!ok) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!ok) return { data: null, error: `Upload interrompu au bloc ${i + 1}/${total} (${lastErr}). Relance.` };
    onProgress(Math.round(((i + 1) / total) * 95));
  }
  try {
    const res = await fetch(`${API_URL}/api/media/ingest-chunked`, { method: "POST", credentials: "include", headers: { ...hdrs(), "Content-Type": "application/json" }, body: JSON.stringify({ uploadId, datasetId, kind, segLen, filename: file.name }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: j.error || `HTTP ${res.status}` };
    onProgress(100);
    return { data: j, error: null };
  } catch { return { data: null, error: "Échec de la finalisation de l'upload." }; }
}

export async function mediaListJobs(datasetId?: number) { return apiFetch<{ jobs: MediaJob[] }>(`/api/media/jobs${datasetId ? `?datasetId=${datasetId}` : ""}`); }
export async function mediaListClips(datasetId: number, offset = 0, limit = 60, jobId?: number) { return apiFetch<{ clips: VideoClip[]; total: number }>(`/api/media/clips?datasetId=${datasetId}&offset=${offset}&limit=${limit}${jobId ? `&jobId=${jobId}` : ""}`); }
export async function mediaDeleteClip(id: number) { return apiFetch<{ success: boolean }>(`/api/media/clips/${id}`, { method: "DELETE" }); }
export async function mediaHistory(datasetId?: number) { return apiFetch<{ items: MediaHistoryItem[] }>(`/api/media/history${datasetId ? `?datasetId=${datasetId}` : ""}`); }

// ── Contributor: media task (transcription) ──
export interface MediaTask { id: number; media_url: string; kind: string; duration_ms: number | null; aiDraft?: string }
export async function getNextMedia() { return apiFetch<{ clip: MediaTask | null; noSkip: boolean; assist?: boolean }>("/api/media/next"); }
export async function submitMediaTranscription(clipId: number, text: string, meta?: { timeMs?: number; edited?: boolean; prefilled?: boolean }) {
  return apiFetch<{ success: boolean; points: number }>("/api/media/submit", { method: "POST", body: JSON.stringify({ clipId, text, ...meta }) });
}
export async function mediaSetHoneypot(clipId: number, plantedDraft: string) { return apiFetch<{ success: boolean }>("/api/media/honeypot", { method: "POST", body: JSON.stringify({ clipId, plantedDraft }) }); }
export async function mediaRemoveHoneypot(clipId: number) { return apiFetch<{ success: boolean }>(`/api/media/honeypot/${clipId}`, { method: "DELETE" }); }
export interface MediaCheater { name: string; hp_seen: number; hp_failed: number; no_edit: number; assisted: number }
export async function mediaCheaters() { return apiFetch<{ users: MediaCheater[] }>("/api/media/cheaters"); }

// ── AI news-monitoring WhatsApp bot (admin) ──
export interface NewsConfig { digestEnabled: boolean; days: string; hour: number; target: string; hotEnabled: boolean; hotTarget: string; lastSent: string; aiBlocked?: string }
export async function newsGetConfig() { return apiFetch<NewsConfig>("/api/news/config"); }
export async function newsSetConfig(b: Partial<NewsConfig>) { return apiFetch<{ success: boolean }>("/api/news/config", { method: "POST", body: JSON.stringify(b) }); }
export async function newsGroups() { return apiFetch<{ groups: { id: string; name: string }[] }>("/api/news/groups"); }
export async function newsPreview() { return apiFetch<{ text: string }>("/api/news/preview", { method: "POST", body: "{}" }); }
export async function newsSend() { return apiFetch<{ sent: boolean; sentCount?: number; total?: number; error?: string; text?: string; reason?: string }>("/api/news/send", { method: "POST", body: "{}" }); }
export async function newsHotNow() { return apiFetch<{ count: number }>("/api/news/hot-now", { method: "POST", body: "{}" }); }

// ── Evaluation control (admin) ──
export interface EvalContributor { id: string; name: string; pending: number; eval_exempt: boolean }
export async function evalGetConfig() { return apiFetch<{ reviewersOnly: boolean; reviewersOpen: boolean; scope: string[] }>("/api/eval/config"); }
export async function evalSetConfig(b: { reviewersOnly?: boolean; reviewersOpen?: boolean; scope?: string[] }) { return apiFetch<{ success: boolean }>("/api/eval/config", { method: "POST", body: JSON.stringify(b) }); }
export async function evalContributors() { return apiFetch<{ users: EvalContributor[] }>("/api/eval/contributors"); }

// Reassembly: ordered shorts (timestamps) + their transcriptions, to reconstruct the video.
export interface ReassemblyClip { id: number; start_ms: number | null; end_ms: number | null; duration_ms: number | null; kind: string; media_url: string; transcriptions: { username: string; text: string; status: string }[] }
export async function mediaReassembly(jobId: number) { return apiFetch<{ clips: ReassemblyClip[] }>(`/api/media/reassembly?jobId=${jobId}`); }

export async function mediaDeleteClips(ids: number[]) { return apiFetch<{ success: boolean; deleted: number }>("/api/media/clips/delete", { method: "POST", body: JSON.stringify({ ids }) }); }
export async function mediaRecutClip(id: number, segLen: number) { return apiFetch<{ success: boolean; created: number; message?: string }>(`/api/media/clips/${id}/recut`, { method: "POST", body: JSON.stringify({ segLen }) }); }

// Hassaniya lexicon (validated words + frequency) — fetched once per session.
let _lexiconCache: Promise<[string, number][]> | null = null;
export async function getHassaniyaLexicon(): Promise<[string, number][]> {
  if (!_lexiconCache) {
    _lexiconCache = apiFetch<{ words: [string, number][] }>("/api/media/lexicon").then((r) => r.data?.words ?? []).catch(() => []);
  }
  return _lexiconCache;
}

// Correction by a reviewer: corrected text + re-recorded audio (optional).
export async function submitCorrection(contributionId: number, text: string, audio?: Blob | null) {
  const fd = new FormData();
  fd.append("contributionId", String(contributionId));
  fd.append("text", text);
  if (audio) fd.append("audio", audio, "review.webm");
  return apiMultipart<{ success: boolean }>("/api/validate/correct", fd);
}

// ── Page Reviewer (admin) ──
export interface ReviewItem {
  id: number;
  hassaniya_text: string;
  reviewed_text: string | null;
  audio_url: string | null;
  created_at: string;
  status: string;
  source_text: string;
  source_lang: string;
  contributor: string;
}
export interface ReviewContributor { id: string | null; name: string; pending: number; }
export async function getReviewContributors() {
  return apiFetch<{ contributors: ReviewContributor[] }>("/api/reviews/contributors");
}
export async function getReviewQueue(limit = 25, offset = 0, contributor?: string | null) {
  const c = contributor ? `&contributor=${encodeURIComponent(contributor)}` : "";
  return apiFetch<{ items: ReviewItem[]; pending: number }>(`/api/reviews/queue?limit=${limit}&offset=${offset}${c}`);
}
// ── Reviewer · VIDEO mode (segment-by-segment transcription) ──
export interface ReviewVideo { id: number; source: string | null; dataset: string; created_at: string; clips: number; transcribed: number; reviewed: number; }
export interface ReviewSegment { id: number; start_ms: number; end_ms: number; duration_ms: number; kind: string; media_url: string; reviewed_text: string | null; text: string; translation: string; ai_draft: string; ai_translation: string; transcribedBy: string | null; transcriptions: { username: string; text: string }[]; }
export async function getReviewVideos() {
  return apiFetch<{ videos: ReviewVideo[] }>("/api/reviews/videos");
}
export async function getReviewVideo(jobId: number) {
  return apiFetch<{ segments: ReviewSegment[] }>(`/api/reviews/video/${jobId}`);
}
export async function saveVideoSegment(clipId: number, fields: { text?: string; translation?: string }) {
  return apiFetch<{ success: boolean }>("/api/reviews/video/segment", { method: "POST", body: JSON.stringify({ clipId, ...fields }) });
}
export async function aiTranscribeSegment(clipId: number) {
  return apiFetch<{ text: string }>("/api/reviews/video/transcribe", { method: "POST", body: JSON.stringify({ clipId }) });
}
export async function aiTranslateSegment(clipId: number, lang: "fr" | "ar" | "en" = "fr") {
  return apiFetch<{ text: string; source: string }>("/api/reviews/video/translate", { method: "POST", body: JSON.stringify({ clipId, lang }) });
}

export async function submitReview(contributionId: number, correctedText: string, action: "approve" | "reject", audio?: Blob | null, sourceText?: string) {
  const fd = new FormData();
  fd.append("contributionId", String(contributionId));
  fd.append("correctedText", correctedText);
  fd.append("action", action);
  if (sourceText != null) fd.append("sourceText", sourceText);
  if (audio) fd.append("audio", audio, "review.webm");
  return apiMultipart<{ success: boolean }>("/api/reviews/submit", fd);
}
