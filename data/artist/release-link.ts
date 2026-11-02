/**
 * Creates the artist.releases row for each artist.projects record, since
 * departments read releases, not projects. Keyed on `projects.release_id`, so
 * re-running heals an older project instead of adding a second release.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type postgres from "postgres";

export interface ProjectLike {
  id: string;
  title: string;
  project_type: string;
  street_date: string | Date | null;
  release_id?: string | null;
}

export interface ReleaseRow {
  title: string;
  release_type: "single" | "ep" | "album";
  release_date: string | null;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : ((v as string | null) ?? null));

/**
 * The release a project describes, or null when it is not a record (a `tour`
 * never gets a release row).
 */
export function releaseRowFor(p: Pick<ProjectLike, "title" | "project_type" | "street_date">): ReleaseRow | null {
  if (p.project_type !== "single" && p.project_type !== "ep" && p.project_type !== "album") return null;
  return { title: p.title, release_type: p.project_type, release_date: iso(p.street_date) };
}

/**
 * Make the project's release row exist and match, and point the project at it.
 * Returns the release id, or null for a project that is not a record.
 */
export async function ensureReleaseForProject(sql: postgres.Sql, p: ProjectLike): Promise<string | null> {
  const row = releaseRowFor(p);
  if (!row) return null;

  if (p.release_id) {
    const [kept] = await sql`
      update artist.releases set title = ${row.title}, release_type = ${row.release_type},
             release_date = ${row.release_date}
       where id = ${p.release_id} returning id`;
    if (kept) return kept.id as string;
  }
  // A release with this title may already exist — imported from a catalog file
  // before the project was scoped. Adopt it rather than duplicate it.
  const [same] = await sql`
    select id from artist.releases where title = ${row.title} order by created_at desc limit 1`;
  const releaseId: string = same
    ? ((await sql`update artist.releases set release_type = ${row.release_type}, release_date = ${row.release_date}
                   where id = ${same.id} returning id`)[0]!.id as string)
    : ((await sql`insert into artist.releases ${sql(row)} returning id`)[0]!.id as string);
  await sql`update artist.projects set release_id = ${releaseId} where id = ${p.id}`;
  return releaseId;
}
