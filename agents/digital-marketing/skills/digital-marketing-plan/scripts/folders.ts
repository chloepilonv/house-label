#!/usr/bin/env bun
/**
 * One empty Drive folder per `task_type = 'create'` task, in due-date order.
 *
 *   bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/folders.ts <campaign-id>
 *
 * Run after the tasks are written. A script, not the model, so folder names are
 * identical on every run; a renamed folder breaks collaborators' links.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { ensureContentFolders, currentArtistName, NO_ACCOUNT } from "../../../../../engine/google/workspace";

const campaignId = process.argv[2];
if (!campaignId) {
  console.error("✗ Which campaign? Pass its id: folders.ts <campaign-id>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ No DATABASE_URL. Run `houselabel init` first.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const [campaign] = await sql`
    select c.id, c.title, p.title as project_title, p.project_type, p.street_date
      from artist.marketing_campaigns c
      left join artist.projects p on p.id = c.project_id
     where c.id = ${campaignId}`;

  if (!campaign) {
    console.error(`✗ No campaign with id ${campaignId}.`);
    process.exit(1);
  }

  // A campaign with no scoped project has no release folder; stop rather than invent one.
  if (!campaign.project_title) {
    console.log(
      `\n  This campaign is not linked to a scoped release, so there is no release folder to put\n` +
        `  content folders in. Scope the project with the label manager first, or skip this step.\n`,
    );
    process.exit(0);
  }

  const tasks = await sql`
    select id, title, due_date, task_type
      from artist.marketing_tasks
     where campaign_id = ${campaignId}
     order by due_date asc, sort_order asc`;

  const project = {
    title: campaign.project_title as string,
    project_type: campaign.project_type as string,
    street_date: campaign.street_date as Date | null,
  };

  const folders = await ensureContentFolders(
    await currentArtistName(),
    project,
    tasks.map((t) => ({
      id: String(t.id),
      title: String(t.title),
      due_date: t.due_date as Date,
      task_type: String(t.task_type),
    })),
  );

  if (!folders) {
    console.log(`\n  ${NO_ACCOUNT}\n`);
    process.exit(0);
  }

  for (const f of folders)
    await sql`update artist.marketing_tasks set drive_folder_url = ${f.url} where id = ${f.taskId}`;

  if (!folders.length) {
    console.log("\n  No `create` tasks in this campaign, so there is nothing to make a folder for.\n");
    process.exit(0);
  }

  console.log(`\n  ✓ ${folders.length} folder(s) in Drive, one per thing to make:\n`);
  for (const f of folders) console.log(`    ${f.name}\n      ${f.url}`);
  console.log(
    "\n  Tell the artist: each folder is empty until they drop the file in, so the list\n" +
      "  doubles as the shooting schedule. Anyone they share the link with can add to it.\n",
  );
} finally {
  await sql.end();
}
