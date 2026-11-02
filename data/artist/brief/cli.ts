/**
 * The artist-data CLI an agent's Bash tool runs. A command, not a function
 * tool, so self-hosters need no MCP server.
 *
 *   bun run artist:brief press                     the common case
 *   bun run artist:brief press --release <uuid>    force the focus release
 *   bun run artist:brief --list                    which departments have rules
 *
 *   bun run artist:get releases                    precision, when the brief is not enough
 *   bun run artist:get press_pitches status=pitched --limit 5
 *   bun run artist:get releases --order "release_date desc" --json
 *
 *   bun run artist:set releases '{"title":"Nuit blanche","release_date":"2026-09-12"}' --conflict id
 *   bun run artist:remember press rejected_angles "no nostalgia framing"
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { openArtist, ARTIST_TABLES, AGENT_WRITABLE_TABLES, OWNER_COMMAND, isArtistOwned } from "../client";
import { buildBrief, renderBrief, RULES, CORE_ONLY } from "./rules";

const argv = process.argv.slice(2);
const verb = argv[0];
const rest = argv.slice(1);

/** `--flag value` and `--flag`. Positionals are whatever is left. */
function parse(args: string[]) {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else flags[name] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}

const die = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const USAGE = `artist — read and write the artist's own data.

  brief <agent> [--release <id>] [--json]   what a department needs to know
  brief --list                              which departments have a rule yet
  get <table> [col=val ...] [--limit N] [--order "col desc"] [--json]
  set <table> '<json>' --conflict <col[,col]>          not 'profile' or 'voice' — see below
  remember <agent> <key> <value> [--kind fact|answer|history] [--lang en|fr] [--source ...]

Tables: ${ARTIST_TABLES.join(", ")}
Writable: ${AGENT_WRITABLE_TABLES.join(", ")}

'profile' and 'voice' are readable but never writable here. The artist
maintains them with 'houselabel profile' and 'houselabel voice'. If a fact
belongs on one, tell the artist to run that — do not work around this by
opening the database.`;

async function main() {
  const { flags, positional } = parse(rest);

  if (!verb || verb === "help" || flags.help) {
    console.log(USAGE);
    return;
  }

  if (verb === "brief" && flags.list) {
    const shaped = Object.keys(RULES).filter((a) => !CORE_ONLY.includes(a));
    console.log(`Departments with a shaping rule: ${shaped.join(", ")}`);
    console.log(`Core profile + memory by design:  ${CORE_ONLY.length ? CORE_ONLY.join(", ") : "none"}`);
    console.log(`\nEvery department under agents/ has an entry. Adding one means adding a`);
    console.log(`Rule in data/artist/brief/rules.ts — rules.test.ts fails otherwise.`);
    return;
  }

  // Artist-owned tables are refused in code, before connecting.
  if (verb === "set" && isArtistOwned(positional[0] ?? ""))
    die(
      `artist.${positional[0]} belongs to the artist — departments read it, never write it.\n` +
        `  If they told you something that belongs on it, say so and let them run '${OWNER_COMMAND[positional[0] as keyof typeof OWNER_COMMAND]}'.\n` +
        `  Writable tables: ${AGENT_WRITABLE_TABLES.join(", ")}`,
    );

  const artist = await openArtist();
  try {
    switch (verb) {
      case "brief": {
        const agent = positional[0] ?? die("brief needs a department: `artist:brief press`");
        const brief = await buildBrief(artist, agent, {
          releaseId: typeof flags.release === "string" ? flags.release : undefined,
        });
        console.log(flags.json ? JSON.stringify(brief, null, 2) : renderBrief(brief));
        break;
      }

      case "get": {
        const table = positional[0] ?? die(`get needs a table. One of: ${ARTIST_TABLES.join(", ")}`);
        // `col=val` pairs. `col=null` filters on IS NULL, which some tables
        // and press_pitches both need (a null slug is an artist-added row).
        const filter = Object.fromEntries(
          positional.slice(1).map((p) => {
            const at = p.indexOf("=");
            if (at < 1) die(`filter must be col=value, got: ${p}`);
            const v = p.slice(at + 1);
            return [p.slice(0, at), v === "null" ? null : v];
          }),
        );
        const rows = await artist.query(table, filter, {
          orderBy: typeof flags.order === "string" ? flags.order : undefined,
          limit: typeof flags.limit === "string" ? Number(flags.limit) : undefined,
        });
        if (flags.json) console.log(JSON.stringify(rows, null, 2));
        else if (!rows.length) console.log(`(no rows in artist.${table} matching that)`);
        else console.log(rows.map((r) => JSON.stringify(r)).join("\n"));
        break;
      }

      case "set": {
        const table = positional[0] ?? die("set needs a table");
        const json = positional[1] ?? die(`set needs a JSON row: artist:set profile '{"city":"Montréal"}'`);
        // No --conflict is a plain insert (uuid-keyed tables). Single-row tables
        // pass --conflict id, keyed child tables --conflict kind,dedupe_key.
        const conflict = typeof flags.conflict === "string" ? flags.conflict.split(",").map((c) => c.trim()) : [];
        let row: Record<string, unknown>;
        try {
          row = JSON.parse(json);
        } catch {
          return die(`not valid JSON: ${json}`);
        }
        const out = await artist.upsert(table, row, conflict);
        console.log(`✓ artist.${table} ${conflict.length ? "written" : "inserted"}`);
        console.log(JSON.stringify(out, null, 2));
        break;
      }

      case "remember": {
        const [agent, key, ...valueParts] = positional;
        if (!agent || !key || !valueParts.length)
          die(`remember needs agent, key, value: artist:remember press rejected_angles "no nostalgia"`);
        await artist.remember(agent!, key!, valueParts.join(" "), {
          kind: typeof flags.kind === "string" ? (flags.kind as "fact" | "answer" | "history") : undefined,
          language: typeof flags.lang === "string" ? (flags.lang as "en" | "fr") : undefined,
          source: typeof flags.source === "string" ? flags.source : undefined,
        });
        console.log(`✓ remembered for ${agent}: ${key}`);
        break;
      }

      default:
        die(`unknown command '${verb}'.\n\n${USAGE}`);
    }
  } finally {
    await artist.close();
  }
}

await main();
