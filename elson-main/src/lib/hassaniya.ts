/**
 * Hassaniya Script Utilities
 * 
 * Hassaniya Arabic uses standard Arabic letters plus additional
 * modified letters for sounds that don't exist in MSA.
 */

// ── Hassaniya-specific letters ──
// These are the additional letters used in Hassaniya that differ from MSA

export const HASSANIYA_LETTERS = {
  // Letter, name, sound, description
  standard: [
    { letter: "ا", name: "Alif", sound: "a", hint: "Long 'a'" },
    { letter: "ب", name: "Ba", sound: "b", hint: "" },
    { letter: "ت", name: "Ta", sound: "t", hint: "" },
    { letter: "ث", name: "Tha", sound: "th", hint: "Like English 'th' in 'think'" },
    { letter: "ج", name: "Jim", sound: "j", hint: "Like French 'j' in Hassaniya" },
    { letter: "ح", name: "Ha", sound: "ḥ", hint: "Emphatic 'h'" },
    { letter: "خ", name: "Kha", sound: "kh", hint: "Like 'ch' in Scottish 'loch'" },
    { letter: "د", name: "Dal", sound: "d", hint: "" },
    { letter: "ذ", name: "Dhal", sound: "dh", hint: "Like English 'th' in 'this'" },
    { letter: "ر", name: "Ra", sound: "r", hint: "Rolled 'r'" },
    { letter: "ز", name: "Zay", sound: "z", hint: "" },
    { letter: "س", name: "Sin", sound: "s", hint: "" },
    { letter: "ش", name: "Shin", sound: "sh", hint: "" },
    { letter: "ص", name: "Sad", sound: "ṣ", hint: "Emphatic 's'" },
    { letter: "ض", name: "Dad", sound: "ḍ", hint: "Emphatic 'd'" },
    { letter: "ط", name: "Ta", sound: "ṭ", hint: "Emphatic 't'" },
    { letter: "ظ", name: "Dha", sound: "ẓ", hint: "Emphatic 'dh'" },
    { letter: "ع", name: "Ayn", sound: "ʿ", hint: "Voiced pharyngeal" },
    { letter: "غ", name: "Ghayn", sound: "gh", hint: "Like French 'r'" },
    { letter: "ف", name: "Fa", sound: "f", hint: "" },
    { letter: "ق", name: "Qaf", sound: "q", hint: "Deep 'k' from the throat" },
    { letter: "ك", name: "Kaf", sound: "k", hint: "" },
    { letter: "ل", name: "Lam", sound: "l", hint: "" },
    { letter: "م", name: "Mim", sound: "m", hint: "" },
    { letter: "ن", name: "Nun", sound: "n", hint: "" },
    { letter: "ه", name: "Ha", sound: "h", hint: "Light 'h'" },
    { letter: "و", name: "Waw", sound: "w/ū", hint: "Also long 'u'" },
    { letter: "ي", name: "Ya", sound: "y/ī", hint: "Also long 'i'" },
  ],
  // Hassaniya-specific modified letters
  hassaniya: [
    { letter: "گ", name: "Gaf", sound: "g", hint: "Hard 'g' as in 'go' — ك with extra stroke", example: "گاع (gāʿ = land)" },
  ],
  // Common diacritical marks
  diacritics: [
    { letter: "َ", name: "Fatha", sound: "a", hint: "Short 'a' vowel mark" },
    { letter: "ُ", name: "Damma", sound: "u", hint: "Short 'u' vowel mark" },
    { letter: "ِ", name: "Kasra", sound: "i", hint: "Short 'i' vowel mark" },
    { letter: "ْ", name: "Sukun", sound: "—", hint: "No vowel (consonant stop)" },
    { letter: "ّ", name: "Shadda", sound: "—", hint: "Doubles the consonant" },
  ]
};


// ── Input Validation ──

/**
 * Check if text contains ONLY Arabic script characters.
 * Allows: Arabic letters, Arabic punctuation, diacritics, spaces, 
 * common punctuation (.!?), digits, and Hassaniya-specific chars.
 * Rejects: Latin letters, CJK, Cyrillic, etc.
 */
export function isValidHassaniyaText(text: string): { valid: boolean; error: string | null } {
  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: "Please enter a translation" };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: "Translation is too short" };
  }

  // Check for Latin characters (a-z, A-Z)
  const latinRegex = /[a-zA-Z]/;
  if (latinRegex.test(trimmed)) {
    return { valid: false, error: "Hassaniya must be written in Arabic script, not Latin letters" };
  }

  // Check that text contains at least some Arabic characters
  // Arabic Unicode ranges:
  //   \u0600-\u06FF  Arabic
  //   \u0750-\u077F  Arabic Supplement
  //   \u08A0-\u08FF  Arabic Extended-A
  //   \uFB50-\uFDFF  Arabic Presentation Forms-A
  //   \uFE70-\uFEFF  Arabic Presentation Forms-B
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (!arabicRegex.test(trimmed)) {
    return { valid: false, error: "Please write in Arabic script" };
  }

  // Count Arabic characters vs total non-space characters
  const nonSpace = trimmed.replace(/\s/g, "");
  const arabicChars = nonSpace.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, "");
  const ratio = arabicChars.length / nonSpace.length;
  
  if (ratio < 0.7) {
    return { valid: false, error: "Text must be primarily in Arabic script" };
  }

  return { valid: true, error: null };
}


/**
 * Normalize common Hassaniya writing variations.
 * Maps common substitutions to their correct Hassaniya forms.
 */
export function normalizeHassaniya(text: string): string {
  let normalized = text;

  // Normalize common substitutions:
  // Some people write ك (kaf) when they mean گ (gaf)
  // We can't auto-correct this since both are valid — 
  // but we can normalize other things:

  // Normalize different forms of alef
  normalized = normalized.replace(/[أإآ]/g, "ا"); // Normalize hamza-alefs to plain alef

  // Normalize taa marbuta at end of words to haa (common in Hassaniya)
  // ة → ه at end of words — this is actually a Hassaniya convention in some dialects
  // But we should NOT auto-normalize this since both are used

  // Normalize Unicode presentation forms to standard Arabic
  // This handles copy-paste from different sources
  normalized = normalized.normalize("NFC");

  // Remove zero-width characters that might be pasted
  normalized = normalized.replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g, "");

  // Normalize multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}
