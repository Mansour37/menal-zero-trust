/**
 * WhatsApp AI watch bot.
 *  - buildDigest()   : enriched digest (news + HF model + curriculum concept + tool), WITHOUT a question.
 *  - getHotAlerts()  : only emits for MAJOR events (gpt-5.5 impact filter).
 * Deduplication via ai_news_seen (we never send the same link twice).
 */
import { query, execute, queryOne } from "../db.js";
import { sendWhatsAppText } from "./whatsapp.js";

const FEEDS = [
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://venturebeat.com/category/ai/feed/",
  "https://huggingface.co/blog/feed.xml",
  "https://techcabal.com/feed/",
  "https://www.theverge.com/rss/index.xml",
];
// Learning curriculum: one concept per edition, looped (= free mini-course).
const CONCEPTS = [
  "le RAG (Retrieval-Augmented Generation)", "le fine-tuning d'un LLM",
  "comment on entraîne un LLM (pré-entraînement vs fine-tuning vs RLHF)", "les embeddings et la recherche sémantique",
  "la quantization (faire tenir un gros modèle sur peu de mémoire)", "les agents IA (planifier + utiliser des outils)",
  "LoRA / PEFT (fine-tuner à petit budget)", "comment évaluer un LLM (benchmarks, pièges)",
  "la tokenization", "le prompt engineering avancé", "la distillation de modèle", "le contexte long et la fenêtre de contexte",
];
const UA = { "User-Agent": "Mozilla/5.0 (elson-news-bot)" };
const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();

async function cfg(key: string, def = ""): Promise<string> {
  const r = await queryOne<{ value: string }>("SELECT value FROM competition_config WHERE key = $1", [key]);
  return r?.value ?? def;
}
async function setCfg(key: string, value: string) {
  await execute("INSERT INTO competition_config (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()", [key, value]);
}

async function rawItems(): Promise<{ title: string; link: string }[]> {
  const per = await Promise.all(FEEDS.map(async (url) => {
    try {
      const r = await fetch(url, { headers: UA }); const x = await r.text();
      return [...x.matchAll(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g)].slice(0, 8).map((m) => {
        const title = clean((m[0].match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
        let link = (m[0].match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
        if (!link.trim()) link = (m[0].match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
        return { title, link: clean(link) };
      }).filter((i) => i.title && i.link);
    } catch { return []; }
  }));
  return per.flat();
}
async function unseen(items: { title: string; link: string }[]) {
  if (!items.length) return [];
  const rows = await query<{ link: string }>("SELECT link FROM ai_news_seen WHERE link = ANY($1)", [items.map((i) => i.link)]);
  const seen = new Set(rows.map((r) => r.link));
  return items.filter((i) => !seen.has(i.link));
}
async function markSeen(links: string[]) {
  for (const l of [...new Set(links)]) await execute("INSERT INTO ai_news_seen (link) VALUES ($1) ON CONFLICT DO NOTHING", [l]);
}
const linksIn = (t: string) => t.match(/https?:\/\/[^\s)]+/g) || [];

async function hfTrending(): Promise<string[]> {
  try { const r = await fetch("https://huggingface.co/api/models?sort=trendingScore&limit=6", { headers: UA }); const a = await r.json(); return (a || []).map((m: any) => m.id || m.modelId).filter(Boolean); } catch { return []; }
}
// Disable the bot (digest + hot) when the OpenAI quota is exhausted, and warn once.
async function disableForQuota() {
  const was = await cfg("news_ai_blocked", "");
  await setCfg("news_digest_enabled", "false");
  await setCfg("news_hot_enabled", "false");
  await setCfg("news_ai_blocked", new Date().toISOString());
  if (!was) {
    const target = (await cfg("news_target", "")).trim();
    if (target) await sendWhatsAppText(target, "⚠️ *Veille IA désactivée* : le quota OpenAI est épuisé. Recharge la clé puis réactive le bot dans l'admin.");
    console.warn("[NEWS] OpenAI quota épuisé → bot désactivé automatiquement");
  }
}
async function gpt(input: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY; if (!key) return "";
  try {
    const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5.5", input }) });
    if (!r.ok) {
      const j: any = await r.json().catch(() => ({}));
      const blob = (j?.error?.code || "") + " " + (j?.error?.type || "") + " " + JSON.stringify(j).slice(0, 200);
      if (r.status === 429 && /insufficient_quota|exceeded your current quota|billing/i.test(blob)) await disableForQuota();
      return "";
    }
    const j: any = await r.json();
    return (j.output_text || (j.output || []).flatMap((o: any) => o.content || []).map((c: any) => c.text).filter(Boolean).join("\n") || "").trim();
  } catch { return ""; }
}
const noDash = (t: string) => t.replace(/\s+[—–]\s+/g, " : ").replace(/[—–]/g, "-");

/** Build today's digest (or null if nothing new). commit=true → marks as seen + advances the curriculum. */
export async function buildDigest(commit = true): Promise<string | null> {
  const fresh = await unseen(await rawItems());
  if (fresh.length < 2 && commit) return null; // slow day → skip (except in preview)
  const hf = await hfTrending();
  const idx = parseInt(await cfg("news_concept_idx", "0"), 10) || 0;
  const concept = CONCEPTS[idx % CONCEPTS.length];
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const prompt = `Tu es l'éditeur d'une veille IA pédagogique pour une communauté africaine sur WhatsApp.
Rédige l'édition du jour en FRANÇAIS, format WhatsApp, SECTIONS exactes :

🧠 *Veille IA · LLM & GenAI*
🗓️ ${date}

📰 *L'actu*
(3 brèves : *titre* + une phrase + 🔗 lien)

🤗 *Le modèle Hugging Face du jour*
(UN modèle pertinent de la liste, à quoi il sert et pour qui, + 🔗 https://huggingface.co/<id>)

🎓 *Le concept à maîtriser : ${concept}*
(explique-le SIMPLEMENT en 2 à 4 phrases, niveau débutant motivé, exemple concret)

🛠️ *À tester cette semaine*
(un outil/librairie/astuce concrète, une phrase, + 🔗 si dispo)

RÈGLES : focalise LLM/GenAI ; mets les VRAIS liens fournis ; PAS de question finale ; INTERDIT tout tiret long (— ou –), utilise ":" "," ou parenthèses ; court et concret.

NEWS (titre | lien) :
${fresh.slice(0, 25).map((i) => `- ${i.title} | ${i.link}`).join("\n")}

MODÈLES HF TENDANCE :
${hf.map((id) => `- ${id}`).join("\n")}`;
  const text = noDash(await gpt(prompt));
  if (!text) return null;
  if (commit) { await markSeen(linksIn(text)); await setCfg("news_concept_idx", String((idx + 1) % CONCEPTS.length)); }
  return text;
}

/** Returns 0..N alerts for MAJOR events only. Marks alerted links as seen. */
export async function getHotAlerts(max = 2): Promise<string[]> {
  const fresh = await unseen(await rawItems());
  if (!fresh.length) return [];
  const prompt = `Voici des titres d'actu IA récents (titre | lien). Identifie UNIQUEMENT les événements VRAIMENT MAJEURS et à fort impact (sortie/fermeture d'un grand modèle, acquisition majeure, régulation importante, incident de sécurité grave, percée notable). Ignore tout le reste.
Réponds en JSON STRICT : {"alerts":[{"line":"<une phrase percutante en français, sans tiret long>","link":"<lien exact>"}]} (tableau vide si rien de majeur).
TITRES :
${fresh.slice(0, 30).map((i) => `- ${i.title} | ${i.link}`).join("\n")}`;
  const raw = await gpt(prompt);
  let alerts: { line: string; link: string }[] = [];
  try { const m = raw.match(/\{[\s\S]*\}/); alerts = m ? (JSON.parse(m[0]).alerts || []) : []; } catch { alerts = []; }
  const out: string[] = [];
  for (const a of alerts.slice(0, max)) {
    if (!a?.line || !a?.link) continue;
    out.push(`🚨 *Alerte IA*\n${noDash(a.line)}\n🔗 ${a.link}`);
    await markSeen([a.link]);
  }
  return out;
}
