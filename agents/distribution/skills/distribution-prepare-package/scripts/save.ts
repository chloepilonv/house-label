/**
 * Save the package checklist so it survives the conversation.
 *
 *   bun run .../save.ts <release title> --answers='{"audio_format":"wav","audio_specs":"24-bit / 48khz or higher","artwork_size":"1400 to 1599",...}'
 *
 * Pass the interview answers (questions.ts ids); without them every item reads "unknown".
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { openArtist } from "../../../../../data/artist/client";
import { openCatalog } from "../../../../../data/catalog/client";
import { buildChecklist, type DistributorRules, type Item } from "./checklist";

/** Look the distributor up so the checklist judges by its rules where known. */
export async function rulesFor(name: string | null | undefined): Promise<DistributorRules> {
  if (!name) return {};
  const catalog = await openCatalog().catch(() => null);
  if (!catalog) return {};
  const rows = await catalog
    .query<DistributorRules & { name: string }>("distribution_services", {}, 200)
    .catch(() => []);
  const want = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return rows.find((r) => r.name?.toLowerCase().replace(/[^a-z0-9]/g, "") === want) ?? {};
}

export interface Writer {
  upsert(table: string, row: Record<string, unknown>, conflict?: string[]): Promise<Record<string, unknown>>;
}

/**
 * Save every item, keyed on (release_id, item) so a re-check updates in place.
 */
export async function saveChecklist(w: Writer, releaseId: string, items: Item[]): Promise<number> {
  for (const i of items) {
    await w.upsert(
      "release_checklist",
      {
        release_id: releaseId,
        item: i.item,
        label: i.label,
        status: i.status,
        required: i.required,
        detail: i.detail ?? null,
        fix: i.fix ?? null,
        whose_rule: i.whose_rule,
        source: i.source ?? null,
        checked_at: new Date().toISOString(),
      },
      ["release_id", "item"],
    );
  }
  return items.length;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const answersArg = argv.find((a) => a.startsWith("--answers="));
  let answers: Record<string, unknown> = {};
  if (answersArg) {
    try {
      answers = JSON.parse(answersArg.slice("--answers=".length));
    } catch {
      console.error("✗ --answers must be JSON: the interview's answers keyed by question id");
      process.exit(1);
    }
  }
  const title = argv.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!title) {
    console.error("✗ Usage: bun run .../save.ts <release title>");
    process.exit(1);
  }
  const artist = await openArtist();
  const [release] = await artist.query<{ id: string; title: string; distributor: string | null }>(
    "releases",
    { title },
    { limit: 1 },
  );
  if (!release) {
    console.error(`✗ No release called "${title}". bun run artist:get releases`);
    process.exit(1);
  }
  const items = buildChecklist(answers, await rulesFor(release.distributor));
  const n = await saveChecklist(artist, release.id, items);
  console.log(`✓ ${n} checklist items saved for "${release.title}"`);
  console.log(`  read them back: bun run artist:brief distribution`);
  process.exit(0);
}
