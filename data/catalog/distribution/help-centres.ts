/**
 * Each distributor's help-centre root, written to `help_center_url`. The
 * distributor's own rules are the authority, and `spec_url` is only one article.
 * Every URL was opened by hand, never built from a pattern (a 403 from Zendesk
 * is bot refusal, not a missing page).
 *
 *   - in HELP_CENTRES   → a URL somebody opened.
 *   - in NO_HELP_CENTRE → confirmed none; adds `help_center_url` to `not_stated`.
 *   - in neither        → nobody looked; stays null.
 *
 * Run: bun run catalog:help-centres          (writes to the workshop; --dry to preview)
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

/** The date every URL below was last opened. Moves only when they are rechecked. */
export const HELP_CENTRES_VERIFIED = "2026-09-04";

/** id → the public help centre root. */
export const HELP_CENTRES: Record<string, string> = {
  // ── artist-facing ──
  amuse: "https://support.amuse.io/en/",
  awal: "https://awal-support.zendesk.com/hc/en-us",
  "cd-baby": "https://support.cdbaby.com/hc/en-us",
  // A bilingual FAQ page on the main site, not a ticketed help centre.
  "distribution-amplitude": "https://distributionamplitude.com/en/faq/",
  distrokid: "https://support.distrokid.com/hc/en-us",
  ditto: "https://support.dittomusic.com/en/",
  // Also a FAQ tree on the main site rather than a separate host.
  imusician: "https://imusician.pro/en/support/faqs",
  labelgrid: "https://help.labelgrid.com/en/",
  landr: "https://support.landr.com/hc/en-us",
  reverbnation: "https://help.reverbnation.com/hc/en-us",
  routenote: "https://support.routenote.com/",
  soundrop: "https://support.soundrop.com/hc/en-us",
  stem: "https://support.stem.is/hc/en-us",
  // Two rows for one company (a crawl duplicate); same URL on both.
  symphonic: "https://support.symdistro.com/hc/en-us",
  "symphonic-distribution": "https://support.symdistro.com/hc/en-us",
  "too-lost": "https://help.toolost.com/hc/en-us",
  tunecore: "https://support.tunecore.com/hc/en-us",
  unitedmasters: "https://support.unitedmasters.com/hc/en-us",
  "venice-music": "https://support.venice.tech/",

  // ── label-facing and platform ──
  // Label-facing companies rarely publish one; artists cannot sign up for these.
  fuga: "https://support.fuga.com/hc/en-us",
  sonosuite: "https://support.sonosuite.com/hc/en-us",
  "the-orchard": "https://help.theorchard.com/hc/en-us",
  vydia: "https://vydiasupport.zendesk.com/hc/en-us",
};

/**
 * id → why there is none. Needs a positive finding (support runs another way,
 * or the host is gated), not a failed search.
 */
export const NO_HELP_CENTRE: Record<string, string> = {
  "indie-pool": "Support is people and telephones by design — the company's own front page sells it that way. No article base to link.",
  onerpm: "Support is a ticket raised from inside the logged-in dashboard, plus long-form articles on blog.onerpm.com. Neither is a help centre an artist can browse before signing up.",
  audiosalad: "support.audiosalad.com exists and redirects straight to /support/login — a client-only desk, closed to anyone comparing.",
};

// ── the writer ────────────────────────────────────────────────────────────
// Everything below runs only as a script; importers get the two maps above.
if (import.meta.main) {
  const postgres = (await import("postgres")).default;
  const { workshopUrl } = await import("../workshop");

  const dry = process.argv.includes("--dry");
  const sql = postgres(workshopUrl());

  let wrote = 0, marked = 0, missing: string[] = [];

  for (const [id, url] of Object.entries(HELP_CENTRES)) {
    // Overwrite, not coalesce: this file is the checked value and beats enrich.ts.
    const rows = dry
      ? await sql`select id from catalog.distribution_services where id = ${id}`
      // Leave `last_verified` alone: checking one URL is not re-reading the row.
      : await sql`update catalog.distribution_services
                     set help_center_url = ${url}
                   where id = ${id} returning id`;
    if (rows.length) wrote++; else missing.push(id);
  }

  for (const [id, why] of Object.entries(NO_HELP_CENTRE)) {
    const rows = dry
      ? await sql`select id from catalog.distribution_services where id = ${id}`
      : await sql`update catalog.distribution_services
                     set not_stated = (select array(select distinct unnest(not_stated || array['help_center_url'])))
                   where id = ${id} returning id`;
    if (rows.length) marked++; else missing.push(id);
    if (dry) console.log(`  none: ${id} — ${why}`);
  }

  console.log(
    `${dry ? "would write" : "✓ wrote"} ${wrote} help centre(s), ` +
    `${dry ? "would mark" : "marked"} ${marked} as not published`,
  );
  if (missing.length) {
    console.log(`  ⚠ ${missing.length} id(s) not in the catalog: ${missing.join(", ")}`);
  }
  await sql.end();
}
