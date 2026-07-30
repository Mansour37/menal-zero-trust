import "dotenv/config";
import http from "http";

function req(method: string, path: string, body?: any, token?: string): Promise<any> {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers: Record<string, string> = { "Content-Type": "application/json", Origin: "https://alsun.adst.ai" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (data) headers["Content-Length"] = String(Buffer.byteLength(data));
    const r = http.request({ hostname: "localhost", port: 4000, path, method, headers }, (res) => {
      let d = ""; res.on("data", (c) => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    r.on("error", (e) => resolve({ error: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log("\n==== V3 SECURITY & FAIRNESS AUDIT ====\n");

  const admin = await req("POST", "/api/auth/login", { email: "admin@adst.ai", password: "Admin2026!Alsun" });
  const user = await req("POST", "/api/auth/login", { email: "user@adst.ai", password: "User2026!Alsun" });
  console.log("Logged in:", admin.user?.username, user.user?.username);

  // TEST 1: Submit without lock = REJECTED
  console.log("\n1. Submit without lock:");
  const noLock = await req("POST", "/api/phrases/submit", {
    phraseId: 999, hassaniyaText: "الشمس تطلع من الشرق", audioDurationMs: 3000,
  }, user.accessToken);
  console.log("   " + (noLock.error ? "PASS - Blocked: " + noLock.error : "FAIL"));

  // TEST 2: Get phrase + skip
  console.log("\n2. Phrase pipeline + skip:");
  const p1 = await req("GET", "/api/phrases/next?lang=en", null, user.accessToken);
  if (p1.phrase) {
    console.log("   Got phrase: id=" + p1.phrase.id + " phase=" + p1.phase);
    const skip = await req("POST", "/api/phrases/skip", { phraseId: p1.phrase.id }, user.accessToken);
    console.log("   Skip: " + (skip.success ? "PASS" : skip.error));
  } else {
    console.log("   No phrase: " + (p1.message || "rate limited"));
  }

  // TEST 3: Audit log
  console.log("\n3. Audit log:");
  const audit = await req("GET", "/api/users/audit-log?limit=10", null, admin.accessToken);
  console.log("   Total entries: " + audit.logs?.length);
  audit.logs?.slice(0, 5).forEach((l: any) => {
    console.log("   [" + l.action + "] " + (l.username || "?") + " -> " + (l.target_type || "") + ":" + (l.target_id || "") + " IP:" + (l.ip_address || "n/a"));
  });

  // TEST 4: Fairness dashboard
  console.log("\n4. Fairness dashboard:");
  const fair = await req("GET", "/api/users/fairness-dashboard", null, admin.accessToken);
  fair.users?.forEach((u: any) => {
    console.log("   " + u.username + " pts:" + u.points + " contrib:" + u.total_contributions +
      " approved:" + u.approved_count + " rejected:" + u.rejected_count +
      " skips24h:" + u.skips_24h + " IPs:" + u.unique_ips);
  });

  // TEST 5: Integrity
  console.log("\n5. Integrity check:");
  const integ = await req("GET", "/api/users/competition-integrity", null, admin.accessToken);
  console.log("   " + JSON.stringify(integ.stats));
  integ.pointsAudit?.forEach((p: any) => {
    console.log("   " + p.username + " pts:" + p.current_points + " min_expected:" + p.expected_min_points + " " + p.integrity_check);
  });

  // TEST 6: Collusion
  console.log("\n6. Collusion report:");
  const col = await req("GET", "/api/users/collusion-report", null, admin.accessToken);
  console.log("   Pairs: " + col.validationPairs?.length);
  col.validationPairs?.forEach((p: any) => {
    console.log("   " + p.validator_name + " -> " + p.contributor_name + " x" + p.times_validated + " avg:" + p.avg_score_given + " " + p.risk_level);
  });

  // TEST 7: Admin protection
  console.log("\n7. Admin endpoint protection:");
  const f1 = await req("GET", "/api/users/audit-log", null, user.accessToken);
  const f2 = await req("GET", "/api/users/collusion-report", null, user.accessToken);
  const f3 = await req("GET", "/api/users/fairness-dashboard", null, user.accessToken);
  console.log("   Audit log:  " + (f1.error === "Admin access required" ? "BLOCKED" : "FAIL"));
  console.log("   Collusion:  " + (f2.error === "Admin access required" ? "BLOCKED" : "FAIL"));
  console.log("   Fairness:   " + (f3.error === "Admin access required" ? "BLOCKED" : "FAIL"));

  // TEST 8: Compare translations
  console.log("\n8. Translation comparison:");
  const compare = await req("GET", "/api/users/compare/52", null, user.accessToken);
  console.log("   Phrase: " + (compare.phrase?.source_text?.substring(0, 50) || "not found"));
  console.log("   Translations: " + (compare.translations?.length ?? 0));

  console.log("\n==== ALL V3 TESTS COMPLETE ====");
}

main().catch(console.error);
