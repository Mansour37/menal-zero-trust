/**
 * Server-side Hassaniya validation — mirrors frontend validation
 * but is the authoritative check (frontend can be bypassed)
 */

export function isValidHassaniyaText(text: string): { valid: boolean; error: string | null } {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Please enter a translation" };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: "Translation is too short" };
  }

  // Reject Latin characters
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: "Hassaniya must be written in Arabic script, not Latin letters" };
  }

  // Must contain Arabic characters
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (!arabicRegex.test(trimmed)) {
    return { valid: false, error: "Please write in Arabic script" };
  }

  // At least 70% Arabic characters
  const nonSpace = trimmed.replace(/\s/g, "");
  const arabicChars = nonSpace.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, "");
  const ratio = arabicChars.length / nonSpace.length;

  if (ratio < 0.7) {
    return { valid: false, error: "Text must be primarily in Arabic script" };
  }

  return { valid: true, error: null };
}

export function normalizeHassaniya(text: string): string {
  let normalized = text;
  normalized = normalized.replace(/[أإآ]/g, "ا");
  normalized = normalized.normalize("NFC");
  normalized = normalized.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g, "");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}
