// ──────────────────────────────────────────────────────────────
// Elson — daily leaderboard broadcast (runs INSIDE the backend container)
//
//   1. ALWAYS: posts a fresh in-app notification (bell) to EVERYONE with the
//      live top 10 + the quality/anti-fraud message. No sending limits.
//   2. EMAIL (only if a BULK mail sender is configured via BULK_SMTP_* env):
//      sends the HTML email to every non-banned participant — used to reach &
//      re-activate dormant users. Falls back to NOTHING if BULK_SMTP_* unset,
//      so we never hammer the transactional Zoho box (which caps ~50/day).
//
//   Run daily via cron. EMAIL_TEST=1 → email only to the owner (dry-run).
// ──────────────────────────────────────────────────────────────
const db = await import("./dist/db.js");

const AR = "٠١٢٣٤٥٦٧٨٩";
const toAr = (n) => String(n).padStart(2, "0").split("").map((d) => AR[+d]).join("");
const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

const top = await db.query("SELECT username FROM leaderboard ORDER BY points DESC LIMIT 10");
const names = top.map((u) => u.username);

// ── 1) In-app notification (bell) to everyone ──────────────────
const TITLE = "🏆 لوحة الصدارة اليومية";
const listText = top.map((u, i) => `${toAr(i + 1)} — ${u.username}`).join("\n");
const body =
  `المتصدّرون اليوم:\n${listText}\n\n` +
  `واصِلوا — الجودة أهمّ من الكمّية. خُذوا وقتكم في كلّ ترجمة. ` +
  `كلّ تسجيلٍ صوتيّ يُراجَع واحداً واحداً، وعمل كلّ مشارك يُتابَع يدوياً. ` +
  `التصنيف آليّ، لكن خوارزمية تحقّقٍ لا تُبقي إلا أصحاب أفضل جودة. ` +
  `أيّ محاولة غشٍّ للصعود في التصنيف تؤدّي إلى الحظر التلقائي. الجودة هي الفيصل.`;

// keep the bell tidy: deactivate yesterday's daily card, then post a fresh one
await db.execute("UPDATE app_notifications SET is_active = false WHERE title = $1 AND is_active = true", [TITLE]);
await db.execute(
  "INSERT INTO app_notifications (title, body, level, target_user_id) VALUES ($1, $2, 'info', NULL)",
  [TITLE, body],
);
console.log(`[daily] in-app posted · top10=${names.join(",")}`);

// ── 2) Email (only if a bulk sender is configured) ─────────────
const BH = process.env.BULK_SMTP_HOST;
const BU = process.env.BULK_SMTP_USER;
const BP = process.env.BULK_SMTP_PASS;
if (!BH || !BU || !BP) {
  console.log("[daily] email skipped — BULK_SMTP_* not configured (in-app only).");
  process.exit(0);
}

const nodemailer = (await import("nodemailer")).default;
const FONT = "'Tajawal','Cairo',-apple-system,'SF Arabic','Geeza Pro','Segoe UI','Noto Naskh Arabic',Tahoma,Arial,sans-serif";
const rows = top.map((u, i) => {
  const r = i + 1, gold = r <= 3;
  const num = `<span style="font-size:${gold ? 17 : 16}px;font-weight:${gold ? 800 : 700};color:${gold ? "#b08d2e" : "#b6b0a2"};">${toAr(r)}</span>`;
  const sep = `<span style="color:${gold ? "#cfc9bb" : "#dcd7cb"};margin:0 10px;">—</span>`;
  const nm = `<span style="font-size:${gold ? 17 : 16}px;font-weight:${gold ? 700 : 500};color:${gold ? "#1f1f1f" : "#39382f"};">${esc(u.username)}</span>`;
  return `<tr><td style="padding:13px 0;${i < top.length - 1 ? "border-bottom:1px solid #f1eee6;" : ""}">${num}${sep}${nm}</td></tr>`;
}).join("");
const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ألسن</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');body,table,td,div,p,a,strong,span{font-family:${FONT} !important;}</style></head>
<body style="margin:0;padding:0;background:#efece3;direction:rtl;-webkit-font-smoothing:antialiased;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efece3;"><tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:${FONT};">
<tr><td style="height:3px;background:#0e4d3a;font-size:0;line-height:3px;">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:46px 44px 40px;">
<div style="font-size:22px;font-weight:800;color:#0e4d3a;">ألسن</div>
<div style="font-size:10.5px;font-weight:700;color:#a09a8c;letter-spacing:3px;margin-top:5px;">تحدّي اللهجة الحسّانية</div>
<div style="font-size:30px;font-weight:800;color:#1b1b1b;margin:34px 0 14px;">لوحة الصدارة</div>
<div style="font-size:15px;color:#6f6a5e;line-height:1.95;margin-bottom:30px;">هؤلاء هم العشرة الأوائل إلى حدّ الآن.<br>كلّ التقدير والاحترام لكلّ من يساهم بإتقانٍ وصبر:</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<div style="height:1px;background:#ece8df;margin:38px 0;"></div>
<div style="font-size:20px;font-weight:800;color:#0e4d3a;line-height:1.75;margin-bottom:20px;">الفائزون الحقيقيون هم الأكثر صبراً وإتقاناً.</div>
<div style="font-size:15.5px;color:#33322e;line-height:2.15;">إلى كلّ من يساهم: واصِلوا، فالطريق لا يزال طويلاً ولم يُحسَم شيءٌ بعد. خُذوا وقتكم في كلّ ترجمة — <strong>الجودة أهمّ من الكمّية بكثير</strong>.</div>
<div style="font-size:15.5px;color:#33322e;line-height:2.15;margin-top:18px;"><strong>كلّ تسجيلٍ صوتيّ يُراجَع واحداً واحداً</strong>، فاحرصوا على وضوح الصوت وصحّة النطق.</div>
<div style="font-size:15.5px;color:#33322e;line-height:2.15;margin-top:18px;">التصنيف الآن <strong>آليّ وفوريّ</strong>، والنقاط تُحتسب بشكلٍ إيجابي. لكن في النهاية، <strong>خوارزميةُ تحقّقٍ لا تُبقي إلا من قدّموا أفضل جودة</strong> — فالكثرة وحدها لا تكفي، الجودة هي الفيصل.</div>
<div style="font-size:15.5px;color:#33322e;line-height:2.15;margin-top:18px;">ولا تنسَوا <strong>مراجعة وتصديق عمل الآخرين</strong>، وفي جميع اللغات: فذلك يخدم المسابقة ويزيد رصيدكم من النقاط.</div>
<div style="margin-top:24px;padding:18px 20px;background:#fbf7ee;border:1px solid #ecdcb6;border-radius:12px;font-size:14.5px;color:#3a3326;line-height:2.05;">من باب الشفافية: <strong>عمل كلّ مشارك يُتابَع يدوياً</strong>. أيّ استعمالٍ غير سليم أو ترجمةٍ مغشوشة يُكتشَف، <strong>وكلّ محاولة غشٍّ للصعود في التصنيف تؤدّي إلى الحظر التلقائي من المنصّة</strong>.</div>
<div style="font-size:15.5px;color:#33322e;line-height:2.15;margin-top:24px;">نبني معاً قاعدة بيانات للهجة الحسّانية بأعلى جودة. شكراً لكلّ من يساهم بصدقٍ وإتقان.</div>
<div style="margin-top:32px;"><a href="https://elson.adst.ai" style="display:inline-block;background:#0e4d3a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:15px 40px;border-radius:6px;">واصِل المشاركة</a></div>
<div style="margin-top:34px;font-size:14px;font-weight:500;color:#9b968a;">— فريق ألسن</div>
</td></tr><tr><td style="padding:18px 6px;text-align:center;font-size:10.5px;color:#aaa498;letter-spacing:1px;">ADST &nbsp;·&nbsp; RIM&nbsp;AI</td></tr>
</table></td></tr></table></body></html>`;

const t = nodemailer.createTransport({
  host: BH, port: Number(process.env.BULK_SMTP_PORT || 587),
  secure: Number(process.env.BULK_SMTP_PORT) === 465,
  auth: { user: BU, pass: BP },
  pool: true, maxConnections: 3, rateDelta: 1000, rateLimit: 8,
});
const fromAddr = process.env.BULK_SMTP_FROM || BU;

let emails;
if (process.env.EMAIL_TEST === "1") {
  emails = ["ezeeddine.ha@gmail.com"];
} else {
  const rcpts = await db.query("SELECT email FROM users WHERE is_active = true AND email IS NOT NULL AND email <> '' AND role <> 'admin' ORDER BY created_at");
  emails = rcpts.map((r) => r.email);
}
console.log(`[daily] email via ${BH} → ${emails.length} recipients`);
let ok = 0, fail = 0;
for (const email of emails) {
  try { await t.sendMail({ from: `"Elson | ألسن" <${fromAddr}>`, to: email, subject: "ألسن — لوحة الصدارة · الجودة هي الفيصل", html }); ok++; }
  catch (e) { fail++; console.log("[daily] FAIL", email, e.message); }
}
t.close();
console.log(`[daily] email DONE sent=${ok} failed=${fail} total=${emails.length}`);
process.exit(0);
