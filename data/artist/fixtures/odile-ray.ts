/**
 * Odile Ray: an invented test artist, shaped like a `houselabel profile` row.
 * Each property breaks an easy assumption: solo (no members), Québec-based but
 * selling in QC, CA and US, four disciplines, and a rap-to-folk genre pivot.
 * Profile only (no links, releases or songs), so the near-empty path is the default.
 * Not a seed: loaded only by `bun run artist:fixture`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Member } from "../members";

export interface Fixture {
  /** The database this is meant to live in, and what `artist:fixture` creates. */
  slug: string;
  profile: Record<string, unknown>;
  platforms: { platform: string; url: string }[];
}

const MEMBERS: Member[] = [];

export const odileRay: Fixture = {
  slug: "odile_ray",
  profile: {
    id: 1,
    artist_name: "Odile Ray",
    artist_type: "solo",
    members: JSON.stringify(MEMBERS),
    project_description:
      "Sound engineer who released several rap albums, before pivoting to an upcoming folk EP.",
    languages: ["en"],
    preferred_locale: "en",
    country: "CA",
    region: "QC",
    city: "Montreal",
    citizenship: ["CA"],
    target_markets: ["QC", "CA", "US"],
    genres: ["folk acoustic"],
    disciplines: ["songwriter", "performer", "producer", "composer"],
    career_stage: "mid-career",
    timezone: "America/Toronto",
  },
  platforms: [],
};

export const FIXTURES: Record<string, Fixture> = { "odile-ray": odileRay };
