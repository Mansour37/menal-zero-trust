import { config } from "../config.js";

// ── WhatsApp sender via WAHA (devlikeapro/waha) ──
// WAHA exposes POST /api/sendText { session, chatId, text } and authenticates with
// the X-Api-Key header. chatId for an individual is "<digits>@c.us" (no '+').
// When WAHA isn't configured yet (no API key / session not scanned), we log the
// code instead of sending, so the flow is testable during rollout.

function toChatId(destination: string): string {
  const value = destination.trim();
  if (/^[\w.-]+@(c|g)\.us$/i.test(value)) return value;
  return value.replace(/\D/g, "") + "@c.us";
}

function otpMessage(code: string): string {
  return (
    `*Elson* — code de vérification : *${code}*\n` +
    `الرمز: *${code}*\n\n` +
    `Il expire dans 10 minutes. Ne le partagez avec personne.\n` +
    `ينتهي خلال 10 دقائق. لا تشاركه مع أحد.`
  );
}

/**
 * Send an arbitrary WhatsApp text to a phone number. Returns { ok, error }.
 * Never throws. Used by OTP + admin broadcasts.
 */
export async function sendWhatsAppText(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!config.waha.enabled) return { ok: false, error: "waha_disabled" };
  try {
    const res = await fetch(`${config.waha.url}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.waha.apiKey },
      body: JSON.stringify({ session: config.waha.session, chatId: toChatId(phone), text }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`[WAHA] sendText ${res.status}: ${detail}`);
      return { ok: false, error: `waha_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[WAHA] sendText error:", (e as Error).message);
    return { ok: false, error: "waha_network" };
  }
}

/** Split a list of recipients (numbers and/or group ids) separated by comma/newline/semicolon. */
export function parseTargets(s: string): string[] {
  return (s || "").split(/[,\n;]+/).map((t) => t.trim()).filter(Boolean);
}

/** Send the same message to ALL recipients in the list. Never throws. */
export async function broadcastWhatsAppText(targets: string, text: string): Promise<{ ok: boolean; sent: number; total: number; error?: string }> {
  const list = parseTargets(targets);
  let sent = 0; const errs: string[] = [];
  for (const t of list) {
    const r = await sendWhatsAppText(t, text);
    if (r.ok) sent++; else errs.push(`${t}:${r.error || "err"}`);
  }
  return { ok: sent > 0, sent, total: list.length, error: errs.length ? errs.join("; ") : undefined };
}

/**
 * Send a WhatsApp OTP. Returns true if WAHA accepted the send.
 * Never throws — failures are logged and reported via the boolean.
 */
export async function sendWhatsAppOTP(phone: string, code: string): Promise<boolean> {
  if (!config.waha.enabled) {
    console.log(`[WAHA disabled] OTP ${phone} → ${code}`);
    return false;
  }
  return (await sendWhatsAppText(phone, otpMessage(code))).ok;
}

/**
 * Send a media message (image / video carry `caption`; audio goes as a voice note).
 * `fileUrl` must be reachable by the WAHA container (e.g. http://backend:4000/recordings/...).
 * Never throws.
 */
export async function sendWhatsAppMedia(
  destination: string, type: "image" | "audio" | "video", fileUrl: string, caption: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.waha.enabled) return { ok: false, error: "waha_disabled" };
  const endpoint = type === "image" ? "sendImage" : type === "video" ? "sendVideo" : "sendVoice";
  const payload: Record<string, unknown> = {
    session: config.waha.session,
    chatId: toChatId(destination),
    file: { url: fileUrl },
  };
  if (type === "image" || type === "video") payload.caption = caption;
  else payload.convert = true; // ask WAHA to transcode audio to opus for a proper voice note
  try {
    const res = await fetch(`${config.waha.url}/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.waha.apiKey },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`[WAHA] ${endpoint} ${res.status}: ${detail}`);
      return { ok: false, error: `waha_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[WAHA] ${endpoint} error:`, (e as Error).message);
    return { ok: false, error: "waha_network" };
  }
}

/** Current WAHA session state (e.g. WORKING / SCAN_QR_CODE / STARTING / FAILED), or null. */
export async function whatsappSessionStatus(): Promise<string | null> {
  if (!config.waha.enabled) return null;
  try {
    const res = await fetch(`${config.waha.url}/api/sessions/${encodeURIComponent(config.waha.session)}`, {
      headers: { "X-Api-Key": config.waha.apiKey },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: string };
    return j.status ?? null;
  } catch {
    return null;
  }
}

/** List the WhatsApp groups the linked account belongs to (id ends with @g.us). */
export async function listWhatsAppGroups(): Promise<{ id: string; subject: string; size: number }[]> {
  if (!config.waha.enabled) return [];
  try {
    const res = await fetch(`${config.waha.url}/api/${encodeURIComponent(config.waha.session)}/groups?limit=200`, {
      headers: { "X-Api-Key": config.waha.apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const arr: any[] = Array.isArray(data) ? data : Object.values(data ?? {});
    return arr
      .map((g: any) => {
        const id = typeof g.id === "string" ? g.id : (g?.id?._serialized ?? g?.id?.id ?? "");
        return { id, subject: g?.subject ?? g?.name ?? "Groupe", size: g?.size ?? (Array.isArray(g?.participants) ? g.participants.length : 0) };
      })
      .filter((g) => typeof g.id === "string" && g.id.endsWith("@g.us"));
  } catch {
    return [];
  }
}
