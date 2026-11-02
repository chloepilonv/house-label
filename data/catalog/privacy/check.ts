/**
 * The catalog holds desks, never people.
 *
 *   bun run catalog:privacy            # list every address in catalog.sqlite that names a person; exit 1 if any
 *   bun run catalog:privacy --scrub    # replace them with a pointer to the outlet's contact page
 *
 * Desk addresses (music@, redaction@) ship; a named person's never does, even
 * if the outlet prints it. check.test.ts runs this on every `bun test`.
 *

 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { Database } from "bun:sqlite";
import { DATASETS } from "../publish/datasets";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** A local part that is a role, not a person. Prefix match, case-insensitive. */
const DESK_WORDS = [
  "info", "contact", "music", "musique", "musik", "submission", "submit", "demo", "programming", "programmation", "md", "pd", "news", "nouvelles",
  "redaction", "rédaction", "editor", "editorial", "edit", "hello", "hi", "bonjour", "press", "presse", "media", "médias", "medias", "promo", "radio",
  "station", "office", "admin", "team", "support", "help", "arts", "culture", "playlist", "booking", "tips", "desk", "mail", "general", "accueil",
  "communications", "comms", "marketing", "label", "artist", "artiste", "newmusic", "new-music", "airplay", "charts", "library", "studio", "web",
  "direction", "coordination", "secretariat", "magazine", "journal", "digital", "online", "listen", "social", "community", "campus", "sales", "ads",
  "ad", "advertising", "publisher", "feedback", "backtalk", "corrections", "calendar", "cal", "events", "listings", "reviews", "review", "pitch",
  "partnerships", "pr", "getinvolved", "entertain", "datebook", "features", "viewercontact", "newstip", "jazz", "acl", "coast", "leo", "prenom",
  "vancouver", "calgary", "edmonton", "toronto", "montreal", "montréal", "quebec", "québec", "ottawa", "halifax", "winnipeg",
];

/** Role words that appear inside a mailbox name: station call-sign mailboxes and venues. */
const DESK_PARTS = [
  "music", "musique", "news", "director", "calendar", "outreach", "digital", "publicity", "report", "pitch", "blog", "mail", "desk", "concert",
  "patrol", "psa", "haps", "comment", "vente", "classique", "anglo", "homegrown", "localsonly", "intmusic", "network", "podcast", "theatre", "theater",
  "cafe", "café", "club", "studio", "records", "media", "press", "radio", "magazine", "booking", "promo", "submit", "demo", "playlist", "editor",
  "program", "info", "contact", "office", "admin", "team", "events", "listing", "review", "culture", "arts", "ventes", "redaction", "rédaction",
];
const SHORT_ROLES = new Set(["dg", "sm", "pd", "md", "ae", "pr", "cal", "ad", "ads", "hr", "it"]);

/** macOS and Linux ship a word list; a mailbox that is a plain word (engage@, access@) is a role. */
const WORDS: Set<string> = (() => {
  try {
    return new Set(require("node:fs").readFileSync("/usr/share/dict/words", "utf8").toLowerCase().split("\n"));
  } catch {
    return new Set();
  }
})();

/** First names that are also dictionary words, seen in the catalog. Extend when the check misses one. */
const FIRST_NAMES = new Set(["rob", "fox", "kane", "chase", "marty", "andy", "evan", "lisa", "julie", "laura", "megan", "allie", "janet", "danny", "brock", "jenna", "gordy", "alyson", "marisa", "luciano", "guillermo", "david", "charles", "isi", "mike", "josh", "mitch"]);

export function isPerson(email: string, outlet = ""): boolean {
  const [rawLocal, domain] = email.split("@");
  const local = rawLocal.toLowerCase();
  // The outlet's name as the mailbox, even on gmail: americanahighways@gmail.com.
  const outletWord = outlet.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  if (outletWord.length >= 6 && (local.includes(outletWord) || outletWord.includes(local.replace(/[^a-z0-9]/g, "")))) return false;
  // A station's call-sign mailbox: chmrpd@, cjsfmusc@, ckuw@, kcr@.
  if (/^[ckw][a-z]{2,3}(pd|md|ae|music|musc|news|psa|fm|am)?$/.test(local)) return false;
  if (DESK_WORDS.some((w) => local === w || local.startsWith(w))) return false;
  // A role word anywhere in the mailbox — chmrmusicdirector@, wxpndesk@, cjsfpsa@, theatrestecatherine@ — is a desk.
  if (DESK_PARTS.some((w) => local.includes(w))) return false;
  // The outlet's own name as the mailbox (thecoast@thecoast.ca, theatrestecatherine@gmail.com) is a desk.
  const domainWord = domain.toLowerCase().split(".")[0].replace(/[^a-z0-9]/g, "");
  if (domainWord.length > 3 && !/^(gmail|outlook|hotmail|yahoo|icloud|protonmail|me)$/.test(domainWord) && (local.includes(domainWord) || domainWord.includes(local))) return false;
  if (SHORT_ROLES.has(local)) return false;
  if (FIRST_NAMES.has(local)) return true;
  // first.last, first_last, f.last: two alphabetic parts.
  if (/^[a-z]+[._][a-z]+$/.test(local)) return true;
  // A plain dictionary word is a role (engage, access, feedback); anything else short and alphabetic is a name.
  if (WORDS.has(local)) return false;
  return /^[a-z]{2,20}$/.test(local);
}

/** The datasets that ship. */
export const SHIPPED: string[] = DATASETS.map((d) => d.table);

export const REPLACEMENT = "[a named editor — see the outlet's contact page, or ask Hunter]";

export function scrubPeople(text: string, outlet = ""): string {
  return text.replace(EMAIL, (m) => (isPerson(m, outlet) ? REPLACEMENT : m));
}

export const CATALOG_FILE = "data/catalog/catalog.sqlite";

/** Every person's address in the shipped tables: `table.column  outlet  address`. Scrubs them when asked. */
export function findPeople(file = CATALOG_FILE, scrub = false): string[] {
  const db = new Database(file, scrub ? { readwrite: true } : { readonly: true });
  const found: string[] = [];
  const tables = (db.query("select name from sqlite_master where type='table'").all() as { name: string }[])
    .map((r) => r.name).filter((t) => SHIPPED.includes(t));
  for (const t of tables) {
    const cols = (db.query(`select name from pragma_table_info('${t}')`).all() as { name: string }[]).map((r) => r.name);
    const nameCol = t === "press_outlets" ? "outlet" : t === "rights_orgs" ? "acronym" : "name";
    for (const c of cols) {
      const rows = db.query(`select rowid, "${nameCol}" as outlet, "${c}" as v from ${t} where "${c}" like '%@%.%'`).all() as { rowid: number; outlet: string | null; v: unknown }[];
      for (const r of rows) {
        const people = (String(r.v).match(EMAIL) ?? []).filter((e) => isPerson(e, r.outlet ?? ""));
        if (!people.length) continue;
        for (const p of people) found.push(`${t}.${c}  ${r.outlet}  ${p}`);
        if (scrub) db.query(`update ${t} set "${c}" = ? where rowid = ?`).run(scrubPeople(String(r.v), r.outlet ?? ""), r.rowid);
      }
    }
  }
  db.close();
  return [...new Set(found)];
}

if (import.meta.main) {
  const scrub = process.argv.includes("--scrub");
  const found = findPeople(CATALOG_FILE, scrub);
  if (!found.length) {
    console.log("✓ catalog.sqlite: desks only, no person's address");
    process.exit(0);
  }
  console.log(`${scrub ? "scrubbed" : "found"} ${found.length} person address(es):`);
  for (const f of found) console.log("  " + f);
  process.exit(scrub ? 0 : 1);
}
