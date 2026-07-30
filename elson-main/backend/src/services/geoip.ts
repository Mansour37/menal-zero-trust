/**
 * IP geolocation lookup via ip-api.com (free tier: 45 req/min, no key needed).
 *
 * Best-effort: short timeout, in-memory cache (10 min), fail-open. The result
 * is stored in profiles.signup_geo at register time so it survives the API
 * being down later.
 */

interface GeoResult {
  status?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  asn?: string;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
  query?: string; // the IP queried
}

const cache = new Map<string, { result: GeoResult; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 2500;

export async function lookupIp(ip: string): Promise<GeoResult | null> {
  if (!ip || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "::1") {
    return { status: "private", query: ip };
  }
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    // Free tier, requires HTTP unless you use the pro endpoint
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,region,regionName,city,isp,org,as,proxy,hosting,mobile,query`,
      { signal: ac.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json() as GeoResult & { as?: string };
    const result: GeoResult = { ...data, asn: data.as };
    cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return null;
  }
}

// Simple UA parser — no dep, covers the 95% case
export function parseUserAgent(ua: string): { os: string; browser: string; device: string; mobile: boolean; bot: boolean } {
  const lc = (ua || "").toLowerCase();
  const bot = /bot|crawler|spider|curl|wget|python|axios|fetch|go-http|java\/|httpclient/.test(lc);
  const mobile = /mobi|android|iphone|ipad/.test(lc);
  let os = "Unknown";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\/[\d.]+/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/firefox\/[\d.]+/i.test(ua)) browser = "Firefox";
  else if (/safari\/[\d.]+/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";

  const device = mobile ? (/ipad/i.test(ua) ? "Tablet" : "Mobile") : "Desktop";
  return { os, browser, device, mobile, bot };
}
