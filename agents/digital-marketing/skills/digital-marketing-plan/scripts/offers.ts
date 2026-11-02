/**
 * What the artist has already told the label, offered back.
 *
 * Separate from questions.ts (pure data, no `postgres` import) and from plan.ts
 * (the terminal adapter), so `houselabel` and plan.ts get the same pre-fill.
 * `plan.ts` imports it as `OFFERS`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import type { Lang, Offer } from "../../../../../engine/interview/core";
import { FROM_PROJECT } from "./questions";

/** Platforms the artist has an account on, in our vocabulary. */
const SOCIAL = new Set(["instagram", "tiktok", "facebook", "x", "youtube"]);

/**
 * The four platforms the label plans for, linked or not. A planning assumption:
 * the plan tells the artist to open a missing account, and they can drop one at
 * the confirm step. X is not here; it appears only when linked. Nothing here
 * writes artist.platforms; `houselabel profile` is its only writer.
 */
const BASELINE = ["instagram", "tiktok", "facebook", "youtube"] as const;

const day = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v).slice(0, 10);

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "\u2717 DATABASE_URL is not set. That, and only that, means there is no artist\n" +
        "  data to pre-fill from. Set it and re-run \u2014 do not report the profile\n" +
        "  as empty.",
    );
    process.exit(1);
  }
  return postgres(url, { max: 1, onnotice: () => {} });
}

/**
 * Read once and cached in the draft, so no database round-trip can fail
 * mid-interview. The project is picked like `data/artist/brief/rules.ts` picks a
 * focus release: the soonest one still ahead, not the most recently created.
 */
export async function OFFERS(): Promise<{ offered: Record<string, Offer>; lang?: Lang }> {
  const sql = connect();
  const offered: Record<string, Offer> = {};
  let lang: Lang = "en";
  try {
    const [profile] = await sql`
      select preferred_locale from artist.profile order by id limit 1`;
    if (profile?.preferred_locale === "fr") lang = "fr";

    // Soonest street date still ahead of today; failing that, the most recent.
    const [project] = await sql`
      select id, title, project_type, street_date, date_is_target,
             budget_amount, budget_currency, lead_single_id
        from artist.projects
       where status <> 'abandoned'
       -- The latest project scoped: the same rule as plan.ts, readiness.ts and
       -- the brief. "Soonest street date" once offered another record's title,
       -- date and budget on four questions in a row.
       order by created_at desc
       limit 1`;

    if (project?.title) {
      const from =
        lang === "fr"
          ? `déjà noté pour « ${project.title} » avec la direction`
          : `already noted for "${project.title}" with the label manager`;

      offered.title = { value: project.title, from };

      // Mapped, never assigned: artist.projects uses single|ep|album|tour, this
      // question's CHECK constraint eight wider values. An unmapped type is asked.
      const mapped = FROM_PROJECT[String(project.project_type)];
      if (mapped) offered.project_type = { value: mapped, from };

      const street = day(project.street_date);
      if (street) {
        offered.target_date = {
          value: street,
          from: project.date_is_target
            ? lang === "fr"
              ? `${from} — mais c'est un mois visé, pas une date fixée`
              : `${from} — but that's a month aimed at, not a date fixed`
            : from,
        };
      }

      // The release budget, of which marketing is a share. A budget of 0 or none is
      // not offered: it would read as a campaign funded at zero.
      if (project.budget_amount != null && Number(project.budget_amount) > 0) {
        offered.budget = {
          value: `${project.budget_currency ?? ""} ${project.budget_amount}`.trim(),
          from:
            lang === "fr"
              ? `budget total de « ${project.title} » — le marketing en prend une part`
              : `the whole budget for "${project.title}" — marketing is a share of it`,
        };
      }

      if (project.lead_single_id) {
        const [song] = await sql`
          select title from artist.songs where id = ${project.lead_single_id}`;
        if (song?.title) offered.lead_track = { value: song.title, from };
      }
    }

    // Platforms are adopted, not asked; the artist can still override before saving.
    const rows = await sql`
      select distinct platform from artist.platforms
       union select distinct platform from artist.platform_stats`;

    // Start from the baseline, then add whatever else is actually linked.
    const have = new Set<string>(BASELINE);
    have.add("youtube_shorts"); // youtube implies Shorts, baseline or linked
    const linked = new Set<string>();

    for (const r of rows) {
      const p = String(r.platform);
      if (SOCIAL.has(p)) {
        have.add(p);
        linked.add(p);
      }
      // A linked YouTube channel covers both long-form and Shorts, which are
      // different format groups and therefore different post tasks.
      if (p === "youtube") have.add("youtube_shorts");
    }

    // Always offered: the baseline is never empty. Say which came from where, so
    // assumed platforms are not read as found ones.
    const extra = [...linked].filter(
      (p) => !(BASELINE as readonly string[]).includes(p),
    );
    offered.platforms = {
      value: [...have],
      adopt: true,
      from: linked.size
        ? lang === "fr"
          ? `les quatre que le label vise par défaut${extra.length ? `, plus ${extra.join(", ")} d'après tes comptes liés` : ""}`
          : `the four the label plans for by default${extra.length ? `, plus ${extra.join(", ")} from your linked accounts` : ""}`
        : lang === "fr"
          ? "les quatre que le label vise par défaut — aucun compte lié au dossier"
          : "the four the label plans for by default — no linked accounts on file",
    };
  } finally {
    await sql.end();
  }
  return { offered, lang };
}
