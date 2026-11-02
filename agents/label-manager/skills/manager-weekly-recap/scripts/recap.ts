/**
 * The Monday recap: done last week, due this week, late, number movement and
 * one earned line. Printed or mailed, after the Plan sheet and calendar update.
 *
 *   houselabel recap                 print this week
 *   houselabel recap --sheet         rebuild the Plan sheet and the calendar, send nothing
 *   houselabel recap --send          sheet + calendar, then email it to the connected Google account
 *   houselabel recap --schedule      every Monday 08:00, on this machine
 *   houselabel recap --unschedule    stop
 *   houselabel recap --today=YYYY-MM-DD   a reproducible week
 *
 * Code because a recap is date arithmetic a model gets wrong; `cheer` is
 * rule-based so it is always true. Runs on the artist's machine, not in CI,
 * because data/artist never leaves it: `--schedule` writes a launchd job on
 * macOS and prints the crontab line elsewhere.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { openArtist } from "../../../../../data/artist/client";
import type { Lang } from "../../manager-plan-release/scripts/milestones";
import { addDays, DAY, day, gatherItems, iso, ownerLabel, splitWeek, type Item, type Project, type Week } from "./items";
import { folderUrl, syncPlanSheet } from "./plan-sheet";
import { syncTaskCalendar } from "./plan-calendar";

export { addDays, day, iso, mondayOf, splitWeek } from "./items";

// ── the data, as `compose` sees it ──────────────────────────────────────────

export interface Reading {
  platform: string;
  metric: string;
  date: string;
  value: number;
}

export interface RecapInput {
  artistName: string | null;
  lang: Lang;
  project: Project | null;
  items: Item[];
  /** Steps in the plan with no date yet. */
  undated: number;
  /** Newest first, per platform; the first two of each are used. */
  readings: Reading[];
  links?: { sheet?: string; folder?: string; root?: string };
}

export interface Recap {
  subject: string;
  text: string;
  html: string;
}

// ── words ───────────────────────────────────────────────────────────────────

const fmt = (d: Date, lang: Lang, opts: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { timeZone: "UTC", ...opts }).format(d);
const shortDay = (d: Date, lang: Lang) => fmt(d, lang, { weekday: "short", day: "numeric" });
const monthDay = (d: Date, lang: Lang) => fmt(d, lang, { month: "short", day: "numeric" });
const daysBetween = (a: Date, b: Date) => Math.round((+b - +a) / DAY);

const TYPE: Record<string, Record<Lang, string>> = {
  single: { en: "The single", fr: "Le single" },
  ep: { en: "The EP", fr: "Le EP" },
  album: { en: "The album", fr: "L'album" },
};

const T = {
  en: {
    subject: (d: string) => `Your week at the label — ${d}`,
    hi: (n: string | null) => (n ? `Hi ${n},` : "Hi,"),
    doneHead: (n: number) => (n === 1 ? "Last week you got 1 thing done." : `Last week you got ${n} things done.`),
    doneNone: "Last week nothing was ticked off — this week is a fresh start.",
    weekHead: (a: string, b: string) => `This week (${a} – ${b}):`,
    weekNone: "Nothing is due this week. A good week to clear the late list, or to rest.",
    late: (n: number) => (n === 1 ? "1 thing is late:" : `${n} things are late:`),
    next: "Coming next week:",
    undated: (n: number) => `${n} step(s) in the plan still have no date — the label manager can set them.`,
    numbers: "Your numbers:",
    out: (t: string, d: string, n: number) => (n > 0 ? `${t} comes out ${d} — ${n} day${n === 1 ? "" : "s"} to go.` : n === 0 ? `${t} is out today.` : `${t} came out ${d}, ${-n} day${-n === 1 ? "" : "s"} ago.`),
    single: (d: string, n: number) => (n > 0 ? `The single comes out ${d} — ${n} day${n === 1 ? "" : "s"}.` : ""),
    noProject: "No release is planned yet. Tell the label manager what you are working on and next Monday will have a plan in it.",
    sheet: "Open the plan", folder: "Release folder", drive: "Drive",
    tick: "Set a task's Status in the plan (To do · Done · Won't do) — next Monday's email reads it.",
    weekOf: "WEEK OF", tasks: (n: number) => `<b>${n}</b> task${n === 1 ? "" : "s"} this week`, lateChip: (n: number) => `<b>${n}</b> late`,
    inDays: (what: string, n: number) => `${what} in <b>${n}</b> day${n === 1 ? "" : "s"}`,
    priorities: "Your priorities", dayByDay: "This week, day by day", lateHead: "Late", inProgress: "[in progress]",
    sign: "— your label", you: "You",
  },
  fr: {
    subject: (d: string) => `Ta semaine au label — ${d}`,
    hi: (n: string | null) => (n ? `Salut ${n},` : "Salut,"),
    doneHead: (n: number) => (n === 1 ? "La semaine passée, tu as coché 1 chose." : `La semaine passée, tu as coché ${n} choses.`),
    doneNone: "La semaine passée, rien n'a été coché — cette semaine repart à zéro.",
    weekHead: (a: string, b: string) => `Cette semaine (${a} – ${b}) :`,
    weekNone: "Rien n'est dû cette semaine. Une bonne semaine pour vider la liste des retards, ou pour souffler.",
    late: (n: number) => (n === 1 ? "1 chose est en retard :" : `${n} choses sont en retard :`),
    next: "La semaine prochaine :",
    undated: (n: number) => `${n} étape(s) du plan n'ont pas encore de date — le label manager peut les fixer.`,
    numbers: "Tes chiffres :",
    out: (t: string, d: string, n: number) => (n > 0 ? `${t} sort le ${d} — encore ${n} jour${n === 1 ? "" : "s"}.` : n === 0 ? `${t} sort aujourd'hui.` : `${t} est sorti le ${d}, il y a ${-n} jour${-n === 1 ? "" : "s"}.`),
    single: (d: string, n: number) => (n > 0 ? `Le single sort le ${d} — encore ${n} jour${n === 1 ? "" : "s"}.` : ""),
    noProject: "Aucune sortie n'est planifiée. Dis au label manager sur quoi tu travailles et lundi prochain, il y aura un plan ici.",
    sheet: "Ouvrir le plan", folder: "Dossier de la sortie", drive: "Drive",
    tick: "Change le statut d'une tâche dans le plan (To do · Done · Won't do) — le courriel de lundi prochain le lit.",
    weekOf: "SEMAINE DU", tasks: (n: number) => `<b>${n}</b> tâche${n === 1 ? "" : "s"} cette semaine`, lateChip: (n: number) => `<b>${n}</b> en retard`,
    inDays: (what: string, n: number) => `${what} dans <b>${n}</b> jour${n === 1 ? "" : "s"}`,
    priorities: "Tes priorités", dayByDay: "Cette semaine, jour par jour", lateHead: "En retard", inProgress: "[en cours]",
    sign: "— ton label", you: "Toi",
  },
} as const;

const METRIC: Record<string, Record<Lang, string>> = {
  monthly_listeners: { en: "monthly listeners", fr: "auditeurs mensuels" },
  followers: { en: "followers", fr: "abonnés" },
  subscribers: { en: "subscribers", fr: "abonnés" },
  total_streams: { en: "streams", fr: "écoutes" },
  total_plays: { en: "plays", fr: "écoutes" },
  total_views: { en: "views", fr: "vues" },
};

/** One line chosen by what happened: never random, never flattering. */
export function cheer(p: { done: number; due: number; late: number; daysToStreet: number | null }, lang: Lang): string {
  const fr = lang === "fr";
  if (p.daysToStreet !== null && p.daysToStreet >= 0 && p.daysToStreet <= 7)
    return fr ? "C'est la semaine. Tout ce que tu as préparé sert maintenant — respire, et sors-la." : "This is the week. Everything you prepared is for now — breathe, and put it out.";
  if (p.daysToStreet !== null && p.daysToStreet < 0 && p.daysToStreet >= -14)
    return fr ? "Elle est sortie. Le travail des prochaines semaines, c'est de la faire entendre — une personne à la fois." : "It is out. The next few weeks are about getting it heard — one person at a time.";
  if (p.done >= 5) return fr ? `${p.done} choses en une semaine. Peu d'artistes tiennent ce rythme — garde-le une semaine de plus.` : `${p.done} things in one week. Few artists keep that pace — hold it one more week.`;
  if (p.done >= 1 && p.late === 0) return fr ? "Rien en retard et des choses cochées. C'est exactement à ça que ressemble une sortie qui se passe bien." : "Nothing late and things ticked off. This is exactly what a release going well looks like.";
  if (p.done >= 1) return fr ? "Tu avances. Prends la plus vieille chose en retard en premier — le reste suivra." : "You are moving. Take the oldest late item first — the rest follows.";
  if (p.late > 0) return fr ? "Une semaine vide, ça arrive. Choisis une seule chose en retard et fais-la aujourd'hui." : "An empty week happens. Pick one late item and do it today.";
  if (p.due > 0) return fr ? "La liste de cette semaine est courte. Commence par la première ligne ce matin." : "This week's list is short. Start with the first line this morning.";
  return fr ? "Rien d'urgent. Écris une chanson." : "Nothing urgent. Write a song.";
}

const who = (i: Item, lang: Lang) => (i.owner === "you" ? T[lang].you : ownerLabel(i.owner, lang));
const when = (i: Item, lang: Lang) => (i.last && +i.last !== +i.due ? `${shortDay(i.due, lang)} → ${monthDay(i.last, lang)}` : shortDay(i.due, lang));

// ── compose — pure ───────────────────────────────────────────────────────────

export function compose(input: RecapInput, today: Date): Recap {
  const lang = input.lang;
  const t = T[lang];
  const w = splitWeek(input.items, today);
  const street = input.project?.streetDate ?? null;
  const daysToStreet = street ? daysBetween(today, street) : null;
  const subject = t.subject(monthDay(w.monday, lang));
  // One column for the dates, as wide as the widest window on the page.
  const width = Math.max(10, ...[...w.week, ...w.late].map((i) => when(i, lang).length + 2));
  const line = (i: Item) => `  ${when(i, lang).padEnd(width)}${i.title}  (${who(i, lang)})${i.priority ? " ★" : ""}${i.link ? `\n  ${" ".repeat(width)}${i.link}` : ""}`;
  const numbers = numberLines(input.readings, lang);
  const encouragement = cheer({ done: w.done.length, due: w.week.length, late: w.late.length, daysToStreet }, lang);

  const out: string[] = [t.hi(input.artistName), ""];
  if (!input.project) out.push(t.noProject, "");
  else {
    if (w.done.length) {
      out.push(t.doneHead(w.done.length));
      for (const i of w.done) out.push(`  ✓ ${i.title}  (${who(i, lang)})`);
    } else out.push(t.doneNone);
    out.push("");
    out.push(t.weekHead(monthDay(w.monday, lang), monthDay(w.sunday, lang)));
    if (w.week.length) for (const i of w.week) out.push(line(i));
    else out.push(`  ${t.weekNone}`);
    out.push("");
    if (w.late.length) {
      out.push(t.late(w.late.length));
      for (const i of w.late.slice(0, 5)) out.push(line(i));
      if (w.late.length > 5) out.push(`  … +${w.late.length - 5}`);
      out.push("");
    }
    if (input.undated) out.push(t.undated(input.undated), "");
  }
  if (numbers.length) out.push(t.numbers, ...numbers.map((l) => `  ${l}`), "");
  if (input.project && street && daysToStreet !== null) {
    const single = input.project.leadSingleDate;
    if (single && daysBetween(today, single) > 0) out.push(t.single(monthDay(single, lang), daysBetween(today, single)));
    out.push(t.out(TYPE[input.project.projectType]?.[lang] ?? input.project.title, monthDay(street, lang), daysToStreet), "");
  }
  if (input.links?.sheet) out.push(`${t.sheet}: ${input.links.sheet}`, "");
  out.push(encouragement, "", t.sign);

  return { subject, text: out.join("\n"), html: composeHtml(input, w, today, numbers, encouragement) };
}

/** "Spotify 1,240 monthly listeners (+85 since Oct 12)" — one per platform, newest two readings. */
export function numberLines(readings: Reading[], lang: Lang): string[] {
  const byPlatform = new Map<string, Reading[]>();
  for (const r of readings) byPlatform.set(r.platform, [...(byPlatform.get(r.platform) ?? []), r]);
  const n = (v: number) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA").format(v);
  const out: string[] = [];
  for (const [platform, rs] of byPlatform) {
    const [now, before] = rs.sort((a, b) => b.date.localeCompare(a.date));
    if (!now) continue;
    const metric = METRIC[now.metric]?.[lang] ?? now.metric;
    let delta = "";
    if (before && before.metric === now.metric) {
      const d = now.value - before.value;
      delta = ` (${d >= 0 ? "+" : "−"}${n(Math.abs(d))} ${lang === "fr" ? "depuis le" : "since"} ${monthDay(day(before.date), lang)})`;
    }
    out.push(`${platform.charAt(0).toUpperCase()}${platform.slice(1)} ${n(now.value)} ${metric}${delta}`);
  }
  return out;
}

// ── the HTML email ──────────────────────────────────────────────────────────

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function composeHtml(input: RecapInput, w: Week, today: Date, numbers: string[], encouragement: string): string {
  const lang = input.lang;
  const t = T[lang];
  const B = "#7d2a3d", INK = "#1a1613", MUTE = "#77716a", LINE = "#eee7dd";
  const chip = (s: string) => `<span style="display:inline-block;background:#f6efe6;border-radius:999px;padding:4px 10px;margin:0 6px 6px 0;font-size:13px">${s}</span>`;
  const btn = (s: string, u?: string) => (u ? `<a href="${esc(u)}" style="display:inline-block;background:${B};color:#fff;text-decoration:none;border-radius:6px;padding:9px 14px;margin:0 6px 6px 0;font-size:14px">${s}</a>` : "");
  const row = (i: Item) =>
    `<tr><td style="padding:6px 8px 6px 0;color:${MUTE};font-size:12px;white-space:nowrap;vertical-align:top">${esc(who(i, lang))}</td>` +
    `<td style="padding:6px 0;font-size:14px;border-bottom:1px solid ${LINE}">${i.priority ? `<b style="color:${B}">★</b> ` : ""}${i.status === "In progress" ? `<span style="color:${B};font-size:12px">${t.inProgress}</span> ` : ""}` +
    `${i.link ? `<a href="${esc(i.link)}" style="color:${INK}">${esc(i.title)}</a>` : esc(i.title)}${i.note ? `<div style="color:${MUTE};font-size:12px">${esc(i.note)}</div>` : ""}</td></tr>`;
  const section = (title: string, body: string, color = INK) => `<h2 style="font-family:Georgia,serif;font-style:italic;font-weight:normal;color:${color};font-size:22px;margin:28px 0 8px">${title}</h2>${body}`;
  const table = (list: Item[]) => `<table style="width:100%;border-collapse:collapse">${list.map(row).join("")}</table>`;
  const stars = w.week.filter((i) => i.priority);
  const byDay = [...Array(7).keys()]
    .map((n) => addDays(w.monday, n))
    .map((d) => {
      const list = w.week.filter((i) => iso(i.due) === iso(d) || (n0(d) && +i.due < +w.monday));
      return list.length ? `<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${B};margin:18px 0 4px">${shortDay(d, lang)}</h3>${table(list)}` : "";
    })
    .join("");
  function n0(d: Date) { return iso(d) === iso(w.monday); }
  const nextWeek = w.later.filter((i) => +i.due <= +w.sunday + 7 * DAY);
  const p = input.project;
  const street = p?.streetDate ?? null;
  const single = p?.leadSingleDate ?? null;
  const chips = [
    single && daysBetween(today, single) >= 0 ? chip(t.inDays(lang === "fr" ? "Single" : "Single", daysBetween(today, single))) : "",
    street && daysBetween(today, street) >= 0 ? chip(t.inDays(TYPE[p!.projectType]?.[lang]?.replace(/^(The|Le|La|L')\s?/, "") ?? p!.title, daysBetween(today, street))) : "",
    p ? chip(t.tasks(w.week.length)) : "",
    w.late.length ? chip(`<span style="color:#b3261e">${t.lateChip(w.late.length)}</span>`) : "",
  ].join("");
  const numbersHtml = numbers.length ? `<p style="font-size:14px;color:${MUTE};margin:14px 0 0">${numbers.map(esc).join(" · ")}</p>` : "";
  return `<div style="background:#faf8f4;padding:24px 12px"><div style="max-width:620px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 24px;font-family:Georgia,serif;color:${INK}">
<div style="font-family:Georgia,serif;font-style:italic;font-size:30px;color:${B}">${esc((input.artistName ?? "").toUpperCase())}</div>
<div style="font-size:13px;letter-spacing:1px;color:${MUTE};margin:2px 0 14px">${t.weekOf} ${monthDay(w.monday, lang).toUpperCase()}${p ? ` · ${esc(p.title)}` : ""}</div>
<div>${chips}</div>
<div style="margin:14px 0 0">${btn(`✓ ${t.sheet}`, input.links?.sheet)}${btn(t.folder, input.links?.folder)}${btn(t.drive, input.links?.root)}</div>
${numbersHtml}
${!p ? `<p style="font-size:15px">${t.noProject}</p>` : ""}
${w.done.length ? section(t.doneHead(w.done.length), table(w.done)) : ""}
${stars.length ? section(t.priorities, table(stars)) : ""}
${p ? section(t.dayByDay, byDay || `<p style="color:${MUTE};font-size:14px">${t.weekNone}</p>`) : ""}
${w.late.length ? section(t.lateHead, table(w.late), "#b3261e") : ""}
${nextWeek.length ? section(t.next.replace(/\s?:$/, ""), table(nextWeek.slice(0, 8))) : ""}
<p style="font-size:15px;margin-top:24px">${esc(encouragement)}</p>
<p style="color:${MUTE};font-size:12px;margin-top:28px">${t.tick}</p>
</div></div>`;
}

// ── gather — the one read ───────────────────────────────────────────────────

const METRIC_COLUMNS = ["monthly_listeners", "followers", "subscribers", "total_streams", "total_plays", "total_views"] as const;

export async function gather(): Promise<RecapInput> {
  const artist = await openArtist();
  try {
    const profile = await artist.one<{ artist_name: string | null; preferred_locale: string | null }>("profile");
    const lang: Lang = profile?.preferred_locale === "fr" ? "fr" : "en";
    const { project, items } = await gatherItems(artist);
    let undated = 0;
    if (project) {
      const rows = await artist.query<{ offset_days: number | null; status: string }>("project_milestones", { project_id: project.id }, { limit: 300 });
      undated = rows.filter((r) => r.offset_days === null && r.status !== "done" && r.status !== "skipped").length;
    }
    const stats = await artist.query<Record<string, unknown> & { platform: string; date: string }>("platform_stats", {}, { orderBy: "date desc", limit: 500 });
    const seen = new Map<string, number>();
    const readings: Reading[] = [];
    for (const r of stats) {
      const k = (seen.get(r.platform) ?? 0) + 1;
      seen.set(r.platform, k);
      if (k > 2) continue;
      const metric = METRIC_COLUMNS.find((c) => r[c] !== null && r[c] !== undefined);
      if (!metric) continue;
      readings.push({ platform: r.platform, metric, date: iso(day(r.date as string)), value: Number(r[metric]) });
    }
    return { artistName: profile?.artist_name ?? null, lang, project, items, undated, readings };
  } finally {
    await artist.close();
  }
}

// ── send ────────────────────────────────────────────────────────────────────

/**
 * The send scope is requested here, not by `connect google`, so the artist
 * sees why when granting it. Same shape as `voice learn --gmail`.
 */
async function ensureGmailSend(lang: Lang): Promise<string> {
  const { status } = await import("../../../../../engine/google/store");
  const { connectViaLoopback, GMAIL_SEND_SCOPE, SCOPES } = await import("../../../../../engine/google/auth");
  const { openBrowser } = await import("../../../../../engine/google");
  const s = await status();
  if (!s.connected)
    throw new Error(lang === "fr" ? "Aucun compte Google n'est lié. Lance d'abord `houselabel connect google`." : "No Google account is connected. Run `houselabel connect google` first.");
  if (s.scopes.includes(GMAIL_SEND_SCOPE) && s.accountEmail) return s.accountEmail;
  console.log(
    lang === "fr"
      ? "\n  Pour t'envoyer le récap, le label a besoin d'une permission de plus : envoyer un courriel depuis ton compte.\n    Il ne l'utilise que pour ce récap, adressé à toi seulement. Jamais pour un pitch, jamais à quelqu'un d'autre.\n"
      : "\n  To email you the recap, the label needs one more permission: sending mail from your account.\n    It is used for this recap only, addressed to you only. Never for a pitch, never to anyone else.\n",
  );
  const r = await connectViaLoopback({
    scopes: [...SCOPES, GMAIL_SEND_SCOPE],
    onUrl: (url) => {
      console.log(`  ${url}\n`);
      void openBrowser(url);
    },
  });
  if (!r.scopes.includes(GMAIL_SEND_SCOPE) || !r.accountEmail)
    throw new Error(lang === "fr" ? "La permission d'envoi a été refusée. Rien n'a été envoyé." : "The send permission was refused. Nothing was sent.");
  return r.accountEmail;
}

// ── schedule — this machine, Monday 08:00 ───────────────────────────────────

export const REPO = resolve(import.meta.dir, "../../../../..");
const LABEL = "ai.houselabel.recap";
const PLIST = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const LOG = join(homedir(), ".houselabel", "recap.log");

export function plist(bun: string, repo: string, log: string, path: string): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${e(bun)}</string><string>run</string><string>engine/cli.ts</string><string>recap</string><string>--send</string></array>
  <key>WorkingDirectory</key><string>${e(repo)}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${e(path)}</string></dict>
  <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>${e(log)}</string>
  <key>StandardErrorPath</key><string>${e(log)}</string>
</dict>
</plist>
`;
}

export const cronLine = (bun: string, repo: string, log: string) => `0 8 * * 1 cd ${repo} && ${bun} run engine/cli.ts recap --send >> ${log} 2>&1`;

async function schedule(on: boolean): Promise<string> {
  const bun = process.execPath;
  if (process.platform !== "darwin")
    return on ? `Add this line with \`crontab -e\`:\n\n  ${cronLine(bun, REPO, LOG)}\n` : "Remove the houselabel line from `crontab -e`.";
  const run = (args: string[]) => Bun.spawn(["launchctl", ...args], { stdout: "ignore", stderr: "ignore" }).exited;
  if (!on) {
    await run(["unload", PLIST]);
    await unlink(PLIST).catch(() => {});
    return "Stopped. No more Monday recaps from this machine.";
  }
  await mkdir(join(homedir(), ".houselabel"), { recursive: true });
  await mkdir(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
  await writeFile(PLIST, plist(bun, REPO, LOG, process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"));
  await run(["unload", PLIST]);
  if ((await run(["load", PLIST])) !== 0) throw new Error(`launchctl refused ${PLIST}`);
  return `Every Monday at 08:00, this machine emails you the recap (if it is asleep, the next time it wakes).\n  Job: ${PLIST}\n  Log: ${LOG}\n  Stop: houselabel recap --unschedule`;
}

// ── the command ─────────────────────────────────────────────────────────────

export interface RecapOpts {
  sheet?: boolean;
  send?: boolean;
  schedule?: boolean;
  unschedule?: boolean;
  /** ISO day — tests and "what would next Monday say". */
  today?: string;
}

export async function recap(opts: RecapOpts = {}): Promise<void> {
  if (opts.schedule || opts.unschedule) {
    console.log(`\n  ${await schedule(!!opts.schedule)}\n`);
    return;
  }
  const input = await gather();
  const today = day(opts.today ?? new Date());

  // The sheet and the calendar first, so the email's statuses are the
  // artist's own and its buttons open something current.
  if ((opts.sheet || opts.send) && input.project) {
    const { available, ensureWorkspaceRoot } = await import("../../../../../engine/google/workspace");
    if (await available().catch(() => false)) {
      const sheet = await syncPlanSheet(input.project, input.items, input.lang);
      // "Won't do" in the sheet: off the email and off the calendar.
      input.items = input.items.filter((i) => i.status !== "Won't do");
      const rootId = await ensureWorkspaceRoot().catch(() => null);
      input.links = {
        sheet: sheet?.url,
        folder: input.project.driveFolderId ? folderUrl(input.project.driveFolderId) : undefined,
        root: rootId ? folderUrl(rootId) : undefined,
      };
      const cal = await syncTaskCalendar(input.items, input.lang).catch((err) => {
        console.error(`  ! calendar: ${(err as Error).message.split("\n")[0]}`);
        return null;
      });
      if (sheet) console.log(`\n  ✓ Plan sheet: ${sheet.rows} rows  ${sheet.url}`);
      else console.log("\n  ! No release folder in Drive yet — `houselabel drive setup` makes one; the plan sheet goes in it.");
      if (cal) console.log(`  ✓ Calendar: ${cal.created} added · ${cal.updated} updated · ${cal.deleted} removed`);
    } else console.log("\n  ! Google is not connected — printing only. `houselabel connect google` to get the sheet, the calendar and the email.");
  }

  const r = compose(input, today);
  // `--sheet` alone is the hook after `plan.ts --save`: the recap is not
  // printed. With no project, say so rather than print nothing.
  if (opts.sheet && !opts.send) {
    if (!input.project) console.log(`\n  ${T[input.lang].noProject}\n`);
    return;
  }
  if (!opts.send) {
    console.log(`\n  ${r.subject}\n`);
    console.log(r.text.replace(/^/gm, "  "), "\n");
    return;
  }
  const to = await ensureGmailSend(input.lang);
  const { sendToSelf } = await import("../../../../../engine/google/gmail-send");
  await sendToSelf(to, r.subject, r.text, r.html);
  console.log(`\n  ✓ Sent to ${to}: "${r.subject}"\n`);
}

if (import.meta.main) {
  const a = process.argv.slice(2);
  recap({
    sheet: a.includes("--sheet"),
    send: a.includes("--send"),
    schedule: a.includes("--schedule"),
    unschedule: a.includes("--unschedule"),
    today: a.find((x) => x.startsWith("--today="))?.slice(8),
  }).catch((err) => {
    console.error(`\n  ✗ ${(err as Error).message}\n`);
    process.exit(1);
  });
}
