/**
 * `houselabel example <name>`: builds a real campaign in Drive from
 * agents/label-manager/skills/manager-plan-release/references/example-<name>.yaml,
 * through the same `buildWorkspace` and `syncPlanSheet` every artist gets, under
 * its own root folder. Nothing here builds a folder or sheet itself.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { WorkspaceData } from "../google/workspace";
import type { Item, Project } from "../../agents/label-manager/skills/manager-weekly-recap/scripts/items";

export const EXAMPLES_DIR = join(import.meta.dir, "../../agents/label-manager/skills/manager-plan-release/references");

export interface ExampleFile {
  root: string;
  profile: { artist_name: string; preferred_locale: "en" | "fr" };
  platforms: { platform: string; url: string }[];
  project: { title: string; project_type: string; street_date: string };
  release: NonNullable<WorkspaceData["projects"][number]["release"]>;
  songs: { title: string; isrc?: string; duration_seconds?: number; genre?: string; language?: string; lyrics?: string }[];
  links: { category: string; label: string; url: string }[];
  content: { due_date: string; title: string; format?: string }[];
  /** [date, action, agent, status, source] */
  plan: [string, string, string, string, string][];
  budget?: { expected?: Record<string, string>[]; spent?: Record<string, string>[] };
  /** A zip whose folders mirror the Drive (`Artist/Presskit/…`, `Releases/<release>/…`). URL or local path. */
  media?: string;
}

/** The examples there are: `example-<name>.yaml` beside the label manager's plan skill. */
export async function listExamples(dir = EXAMPLES_DIR): Promise<string[]> {
  return (await readdir(dir).catch(() => [] as string[]))
    .map((f) => f.match(/^example-(.+)\.yaml$/)?.[1])
    .filter((n): n is string => !!n)
    .sort();
}

export async function readExample(name: string, dir = EXAMPLES_DIR): Promise<ExampleFile> {
  return Bun.YAML.parse(await Bun.file(join(dir, `example-${name}.yaml`)).text()) as ExampleFile;
}

const day = (s: string | Date) => (s instanceof Date ? s.toISOString().slice(0, 10) : String(s).slice(0, 10));

/** The example as the database would hand it to the template. Pure. */
export function toWorkspaceData(x: ExampleFile): WorkspaceData {
  return {
    profile: x.profile,
    platforms: x.platforms,
    projects: [{
      project: { title: x.project.title, project_type: x.project.project_type, street_date: day(x.project.street_date) },
      release: { ...x.release, release_date: x.release.release_date ? day(x.release.release_date) : null },
      songs: x.songs.map((s, i) => ({ id: `example-song-${i + 1}`, ...s })),
      links: x.links ?? [],
      tasks: (x.content ?? []).map((c, i) => ({ id: `example-task-${i + 1}`, title: c.title, due_date: day(c.due_date), task_type: "create", format: c.format ?? null })),
    }],
  };
}

/** The plan rows as the weekly recap's items, so its Plan sheet writes them. Pure. */
export function toItems(x: ExampleFile): Item[] {
  return x.plan.map(([date, action, agent, status, source]) => ({
    title: action,
    owner: agent,
    due: new Date(`${day(date)}T00:00:00Z`),
    link: source || undefined,
    done: status === "Done",
    status,
    key: `${agent}|${action}`,
  }));
}

export async function installExample(
  name: string,
): Promise<{ rootUrl: string; planUrl: string | null; media: { uploaded: number; existing: number; missing?: string } | null } | null> {
  const x = await readExample(name);
  const ws = await import("../google/workspace");
  if (!(await ws.available())) return null;
  return ws.withRoot(x.root, async () => {
    const built = await ws.buildWorkspace(toWorkspaceData(x));
    if (!built) return null;

    // The Plan sheet, by the weekly recap's own writer. Every status is the example's.
    const { syncPlanSheet } = await import("../../agents/label-manager/skills/manager-weekly-recap/scripts/plan-sheet");
    const p = built.projects[0]!;
    const project: Project = {
      id: "example", title: x.project.title, projectType: x.project.project_type,
      streetDate: new Date(`${day(x.project.street_date)}T00:00:00Z`), leadSingleDate: null, driveFolderId: p.releaseId,
    };
    const sheet = await syncPlanSheet(project, toItems(x), x.profile.preferred_locale);

    // The Budget, row by row in the template's own columns.
    if (x.budget) {
      const { BUDGET_TABS } = await import("../google/budget-sheet");
      const { replaceRows } = await import("../google/sheets");
      const budget = await ws.ensureBudget();
      if (budget)
        for (const [i, rows] of [x.budget.expected, x.budget.spent].entries())
          if (rows?.length)
            await replaceRows(budget.sheet.id, BUDGET_TABS[i]!.title, rows.map((r) => BUDGET_TABS[i]!.columns.map((c) => r[c.key] ?? "")));
    }
    const media = x.media ? await uploadMedia(x.media) : null;
    return { rootUrl: built.report.rootUrl, planUrl: sheet?.url ?? null, media };
  });
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf",
  mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4", mov: "video/quicktime",
};

/** Files on disk under `dir`, as paths relative to it. */
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true, recursive: true }))
    if (e.isFile() && !e.name.startsWith(".")) out.push(relative(dir, join(e.parentPath, e.name)));
  return out.sort();
}

/**
 * The example's media zip, unpacked into the root it is running under. Each
 * file lands at its path in the zip; one already there is skipped. A zip that
 * cannot be fetched yet is reported, not fatal: the sheets are already built.
 */
async function uploadMedia(src: string): Promise<{ uploaded: number; existing: number; missing?: string }> {
  const { ensurePath, listFolder, uploadBinary } = await import("../google/drive");
  const ws = await import("../google/workspace");
  const dir = await mkdtemp(join(tmpdir(), "houselabel-media-"));
  try {
    let zip = src;
    if (/^https?:\/\//.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return { uploaded: 0, existing: 0, missing: `${src} (${res.status})` };
      zip = join(dir, "media.zip");
      // Buffered, not Bun.write(zip, res): writing a redirected Response
      // straight to disk hangs on GitHub's release downloads.
      await Bun.write(zip, new Uint8Array(await res.arrayBuffer()));
    } else if (!(await Bun.file(src).exists())) return { uploaded: 0, existing: 0, missing: src };
    const out = join(dir, "files");
    const unzip = Bun.spawnSync(["unzip", "-oq", zip, "-d", out]);
    if (unzip.exitCode !== 0) throw new Error(`unzip failed: ${unzip.stderr.toString()}`);

    const rootId = (await ws.ensureWorkspaceRoot())!;
    const seen = new Map<string, Set<string>>();
    let uploaded = 0, existing = 0;
    for (const rel of await walk(out)) {
      const parts = rel.split("/");
      const name = parts.pop()!;
      const folderId = await ensurePath(rootId, parts);
      if (!seen.has(folderId)) seen.set(folderId, new Set((await listFolder(folderId)).map((f) => f.name)));
      if (seen.get(folderId)!.has(name)) { existing++; continue; }
      await uploadBinary({
        name, folderId, share: false,
        mimeType: MIME[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream",
        body: Buffer.from(await Bun.file(join(out, rel)).bytes()),
      });
      uploaded++;
    }
    return { uploaded, existing };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
