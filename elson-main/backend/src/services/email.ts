/**
 * Email service via Zoho SMTP.
 */

// @ts-ignore
import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

// Sec-audit fix #8: escape any user-controlled string before inserting into HTML templates.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Reject CRLF in subjects (prevent SMTP header injection).
function safeSubject(s: string): string {
  return s.replace(/[\r\n]+/g, " ").slice(0, 250);
}

// ── Simple, clean layout ──
function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

  <!-- Header -->
  <tr><td style="padding-bottom:24px;">
    <span style="font-size:16px;font-weight:700;color:#111;">Elson Hassaniya</span>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#fff;border-radius:8px;border:1px solid #e4e4e7;padding:32px;">
    ${body}
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:24px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;">ADST — African Digital Services & Technologies</p>
    <p style="margin:0;font-size:11px;color:#a1a1aa;">Nouakchott, Mauritanie &middot; <a href="https://adst.io" style="color:#71717a;">adst.io</a> &middot; <a href="mailto:contact@adst.io" style="color:#71717a;">contact@adst.io</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Send email verification code after registration.
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  username: string,
): Promise<boolean> {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#111;">Bonjour ${escapeHtml(username)},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
      Pour activer votre compte et participer a la competition Elson Hassaniya, entrez ce code de verification :
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <span style="display:inline-block;background:#f4f4f5;border:1px solid #d4d4d8;border-radius:6px;padding:12px 32px;font-size:28px;font-weight:700;letter-spacing:0.3em;color:#111;font-family:monospace;">${code}</span>
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#71717a;">Ce code est valable 30 minutes. Si vous n'avez pas cree de compte, ignorez cet email.</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;">
    <p dir="rtl" style="margin:0;font-size:13px;line-height:1.7;color:#71717a;text-align:right;">
      مرحبا ${escapeHtml(username)}، لتفعيل حسابك أدخل الرمز أعلاه. صالح لمدة 30 دقيقة.
    </p>`;

  try {
    await transporter.sendMail({
      from: `"Elson Hassaniya" <${config.smtp.user}>`,
      to,
      subject: safeSubject("Code de verification — Elson Hassaniya"),
      html: layout(body),
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Verification send failed:", err);
    return false;
  }
}

/**
 * Send a password reset email with a 6-digit code.
 */
export async function sendPasswordResetEmail(
  to: string,
  code: string,
  username: string,
): Promise<boolean> {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#111;">Bonjour ${escapeHtml(username)},</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
      Vous avez demande la reinitialisation de votre mot de passe. Voici votre code :
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <span style="display:inline-block;background:#f4f4f5;border:1px solid #d4d4d8;border-radius:6px;padding:12px 32px;font-size:28px;font-weight:700;letter-spacing:0.3em;color:#111;font-family:monospace;">${code}</span>
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#71717a;">Ce code est valable 15 minutes. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;">
    <p dir="rtl" style="margin:0;font-size:13px;line-height:1.7;color:#71717a;text-align:right;">
      مرحبا ${escapeHtml(username)}، هذا رمز إعادة تعيين كلمة المرور. صالح لمدة 15 دقيقة. إذا لم تطلب ذلك، تجاهل هذا البريد.
    </p>`;

  try {
    await transporter.sendMail({
      from: `"Elson Hassaniya" <${config.smtp.user}>`,
      to,
      subject: safeSubject("Reinitialisation du mot de passe — Elson Hassaniya"),
      html: layout(body),
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Reset send failed:", err);
    return false;
  }
}

/**
 * Send a welcome email after email verification.
 */
export async function sendWelcomeEmail(
  to: string,
  username: string,
): Promise<boolean> {
  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#111;">Bonjour ${escapeHtml(username)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
      Votre email est confirme. Vous pouvez maintenant participer a la competition Elson Hassaniya et etre eligible aux prix.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">
      Commencez a traduire et enregistrer des phrases en Hassaniya pour accumuler des points.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${config.publicBaseUrl}/contribute" style="display:inline-block;background:#111;color:#fff;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">Commencer</a>
    </p>
    <p style="margin:0 0 0;font-size:13px;color:#71717a;">
      Prix : 1er 60 000 MRU &middot; 2e 30 000 MRU &middot; 3e 10 000 MRU
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0;">
    <p dir="rtl" style="margin:0;font-size:13px;line-height:1.7;color:#71717a;text-align:right;">
      مرحبا ${escapeHtml(username)}، تم تأكيد بريدك. يمكنك الآن المشاركة في مسابقة ألسن الحسانية.
    </p>`;

  try {
    await transporter.sendMail({
      from: `"Elson Hassaniya" <${config.smtp.user}>`,
      to,
      subject: safeSubject("Bienvenue — Elson Hassaniya"),
      html: layout(body),
    });
    return true;
  } catch (err) {
    console.error("[EMAIL] Welcome send failed:", err);
    return false;
  }
}

/**
 * Send a competition notification (admin-triggered broadcast or targeted).
 * Plain-text body is wrapped in the standard layout. A {{username}} placeholder
 * in the body is replaced by the recipient's username.
 */
export async function sendCompetitionNotification(
  to: string,
  username: string,
  subject: string,
  bodyText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Personalize and escape — body is plain text from admin input, never raw HTML
  const personalized = bodyText.replace(/\{\{username\}\}/g, username);
  const escaped = personalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const body = `
    <p style="margin:0 0 16px;font-size:15px;color:#111;">Bonjour ${escapeHtml(username)},</p>
    ${paragraphs}
    <p style="margin:24px 0 0;text-align:center;">
      <a href="${config.publicBaseUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;">Ouvrir Elson</a>
    </p>`;

  try {
    await transporter.sendMail({
      from: `"Elson Hassaniya" <${config.smtp.user}>`,
      to,
      subject: safeSubject(subject),
      html: layout(body),
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "send failed" };
  }
}

/**
 * Verify SMTP connection on startup.
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("[EMAIL] SMTP connected");
    return true;
  } catch (err) {
    console.error("[EMAIL] SMTP connection failed:", err);
    return false;
  }
}
