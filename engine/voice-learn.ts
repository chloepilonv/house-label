/**
 * Which sent emails are worth learning from, and what the model is told.
 * Selection, cleaning, redaction and language balance are pure rules here;
 * only the distilling is the model's.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export interface RawEmail {
  id?: string;
  /** YYYY-MM-DD, or "" when unknown. */
  date: string;
  /** Sender address, lower-case. "me" when the source has no headers. */
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export interface SelectedEmail extends RawEmail {
  lang: "en" | "fr" | "other";
  /** The artist's own words: quotes, signature and forwards removed, then redacted. */
  body: string;
  words: number;
}

// ── cleaning ───────────────────────────────────────────────────────────────

const QUOTE_HEADERS = [
  /^On .{6,120}wrote:\s*$/m, // Gmail EN
  /^Le .{6,120}a écrit\s*:\s*$/m, // Gmail FR
  /^-{3,} ?(Forwarded message|Message transféré) ?-{3,}/m,
  /^From: .+$/m, // Outlook-style inline header block
  /^De : .+$/m,
  /^_{10,}$/m,
];

/** The artist's own words only. */
export function cleanBody(text: string): string {
  let t = text.replace(/\r\n/g, "\n");
  // Everything after the first quoted-reply header is somebody else's email.
  for (const re of QUOTE_HEADERS) {
    const at = t.search(re);
    if (at >= 0) t = t.slice(0, at);
  }
  // The signature block. "--" is the RFC convention; the bold-star variant is
  // what Gmail's rich signatures produce in plain text.
  t = t.split(/\n--\s*\n|\n-- \n/)[0]!;
  const lines = t
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    // Gmail's "Chloé reacted via Gmail" and calendar boilerplate
    .filter((l) => !/reacted via Gmail|^\[image:|^<https?:\/\/\S+>$/.test(l.trim()));
  return lines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Nothing that names a third party's number, money or address leaves the machine. */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/(?<![\w-])\+?\d[\d\s().-]{7,}\d(?![\w-])/g, "[phone]")
    .replace(/(?:\$|€|£)\s?\d[\d,.]*(?:\s?(?:USD|CAD|EUR))?|\d[\d,.]*\s?(?:\$|€|£|USD|CAD|EUR)\b/g, "[amount]");
}

const FR = ["je", "vous", "nous", "merci", "bonjour", "est", "pour", "une", "les", "des", "que", "pas", "avec", "dans", "sur", "bien", "salut", "svp"];
const EN = ["the", "you", "and", "for", "with", "thank", "thanks", "hope", "would", "could", "this", "that", "are", "was", "hello", "best", "please"];

export function detectLang(text: string): "en" | "fr" | "other" {
  const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ']+/g) ?? [];
  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (FR.includes(w)) fr++;
    if (EN.includes(w)) en++;
  }
  if (fr === 0 && en === 0) return "other";
  return fr > en ? "fr" : "en";
}

// ── selection ──────────────────────────────────────────────────────────────

const ROBOT = /no-?reply|do-?not-?reply|notification|mailer-daemon|newsletter|support@|billing@|invoice|receipt/i;
const ROBOT_SUBJECT = /receipt|invoice|order confirmation|your (order|booking|subscription)|unsubscribe|password|verification code/i;

export interface SelectOpts {
  /** The artist's own addresses. An email FROM none of them is not theirs. */
  self: string[];
  max?: number;
  minWords?: number;
}

/**
 * The emails worth learning from: round-robin over languages, newest first
 * within each, so no language crowds out another. Capped by `max`.
 */
export function selectEmails(emails: RawEmail[], opts: SelectOpts): SelectedEmail[] {
  const self = new Set(opts.self.map((s) => s.toLowerCase()));
  const max = opts.max ?? 50;
  const minWords = opts.minWords ?? 25;
  const seen = new Set<string>();

  const kept: SelectedEmail[] = [];
  for (const e of emails) {
    const mine = e.from === "me" || self.has(e.from.toLowerCase());
    if (!mine) continue;
    const others = e.to.filter((a) => !self.has(a.toLowerCase()));
    if (e.from !== "me" && !others.length) continue; // a note to self
    if (others.some((a) => ROBOT.test(a))) continue;
    if (ROBOT_SUBJECT.test(e.subject)) continue;
    const body = redact(cleanBody(e.text));
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words < minWords) continue;
    const key = body.slice(0, 200);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...e, body, words, lang: detectLang(body) });
  }

  kept.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const byLang = new Map<string, SelectedEmail[]>();
  for (const e of kept) byLang.set(e.lang, [...(byLang.get(e.lang) ?? []), e]);
  const queues = [...byLang.values()];
  const out: SelectedEmail[] = [];
  while (out.length < max && queues.some((q) => q.length))
    for (const q of queues) if (out.length < max && q.length) out.push(q.shift()!);
  return out;
}

// ── a folder instead of Gmail ──────────────────────────────────────────────

/**
 * `.eml` files carry their own headers; `.txt` and `.md` are taken as the
 * artist's words to somebody, one email per file. A Takeout `.mbox` is not
 * parsed here — its bodies are base64 HTML more often than not.
 */
export function emailsFromFolder(dir: string): RawEmail[] {
  const out: RawEmail[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const ext = extname(name).toLowerCase();
    if (![".eml", ".txt", ".md"].includes(ext) || !statSync(path).isFile()) continue;
    const raw = readFileSync(path, "utf8");
    if (ext === ".eml") out.push(parseEml(raw, name));
    else
      out.push({
        id: name,
        date: statSync(path).mtime.toISOString().slice(0, 10),
        from: "me",
        to: [],
        subject: name.replace(/\.(txt|md)$/i, ""),
        text: raw,
      });
  }
  return out;
}

const addresses = (v: string): string[] => [...v.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0].toLowerCase());

export function parseEml(raw: string, id = ""): RawEmail {
  const [head = "", ...rest] = raw.replace(/\r\n/g, "\n").split("\n\n");
  const headers: Record<string, string> = {};
  for (const line of head.replace(/\n[ \t]+/g, " ").split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) headers[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  let text = rest.join("\n\n");
  if (/quoted-printable/i.test(headers["content-transfer-encoding"] ?? ""))
    text = text.replace(/=\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const when = headers.date ? new Date(headers.date) : null;
  return {
    id,
    date: when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 10) : "",
    from: addresses(headers.from ?? "")[0] ?? "me",
    to: [...addresses(headers.to ?? ""), ...addresses(headers.cc ?? "")],
    subject: headers.subject ?? "",
    text,
  };
}

// ── the samples ────────────────────────────────────────────────────────────

export const SAMPLE_CHARS = 700;

/**
 * Verbatim excerpts, chosen by code so a model cannot invent one:
 * round-robin over languages, newest first, cut at a paragraph boundary.
 */
export function pickSamples(emails: SelectedEmail[], n = 8): { lang: string; context: string; text: string }[] {
  const byLang = new Map<string, SelectedEmail[]>();
  for (const e of emails) byLang.set(e.lang, [...(byLang.get(e.lang) ?? []), e]);
  const queues = [...byLang.values()];
  const out: { lang: string; context: string; text: string }[] = [];
  while (out.length < n && queues.some((q) => q.length))
    for (const q of queues) {
      if (out.length >= n || !q.length) continue;
      const e = q.shift()!;
      let text = e.body;
      if (text.length > SAMPLE_CHARS) {
        const cut = text.lastIndexOf("\n\n", SAMPLE_CHARS);
        text = (cut > 200 ? text.slice(0, cut) : text.slice(0, SAMPLE_CHARS)).trimEnd() + "\n[…]";
      }
      out.push({ lang: e.lang, context: e.subject ? `re: ${e.subject}` : "sent email", text });
    }
  return out;
}

/** The `## Samples` half of voice.md, in the shape parseVoiceFile reads. */
export function renderSamples(samples: { lang: string; context: string; text: string }[]): string {
  return ["## Samples", "", ...samples.map((s) => `### ${s.lang} · ${s.context}\n${s.text}\n`)].join("\n");
}

// ── the prompt ─────────────────────────────────────────────────────────────

/** What the model is asked: the rules only. The samples are pickSamples(). */
export function buildPrompt(emails: SelectedEmail[], opts: { locale: "en" | "fr"; artistName?: string | null }): string {
  const langs = [...new Set(emails.map((e) => e.lang))].filter((l) => l !== "other");
  const who = opts.artistName ? `${opts.artistName} (the artist)` : "the artist";
  const excerpts = emails
    .map((e, i) => `--- email ${i + 1} · ${e.date || "undated"} · ${e.lang} · subject: ${e.subject || "(none)"}\n${e.body}`)
    .join("\n\n");

  return `You are writing a VOICE GUIDE for ${who}, so that every email, pitch, bio and caption drafted for them reads as theirs and not as generated. Below are ${emails.length} emails they sent, verbatim, with quotes and signatures removed and private details replaced by [email], [phone], [amount], [link].

Read for HABITS, not content: the greeting; what the first sentence does; paragraph and sentence length; punctuation tics (dashes, ellipses, exclamation marks, smileys, spacing before punctuation); how they introduce themselves; how they ask for something; how they say what is flexible; how they close and sign off; how formal each language is; the words they use often; the words a model would use that they never do. Where a habit is non-native and consistent, keep it as part of the voice.

Write the guide in ${opts.locale === "fr" ? "French" : "English"}. Languages present: ${langs.join(", ") || "unknown"}. If a language has fewer than 5 emails, say so in the first line of the guide.

Return EXACTLY this markdown and nothing else:

# Voice
<one line: how many emails, which languages, date range>

- <rule 1>
- <rule 2>
… 12 to 20 rules. Every rule is something the emails SHOW; quote the words. A rule the artist would not recognise as theirs is a guess — leave it out. Include one rule listing words they never use, and one listing their closings. Do not describe the subject lines or the file names; they are not the artist's writing.
${langs.length > 1 ? `\nThen a line "${langs[1] === "fr" ? "French" : "English"}" followed by 4 to 8 rules for that language specifically.\n` : ""}
No samples section — verbatim samples are added by the program afterwards. Stop after the last rule.

${excerpts}`;
}
