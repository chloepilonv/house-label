/**
 * `houselabel voice`: how the artist writes, as one markdown file (a guide,
 * then verbatim samples). Artist-owned (ARTIST_OWNED_TABLES in
 * data/artist/client.ts): agents write the file, only this command saves the row.
 *
 *   houselabel voice                  show what is on file
 *   houselabel voice learn --gmail    read your sent mail, write voice.md, then the `set` flow
 *   houselabel voice learn --from d/  the same from a folder of .eml/.txt you exported
 *   houselabel voice set voice.md     read the file, show it, ask, save
 *   houselabel voice clear            forget it
 *
 * `learn`'s selection, redaction and language balance are rules in
 * engine/voice-learn.ts; only the distilling is the model's.
 *
 * The file:
 *
 *   # Voice
 *   - Opens with the first name.
 *   - Signs "à bientôt".
 *
 *   ## Samples
 *   ### fr · to a booker
 *   Salut Marc, ...
 *
 *   ### en · to a curator
 *   Hi Sam, ...
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { confirm } from "@inquirer/prompts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bold, dim, gold } from "./banner";
import { KEYLESS, resolveConfig, type Config } from "./config";
import { resolveModel } from "./providers";
import { strings, type Locale } from "./strings";
import { buildPrompt, emailsFromFolder, pickSamples, renderSamples, selectEmails, type RawEmail } from "./voice-learn";
import type { VoiceSample } from "../data/artist/brief/rules";

export interface VoiceFile {
  guide: string;
  samples: VoiceSample[];
}

/**
 * Pure. The guide is everything before `## Samples`, minus a leading `# ...`
 * title; each `### lang · context` heading opens one sample. A sample with no
 * text is dropped rather than saved as an empty quote a drafter would copy.
 */
export function parseVoiceFile(text: string): VoiceFile {
  const [head = "", tail = ""] = text.split(/^##\s+samples\s*$/im, 2);
  const guide = head.replace(/^#\s[^\n]*\n?/, "").trim();

  const samples: VoiceSample[] = [];
  const parts = tail.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = (nl === -1 ? "" : part.slice(nl + 1)).trim();
    if (!body) continue;
    // Split on the first separator only, so a context like "re: Soirée" keeps its colon.
    const m = heading.match(/^([^\s·|:—-]+)\s*(?:[·|:—-]\s*(.*))?$/);
    samples.push({
      lang: (m?.[1] ?? heading).trim().toLowerCase() || null,
      context: m?.[2]?.trim() || null,
      text: body,
    });
  }
  return { guide, samples };
}

/** What `houselabel voice` prints, in both directions — after a save and on `show`. */
export function renderVoice(row: { guide: string; samples: unknown; source?: string | null; sampled_at?: unknown }): string {
  const samples = Array.isArray(row.samples) ? (row.samples as VoiceSample[]) : [];
  const out = [bold("  Voice"), ...row.guide.split("\n").map((l) => `  ${l}`), ""];
  out.push(bold(`  Samples`) + dim(` (${samples.length})`));
  for (const s of samples) {
    const tag = [s.lang, s.context].filter(Boolean).join(" · ");
    out.push(`  ${gold(tag || "sample")}`);
    out.push(...s.text.split("\n").map((l) => dim(`  │ ${l}`)), "");
  }
  if (row.source) out.push(dim(`  Learned from: ${row.source}${row.sampled_at ? ` (${String(row.sampled_at).slice(0, 10)})` : ""}`));
  return out.join("\n");
}

export async function voice(
  action: "show" | "set" | "clear",
  opts: { file?: string; source?: string; yes?: boolean } = {},
): Promise<void> {
  const cfg = await resolveConfig();
  if (!cfg) {
    console.log(`\n  ${dim("Not set up yet. Run")} ${bold("houselabel init")} ${dim("first.")}\n`);
    process.exit(1);
  }
  const t = strings((cfg.locale ?? "en") as Locale);

  const { openArtist } = await import("../data/artist/client");
  let artist;
  try {
    artist = await openArtist();
  } catch (err) {
    console.log(`\n  ${dim(t.profileNoDb!)}`);
    console.log(`  ${dim((err as Error).message.split("\n")[0])}\n`);
    process.exit(1);
  }

  try {
    const existing = await artist.one<{ guide: string; samples: unknown; source: string | null; sampled_at: unknown }>("voice", { id: 1 });

    if (action === "show") {
      if (!existing) {
        console.log(`\n  ${dim(t.voiceNone!)}`);
        console.log(`  ${bold("houselabel voice set <file.md>")} ${dim(t.voiceNoneFix!)}\n`);
        return;
      }
      console.log("\n" + renderVoice(existing) + "\n");
      return;
    }

    if (action === "clear") {
      if (!existing) return void console.log(`\n  ${dim(t.voiceNone!)}\n`);
      if (!opts.yes && !(await confirm({ message: t.voiceClearQ!, default: false }))) return;
      await artist.remove("voice", { id: 1 });
      console.log(gold(`\n  ✓ ${t.voiceCleared}\n`));
      return;
    }

    if (!opts.file) {
      console.log(`\n  ${dim(t.voiceNeedsFile!)} ${bold("houselabel voice set voice.md")}\n`);
      process.exit(1);
    }
    const parsed = parseVoiceFile(readFileSync(opts.file, "utf8"));
    if (!parsed.guide) {
      console.log(`\n  ✗ ${t.voiceEmptyGuide}\n`);
      process.exit(1);
    }
    const row = {
      id: 1,
      guide: parsed.guide,
      samples: parsed.samples, // the array itself: postgres.js sends a JS string into jsonb as a JSON *string*
      source: opts.source ?? existing?.source ?? null,
      sampled_at: opts.source ? new Date().toISOString().slice(0, 10) : (existing?.sampled_at ?? null),
    };

    console.log("\n" + renderVoice({ ...row, samples: parsed.samples }) + "\n");
    if (!parsed.samples.length) console.log(`  ${dim(t.voiceNoSamples!)}\n`);
    // Always asked: this is the artist's one look before departments copy it.
    if (!opts.yes && !(await confirm({ message: existing ? t.voiceReplaceQ! : t.voiceSaveQ!, default: true }))) {
      console.log(dim(`\n  ${t.voiceNotSaved}\n`));
      return;
    }
    await artist.upsert("voice", row, ["id"]);
    console.log(gold(`\n  ✓ ${existing ? t.voiceUpdated : t.voiceSaved}.`));
    console.log(dim(`  ${t.voiceWhoReads}\n`));
  } finally {
    await artist.close();
  }
}

// ── learn ──────────────────────────────────────────────────────────────────

export interface LearnOpts {
  gmail?: boolean;
  from?: string;
  max?: number;
  out?: string;
  yes?: boolean;
  source?: string;
}

/**
 * The Gmail read scope is requested here, not by `connect google`, so only
 * artists who run this grant it.
 */
async function ensureGmailRead(t: Record<string, string>): Promise<string[]> {
  const { status } = await import("./google/store");
  const { connectViaLoopback, GMAIL_READONLY_SCOPE, SCOPES } = await import("./google/auth");
  const { openBrowser } = await import("./google");
  const s = await status();
  if (!s.connected) {
    console.log(`\n  ${dim(t.learnNotConnected!)} ${bold("houselabel connect google")}\n`);
    process.exit(1);
  }
  const self = s.accountEmail ? [s.accountEmail] : [];
  if (s.scopes.includes(GMAIL_READONLY_SCOPE)) return self;

  console.log(`\n  ${bold(t.learnScopeHead!)}\n`);
  for (const line of t.learnScopeWhy!.split("|")) console.log(dim(`    ${line}`));
  console.log("");
  const r = await connectViaLoopback({
    scopes: [...SCOPES, GMAIL_READONLY_SCOPE],
    onUrl: (url) => {
      console.log(dim(`  ${t.learnOpening}\n`));
      console.log(`  ${url}\n`);
      void openBrowser(url);
    },
  });
  if (!r.scopes.includes(GMAIL_READONLY_SCOPE)) {
    console.log(`\n  ✗ ${t.learnScopeRefused}\n`);
    process.exit(1);
  }
  return r.accountEmail ? [r.accountEmail] : self;
}

export async function learn(opts: LearnOpts = {}): Promise<void> {
  const cfg = await resolveConfig();
  if (!cfg) {
    console.log(`\n  ${dim("Not set up yet. Run")} ${bold("houselabel init")} ${dim("first.")}\n`);
    process.exit(1);
  }
  const locale = (cfg.locale ?? "en") as Locale;
  const t = strings(locale);
  if (!opts.gmail && !opts.from) {
    console.log(`\n  ${dim(t.learnNeedsSource!)}`);
    console.log(`  ${bold("houselabel voice learn --gmail")}      ${dim(t.learnGmailWhat!)}`);
    console.log(`  ${bold("houselabel voice learn --from <dir>")} ${dim(t.learnFolderWhat!)}\n`);
    process.exit(1);
  }
  const max = opts.max ?? 50;

  // 1. collect — deterministic
  let raw: RawEmail[];
  let self: string[] = [];
  if (opts.gmail) {
    self = await ensureGmailRead(t);
    const { listSent } = await import("./google/gmail-read");
    process.stdout.write(`\n  ${dim(t.learnReading!)}`);
    try {
      raw = await listSent(max * 3, (n, total) => process.stdout.write(`\r  ${dim(`${t.learnReading} ${n}/${total}`)}`));
    } catch (err) {
      const msg = (err as Error).message;
      console.log(`\n\n  ✗ ${msg}`);
      if (/accessNotConfigured|has not been used|is disabled/i.test(msg))
        console.log(dim(`  ${t.learnEnableApi} https://console.cloud.google.com/apis/library/gmail.googleapis.com\n`));
      process.exit(1);
    }
    console.log("");
  } else {
    raw = emailsFromFolder(resolve(opts.from!));
  }
  const picked = selectEmails(raw, { self, max });
  const count = (l: string) => picked.filter((e) => e.lang === l).length;
  if (!picked.length) {
    console.log(`\n  ✗ ${t.learnNone}\n`);
    process.exit(1);
  }
  console.log(`\n  ${bold(`${picked.length} ${t.learnPicked}`)} ${dim(`(en ${count("en")} · fr ${count("fr")}${count("other") ? ` · other ${count("other")}` : ""})`)}`);
  if (picked.length < 10) console.log(dim(`  ${t.learnThin}`));

  // 2. consent — the emails leave the machine here, and nowhere else
  const local = KEYLESS.includes(cfg.provider);
  console.log(dim(`  ${local ? t.learnStaysLocal : `${t.learnGoesTo} ${cfg.provider}.`}`));
  if (!opts.yes && !(await confirm({ message: t.learnSendQ!, default: true }))) {
    console.log(dim(`\n  ${t.voiceNotSaved}\n`));
    return;
  }

  // 3. distil — the model's part
  const { generateText } = await import("ai");
  const { openArtist } = await import("../data/artist/client");
  let artistName: string | null = null;
  try {
    const a = await openArtist();
    artistName = ((await a.one<{ artist_name?: string }>("profile", { id: 1 }))?.artist_name as string) ?? null;
    await a.close();
  } catch {
    /* no profile yet is fine — the guide just says "the artist" */
  }
  process.stdout.write(`  ${dim(t.learnWriting!)}`);
  let text: string;
  try {
    ({ text } = await generateText({
      model: resolveModel(cfg as Config, "deep"),
      prompt: buildPrompt(picked, { locale, artistName }),
      maxOutputTokens: 6000,
    }));
  } catch (err) {
    // The provider's failure, in one line: quota, key, network.
    console.log(`\n\n  ✗ ${cfg.provider}: ${(err as Error).message.split("\n")[0]}\n`);
    process.exit(1);
  }
  console.log("");
  // Drop any samples the model wrote; verbatim ones are appended by code.
  const rules = text
    .trim()
    .replace(/^```(?:markdown)?\n?|\n?```$/g, "")
    .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
    .split(/^##\s+samples\s*$/im)[0]!
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  const guide = `${rules}\n\n${renderSamples(pickSamples(picked))}`;
  if (!parseVoiceFile(guide).guide) {
    console.log(`\n  ✗ ${t.learnBadOutput}\n`);
    process.exit(1);
  }

  // 4. the file, then the same set flow as a hand-written one
  const out = resolve(opts.out ?? "voice.md");
  if (existsSync(out) && !opts.yes && !(await confirm({ message: `${t.learnOverwriteQ} ${out}`, default: false }))) {
    console.log(dim(`\n  ${t.voiceNotSaved}\n`));
    return;
  }
  writeFileSync(out, guide + "\n");
  console.log(`  ${gold("✓")} ${t.learnWrote} ${bold(out)}\n`);
  const dates = picked.map((e) => e.date).filter(Boolean).sort();
  const source =
    opts.source ?? `${picked.length} sent emails${dates.length ? `, ${dates[0]!.slice(0, 7)} to ${dates.at(-1)!.slice(0, 7)}` : ""}`;
  await voice("set", { file: out, source, yes: opts.yes });
}
