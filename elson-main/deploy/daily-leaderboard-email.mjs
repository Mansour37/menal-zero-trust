// ──────────────────────────────────────────────────────────────
// Elson — daily leaderboard email
// Runs INSIDE the backend container (has nodemailer + ./dist/db.js + SMTP env).
// Re-fetches the live top 10 each run, builds the HTML, and sends to every
// non-banned participant. Set EMAIL_TEST=1 to send only to the owner (dry-run).
// ──────────────────────────────────────────────────────────────
import nodemailer from "nodemailer";
const db = await import("./dist/db.js");

const AR = "٠١٢٣٤٥٦٧٨٩";
const toAr = (n) => String(n).padStart(2, "0").split("").map((d) => AR[+d]).join("");
const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

const top = await db.query(
  "SELECT username FROM leaderboard ORDER BY points DESC LIMIT 10",
);

const FONT = "'Tajawal','Cairo',-apple-system,'SF Arabic','Geeza Pro','Segoe UI','Noto Naskh Arabic',Tahoma,Arial,sans-serif";
const rows = top.map((u, i) => {
  const r = i + 1;
  const gold = r <= 3;
  const num = `<span style="font-size:${gold ? 17 : 16}px;font-weight:${gold ? 800 : 700};color:${gold ? "#b08d2e" : "#b6b0a2"};">${toAr(r)}</span>`;
  const sep = `<span style="color:${gold ? "#cfc9bb" : "#dcd7cb"};margin:0 10px;">—</span>`;
  const name = `<span style="font-size:${gold ? 17 : 16}px;font-weight:${gold ? 700 : 500};color:${gold ? "#1f1f1f" : "#39382f"};">${esc(u.username)}</span>`;
  const border = i < top.length - 1 ? "border-bottom:1px solid #f1eee6;" : "";
  return `<tr><td style="padding:13px 0;${border}">${num}${sep}${name}</td></tr>`;
}).join("");

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ألسن</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
body,table,td,div,p,a,strong,span{font-family:${FONT} !important;}</style></head>
<body style="margin:0;padding:0;background:#efece3;direction:rtl;-webkit-font-smoothing:antialiased;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efece3;"><tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;font-family:${FONT};">
<tr><td style="height:3px;background:#0e4d3a;line-height:3px;font-size:0;">&nbsp;</td></tr>
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
</td></tr>
<tr><td style="padding:18px 6px;text-align:center;font-size:10.5px;color:#aaa498;letter-spacing:1px;">ADST &nbsp;·&nbsp; RIM&nbsp;AI</td></tr>
</table></td></tr></table></body></html>`;

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: true, maxConnections: 1, rateDelta: 1000, rateLimit: 2,
});

let emails;
if (process.env.EMAIL_TEST === "1") {
  emails = ["ezeeddine.ha@gmail.com"];
} else {
  const rcpts = await db.query(
    "SELECT email FROM users WHERE is_active = true AND email IS NOT NULL AND email <> '' AND role <> 'admin' ORDER BY created_at",
  );
  emails = rcpts.map((r) => r.email);
}

console.log(`[daily-email] top10=${top.map((u) => u.username).join(",")} recipients=${emails.length} test=${process.env.EMAIL_TEST === "1"}`);
let ok = 0, fail = 0;
for (const email of emails) {
  try {
    await t.sendMail({ from: `"Elson | ألسن" <${process.env.SMTP_USER}>`, to: email, subject: "ألسن — لوحة الصدارة · الجودة هي الفيصل", html });
    ok++;
  } catch (e) { fail++; console.log("[daily-email] FAIL", email, e.message); }
}
t.close();
console.log(`[daily-email] DONE sent=${ok} failed=${fail} total=${emails.length}`);
process.exit(0);
