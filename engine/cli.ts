#!/usr/bin/env bun
/**
 * houselabel — the label, in a terminal.
 *
 *   houselabel                 talk to the label manager
 *   houselabel press           go straight to one department
 *   houselabel init [--local]  first-time setup — provider, key, database
 *   houselabel profile         who you are; run it again to change anything
 *   houselabel voice           how you write — learn it from your sent mail, show it, clear it
 *   houselabel connect google  link your Drive and Calendar
 *   houselabel connect buffer  let digital-marketing save posts as Buffer drafts
 *   houselabel connect hunter  let press and promotion find the people behind an outlet
 *   houselabel drive setup     build the folder tree in your Drive
 *   houselabel example <name>         a real campaign, built in your Drive by the label's template
 *   houselabel calendar sync   put the release plan on your calendar
 *   houselabel recap           the Plan sheet, the calendar and the Monday email — --sheet, --send, --schedule
 *   houselabel --staff         who works here
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { Command } from "commander";
import { INTERNAL, listDepartments, listStaff } from "./agent";
import { bold, dim, gold } from "./banner";
import { resolveConfig, SUBSCRIPTION } from "./config";
import { connect, disconnect, printStatus } from "./google";
import { connectBuffer, disconnectBuffer, printBufferStatus } from "./buffer";
import { connectHunter, disconnectHunter, printHunterStatus } from "./hunter";
import { init } from "./init";
import { profile } from "./profile";
import { learn, voice } from "./voice";
import { repl } from "./repl";

/** The department reached when none is named: it can route a vague problem. */
const DEFAULT_DEPARTMENT = "label-manager";

async function needConfig() {
  const cfg = await resolveConfig();
  if (!cfg) {
    console.log(`\n  Not set up yet. Run ${bold("houselabel init")} first.\n`);
    process.exit(1);
  }
  return cfg;
}

const program = new Command()
  .name("houselabel")
  .description("your record label, in a terminal")
  .version("0.1.0")
  .argument("[department]", "who to talk to — omit for your label manager")
  .option("--staff", "list who works here")
  // Off by default and gitignored: recording is opted into each time.
  .option("--log", "write this conversation to .transcripts/ so a bug can be reported with evidence")
  .action(async (department: string | undefined, opts: { staff?: boolean; log?: boolean }) => {
    if (opts.staff) {
      const staff = await listStaff();
      console.log("");
      // Widths from the roster, so long slugs stay aligned.
      const w1 = Math.max(...staff.map((d) => d.name.length));
      const w2 = Math.max(...staff.map((d) => d.staffMember.length));
      for (const d of staff)
        console.log(`  ${gold(d.name.padEnd(w1))}  ${bold(d.staffMember.padEnd(w2))}  ${dim(d.department)}`);
      console.log(dim(`\n  houselabel <name> to go straight there\n`));
      return;
    }

    const name = department ?? DEFAULT_DEPARTMENT;
    const all = await listDepartments();
    if (!all.includes(name) || INTERNAL.has(name)) {
      console.log(`\n  No ${bold(name)} here. Try ${bold("houselabel --staff")}.\n`);
      process.exit(1);
    }
    const cfg = await needConfig();
    // On a subscription the departments run as Claude Code subagents, not here.
    if (cfg.provider === SUBSCRIPTION) {
      const fr = cfg.locale === "fr";
      console.log(`\n  ${fr ? "Ton label roule dans Claude Code. Dans ce dossier, tape" : "Your label runs in Claude Code. In this folder, type"} ${bold("claude")}.\n`);
      return;
    }
    await repl(name, cfg, { log: opts.log });
  });

program
  .command("init")
  .description("set up your provider, your key, and your database")
  .option("--local", "Postgres on this machine (the default — the flag is just explicit)")
  .option("--db <url>", "use a Postgres that already exists instead of starting one")
  .action((opts: { local?: boolean; db?: string }) => init(opts));

// The artist owns this row: no department may write it (ARTIST_OWNED_TABLES in
// data/artist/client.ts), so this command is the only way it changes.
program
  .command("profile")
  .description("who you are — run it again any time to change something")
  .action(() => profile());

// How the artist writes. Artist-owned like the profile: only this command
// writes it, from a file (manager-learn-voice or by hand) the artist confirms.
program
  .command("voice")
  .description("how you write — every draft follows it")
  .argument("[action]", "show | learn | set | clear", "show")
  .argument("[file]", "the markdown file, for `set`")
  .option("--gmail", "learn: read your Gmail sent folder (asks for read-only access, once)")
  .option("--from <dir>", "learn: read a folder of .eml or .txt files instead")
  .option("--max <n>", "learn: how many emails to learn from", "50")
  .option("--out <file>", "learn: where to write the guide", "voice.md")
  .option("--source <text>", 'where it came from, e.g. "38 sent emails, 2025-2026"')
  .option("--yes", "save without asking")
  .action(
    async (
      action: string,
      file: string | undefined,
      opts: { gmail?: boolean; from?: string; max: string; out: string; source?: string; yes?: boolean },
    ) => {
      if (action === "learn")
        return learn({ gmail: opts.gmail, from: opts.from, max: Number(opts.max) || 50, out: opts.out, source: opts.source, yes: opts.yes });
      if (action !== "show" && action !== "set" && action !== "clear") {
        console.log(
          `\n  Nothing called ${bold(action)}. Try ${bold("houselabel voice")}, ${bold("houselabel voice learn --gmail")}, ${bold("houselabel voice set voice.md")} or ${bold("houselabel voice clear")}.\n`,
        );
        process.exit(1);
      }
      await voice(action, { file, source: opts.source, yes: opts.yes });
    },
  );

// The artist's Google account (Drive, Calendar). Optional, so not part of `init`.
program
  .command("connect")
  .description("link an outside account — google, buffer or hunter")
  .argument("[service]", "google | buffer | hunter", "google")
  .option("--status", "show what is linked, without changing anything")
  .option("--client", "enter a different OAuth client id and secret")
  .action(async (service: string, opts: { status?: boolean; client?: boolean }) => {
    // resolveConfig exports DATABASE_URL, where the connection row is saved.
    await needConfig();
    if (opts.status) {
      await printStatus();
      await printBufferStatus();
      return printHunterStatus();
    }
    if (service === "buffer") {
      await connectBuffer();
      return;
    }
    if (service === "hunter") {
      await connectHunter();
      return;
    }
    if (service !== "google") {
      console.log(`\n  Nothing to connect called ${bold(service)}. There is ${bold("google")}, ${bold("buffer")} and ${bold("hunter")}.\n`);
      process.exit(1);
    }
    await connect({ newClient: opts.client });
  });

// The Drive folder tree, for an artist who connected Google after scoping a
// release. Calls the same functions as the normal path. Idempotent.
program
  .command("drive")
  .description("build or repair the folder tree in your Google Drive")
  .argument("[action]", "setup", "setup")
  .action(async (action: string) => {
    await needConfig();
    if (action !== "setup") {
      console.log(`\n  Nothing called ${bold(action)}. Today there is only ${bold("houselabel drive setup")}.\n`);
      process.exit(1);
    }

    const { setupWorkspace, NO_ACCOUNT } = await import("./google/workspace");
    const report = await setupWorkspace();
    if (!report) {
      console.log(`\n  ${dim(NO_ACCOUNT)}\n`);
      process.exit(1);
    }

    console.log(gold("\n  ✓ Your workspace is in Drive."));
    console.log(`  ${report.rootUrl}\n`);
    for (const r of report.releases) console.log(`  ${bold(r.title)}  ${dim(r.url)}`);
    if (report.contentFolders)
      console.log(dim(`\n  ${report.contentFolders} content folder(s) — one per thing your plan asks you to make.`));
    if (report.creditsSheets)
      console.log(
        dim(`  ${report.creditsSheets} credits sheet(s) — send one to a collaborator for their IPI, address and tax numbers.`),
      );
    for (const { title, report: r } of report.reconciled) {
      console.log(`\n  ${bold(title)} — credits sheet brought up to date:`);
      for (const x of r.renamed) console.log(dim(`    renamed   ${x.from} → ${x.to}`));
      for (const x of r.added) console.log(dim(`    added     ${x}`));
      for (const x of r.rewritten) console.log(dim(`    rewrote   ${x} (nobody had typed in it)`));
      for (const x of r.deleted) console.log(dim(`    deleted   ${x} (empty)`));
      for (const x of r.kept) console.log(`    kept      ${x.title} — ${x.reason}`);
    }
    if (!report.releases.length)
      console.log(dim("  No releases scoped yet. Talk to the label manager and this fills in."));
    console.log(dim("\n  Anything you drop in these folders, the label can read. Run this again any time.\n"));
  });

// A real campaign built in Drive by the artist template. See engine/example/.
program
  .command("example [name]")
  .description("a real campaign, built in your Drive by the label's own template — to see how a release runs here")
  .action(async (name?: string) => {
    const { installExample, listExamples } = await import("./example/example");
    const names = await listExamples();
    if (!name || !names.includes(name)) {
      console.log(names.length
        ? `\n  Which one? ${names.map((n) => bold(`houselabel example ${n}`)).join(" · ")}\n`
        : `\n  ${dim("No example campaign ships with the label yet.")}\n`);
      process.exit(name ? 1 : 0);
    }
    await needConfig();
    const { NO_ACCOUNT } = await import("./google/workspace");
    try {
      const r = await installExample(name);
      if (!r) {
        console.log(`\n  ${dim(NO_ACCOUNT)}\n`);
        process.exit(1);
      }
      console.log(gold("\n  ✓ The example is in your Drive."));
      console.log(`  ${r.rootUrl}`);
      if (r.planUrl) console.log(dim(`  Start with the Plan sheet: ${r.planUrl}`));
      if (r.media?.missing) console.log(dim(`  Media not available yet: ${r.media.missing}. The sheets are built; run it again later.`));
      else if (r.media) console.log(dim(`  Media: ${r.media.uploaded} uploaded · ${r.media.existing} already there.`));
      console.log(dim("  Run it again any time — nothing doubles.\n"));
    } catch (err) {
      console.log(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// The plan's dates on the artist's calendar, from the rows `plan.ts --save` wrote.
program
  .command("calendar")
  .description("put your release plan on your Google Calendar")
  .argument("[action]", "sync", "sync")
  .option("--project <title>", "which project — default: the latest one scoped")
  .option("--dry-run", "show the events without writing them")
  .action(async (action: string, opts: { project?: string; dryRun?: boolean }) => {
    await needConfig();
    if (action !== "sync") {
      console.log(`\n  Nothing called ${bold(action)}. Today there is only ${bold("houselabel calendar sync")}.\n`);
      process.exit(1);
    }
    const { syncPlan } = await import("../agents/label-manager/skills/manager-plan-release/scripts/calendar");
    try {
      const r = await syncPlan({ project: opts.project, write: !opts.dryRun });
      console.log(`\n  ${bold(r.project)}  ${dim(`street date ${r.streetDate}`)}\n`);
      for (const e of r.events) console.log(`  ${e.active ? " " : dim("✓")} ${dim(e.date)}  ${e.title}`);
      if (r.calendarId) {
        console.log(gold(`\n  ✓ On your calendar.`));
        console.log(dim(`  ${r.created} added · ${r.updated} updated · ${r.deleted} removed — run it again any time, nothing doubles.\n`));
      } else {
        console.log(dim(`\n  ${r.events.length} events, nothing written. Drop --dry-run to put them on your calendar.\n`));
      }
    } catch (err) {
      console.log(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

// The Monday email. Pure arithmetic over plan and campaign rows, no model,
// so it can run from launchd.
program
  .command("recap")
  .description("what got done, what is due this week, how your numbers moved")
  .option("--sheet", "rebuild the Plan sheet in your release folder and the calendar, send nothing")
  .option("--send", "email it to your connected Google account (asks for the send permission once)")
  .option("--schedule", "every Monday at 08:00, from this machine")
  .option("--unschedule", "stop the Monday email")
  .option("--today <date>", "pretend it is this day (YYYY-MM-DD)")
  .action(async (opts: { sheet?: boolean; send?: boolean; schedule?: boolean; unschedule?: boolean; today?: string }) => {
    await needConfig();
    const { recap } = await import("../agents/label-manager/skills/manager-weekly-recap/scripts/recap");
    try {
      await recap(opts);
    } catch (err) {
      console.log(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  });

program
  .command("disconnect")
  .description("unlink an outside account and revoke its token")
  .argument("[service]", "google | buffer | hunter", "google")
  .action(async (service: string) => {
    await needConfig();
    if (service === "buffer") return disconnectBuffer();
    if (service === "hunter") return disconnectHunter();
    if (service !== "google") {
      console.log(`\n  Nothing to disconnect called ${bold(service)}.\n`);
      process.exit(1);
    }
    await disconnect();
  });

await program.parseAsync(process.argv);
