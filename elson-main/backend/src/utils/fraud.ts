/**
 * Anti-fraud heuristics for signup attempts.
 *
 * Detects patterns typical of automated/abusive registrations:
 *  - Sequential or repeated NNI / phone digits
 *  - Username patterns (test\d+, pentest, hacker, admin\d+, bot…)
 *  - Disposable / suspicious email patterns
 *  - Identical fields across users (same fingerprint, IP, etc — checked elsewhere)
 *
 * Returns a fraud score in [0, 1] (higher = more suspicious) plus a list of
 * triggered flags for the admin email alert.
 */

const REPEATED_DIGITS = /^(\d)\1{5,}$/;        // 6+ same digit (1111111111)
const SEQUENTIAL_DIGITS = /^(?:0123456789|1234567890|9876543210|0000|1111|2222|3333|4444|5555|6666|7777|8888|9999)/;

const USERNAME_SUSPICIOUS_RE = /^(test|pentest|hacker|admin|root|bot|exploit|enumtest|sqlmap|burp|attack|fake|nuker|scrap|crawl|spam|spy)\d*$/i;
const EMAIL_SUSPICIOUS_KEYWORDS = ["pentest", "hacker", "exploit", "fake", "test+", "+test", "burp", "sqlmap", "scraper"];
// Expanded list — includes major temp mail services. Updated 2026-05-27 after spotting
// nriza.com used in a real attack.
const EMAIL_DISPOSABLE_DOMAINS = [
  "mailinator.com", "mailinator.net", "mailinator.org",
  "tempmail.com", "tempmail.org", "tempmailaddress.com",
  "10minutemail.com", "10minutemail.net", "20minutemail.com",
  "guerrillamail.com", "guerrillamail.org", "guerrillamail.net", "guerrillamail.biz",
  "yopmail.com", "yopmail.net", "yopmail.fr",
  "throwawaymail.com", "trashmail.com", "trashmail.net",
  "fakemail.net", "fakeinbox.com",
  "sharklasers.com", "getairmail.com", "dispostable.com",
  "nriza.com", "nada.email", "mohmal.com",
  "harakirimail.com", "spam4.me", "mvrht.com",
  "anonbox.net", "ezehe.com", "tempinbox.com",
  "maildrop.cc", "armyspy.com", "guerillamail.com",
  "tempr.email", "discardmail.com", "wegwerfemail.de",
];

export interface FraudResult {
  score: number;       // 0..1
  flags: string[];     // ["nni_repeated_digits", "username_pattern", ...]
  shouldReject: boolean;
  shouldAlert: boolean;
}

export interface SignupFraudInput {
  username: string;
  email: string;
  nni: string;
  whatsapp: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
  // Optional geoip enrichment from ip-api.com (proxy/hosting/country flags)
  geo?: { country?: string; countryCode?: string; proxy?: boolean; hosting?: boolean; mobile?: boolean; isp?: string };
}

export function scoreSignup(input: SignupFraudInput): FraudResult {
  const flags: string[] = [];
  let score = 0;

  // NNI patterns
  if (REPEATED_DIGITS.test(input.nni)) {
    flags.push("nni_repeated_digits");
    score += 0.35;
  } else if (SEQUENTIAL_DIGITS.test(input.nni)) {
    flags.push("nni_sequential");
    score += 0.25;
  }

  // WhatsApp patterns (strip + and country code first)
  const phoneDigits = input.whatsapp.replace(/[^\d]/g, "");
  const local = phoneDigits.startsWith("222") ? phoneDigits.slice(3) : phoneDigits;
  if (REPEATED_DIGITS.test(local) || /^(\d)\1{5,}/.test(local)) {
    flags.push("whatsapp_repeated_digits");
    score += 0.35;
  } else if (SEQUENTIAL_DIGITS.test(local)) {
    flags.push("whatsapp_sequential");
    score += 0.2;
  }

  // Username patterns
  if (USERNAME_SUSPICIOUS_RE.test(input.username)) {
    flags.push("username_suspicious_pattern");
    score += 0.4;
  }

  // Username with high digit ratio (e.g. "user9999999")
  const digitRatio = (input.username.match(/\d/g) || []).length / Math.max(1, input.username.length);
  if (digitRatio > 0.5) {
    flags.push("username_digit_heavy");
    score += 0.1;
  }

  // Email keywords
  const emailLower = input.email.toLowerCase();
  if (EMAIL_SUSPICIOUS_KEYWORDS.some((k) => emailLower.includes(k))) {
    flags.push("email_suspicious_keyword");
    score += 0.3;
  }

  // Disposable email
  const emailDomain = emailLower.split("@")[1] ?? "";
  if (EMAIL_DISPOSABLE_DOMAINS.includes(emailDomain)) {
    flags.push("email_disposable_domain");
    score += 0.45;
  }

  // Bot-like UA (curl, python, etc)
  if (input.userAgent) {
    const uaLower = input.userAgent.toLowerCase();
    if (/curl|wget|python|go-http|java\/|httpclient|axios\/|node-fetch|insomnia|postmanruntime/.test(uaLower)) {
      flags.push("ua_bot");
      score += 0.5;
    }
    if (input.userAgent.length < 30) {
      flags.push("ua_short");
      score += 0.15;
    }
  } else {
    flags.push("ua_missing");
    score += 0.2;
  }

  // No fingerprint = JS disabled or curl
  if (!input.fingerprint || input.fingerprint.length < 16) {
    flags.push("fingerprint_missing");
    score += 0.15;
  }

  // Geo-based signals (highest-confidence indicators of automated abuse)
  if (input.geo) {
    if (input.geo.proxy) {
      // Tor exits, public VPNs, and known anonymizing proxies are flagged by ip-api.com
      flags.push("geo_proxy_or_tor");
      score += 0.35;
    }
    if (input.geo.hosting) {
      // Datacenter IPs (AWS, GCP, Azure, OVH, Hetzner…) — humans don't register from datacenters
      flags.push("geo_hosting_provider");
      score += 0.35;
    }
    // Competition is Mauritania-focused. Foreign signups are suspicious (not strict — diaspora ok).
    if (input.geo.countryCode && input.geo.countryCode !== "MR") {
      flags.push(`geo_non_mauritania_${input.geo.countryCode}`);
      score += 0.15;
    }
  }

  // Clamp
  score = Math.min(1, Math.max(0, score));

  return {
    score,
    flags,
    shouldReject: score >= 0.8,    // very obviously a bot/abuse
    shouldAlert: score >= 0.4,     // worth a human look
  };
}
