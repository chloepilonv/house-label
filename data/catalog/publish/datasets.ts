/**
 * What ships in data/catalog/catalog.sqlite. Read by build.ts, load.ts and
 * client.ts. A new dataset is a line here plus its schema.sql.
 */

export type Completeness = "complete" | "partial";

export interface Dataset {
  /** Table name inside the `catalog` schema, and inside the snapshot file. */
  table: string;
  /** The agents/ folder that owns it. `null` = cross-department. */
  service: string | null;
  /**
   * Stable text identity. Child tables keyed by a regenerated uuid have none.
   */
  identity: string | null;
  /** Whole truth or a sample. Only a complete dataset lets an agent say "all". */
  completeness: Completeness;
  /** Columns withheld from catalog.sqlite (personal data cannot be un-published). */
  restricted?: string[];
}

export const DATASETS: Dataset[] = [
  // Desks only, never a person (enforced by data/catalog/privacy/check.ts).
  { table: "press_outlets",            service: "press",        identity: "slug", completeness: "partial" },
  { table: "promotion_radio_stations", service: "promotion",    identity: "slug", completeness: "partial" },
  { table: "promotion_playlists",      service: "promotion",    identity: "slug", completeness: "partial" },
  { table: "promotion_radio_services", service: "promotion",    identity: "id",   completeness: "partial" },
  { table: "promotion_pitch_services", service: "promotion",    identity: "id",   completeness: "partial" },
  { table: "distribution_services",    service: "distribution", identity: "slug", completeness: "partial" },
  { table: "distribution_stores",      service: "distribution", identity: "id",   completeness: "complete" },
  { table: "rights_orgs",              service: "rights",       identity: "id",   completeness: "partial" },
  { table: "tools",                    service: null,           identity: "id",   completeness: "complete" },
  // Not for agents: the pages the weekly crawl reads, for the topics that ship.
  { table: "crawl_sources",            service: null,           identity: "id",   completeness: "complete" },
];

