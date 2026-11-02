/**
 * The workshop: a throwaway Postgres (named by CATALOG_DATABASE_URL) where the
 * crawler, seeds and enrichers write. The catalog itself is catalog.sqlite;
 * the workshop is loaded from it (`catalog:load`) and exported back (`catalog:build`).
 *

 * Author: Chloe Bibiane Pilon Vaillancourt
 */
export function workshopUrl(): string {
  const url = process.env.CATALOG_DATABASE_URL;
  if (!url)
    throw new Error(
      "CATALOG_DATABASE_URL is unset — it names the workshop Postgres the crawler writes into.\n" +
        "  Start one (docker compose up -d), then `bun run catalog:load` to fill it from catalog.sqlite.",
    );
  return url;
}
