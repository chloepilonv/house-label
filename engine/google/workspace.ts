/**
 * The artist's Drive workspace: which folders exist and what they are called.
 * The tree is documented in WORKSPACE.md; `drive.ts` makes paths exist.
 * Google may never be connected: every `ensure*` returns null then, and no
 * caller may treat that as a failure. `data/artist` is where work is kept.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { ensurePath, ensureRoot as ensureRootByName, shareFolder } from "./drive";
import { TABS, TITLES, headerRows, labelOf, sheetName, systemColumns } from "./credits-sheet";
import { BUDGET_SHEET, BUDGET_TABS, EXPECTED_TAB, expectedRows, mergeExpected, type PlanForSheet } from "./budget-sheet";
import {
  appendRows,
  ensureSpreadsheet,
  readTab,
  reconcileTabs,
  replaceRows,
  styleSheet,
  writeHeader,
  type EnsuredSheet,
  type ReconcileReport,
} from "./sheets";
import { isConfigured } from "./auth";
import { status } from "./store";

/** Said to the artist, once, by whoever asked for a folder. Never thrown. */
export const NO_ACCOUNT =
  "No Google account is connected, so nothing was put in Drive. " +
  "Everything is saved here either way. `houselabel connect google` links it, " +
  "and `houselabel drive setup` then builds the whole folder tree at once.";

/** Whether the workspace can be touched at all right now. */
export async function available(): Promise<boolean> {
  if (!isConfigured()) return false;
  return (await status()).connected;
}

// ── naming ────────────────────────────────────────────────────────────────
// Pure and tested. A drifting name creates a duplicate folder.

/** `Odile Ray — House Label`. Em dash, because Drive sorts it after letters. */
/**
 * Root name override for everything run inside `withRoot`. Lets
 * `houselabel example` build a second workspace beside the artist's own.
 */
const ROOT = new AsyncLocalStorage<string>();
export const withRoot = <T>(name: string, fn: () => Promise<T>): Promise<T> => ROOT.run(name, fn);
const ensureRoot = (name: string) => ensureRootByName(ROOT.getStore() ?? name);

export function rootName(artistName: string | null | undefined): string {
  const name = (artistName ?? "").trim();
  return name ? `${name} — House Label` : "House Label";
}

/** `/` in a name reads as a path to humans, and a leading dot hides it on sync. */
function safe(segment: string): string {
  return segment
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
}

const TYPE_LABEL: Record<string, string> = {
  single: "Single",
  ep: "EP",
  album: "Album",
  compilation: "Compilation",
  tour: "Tour",
};

/**
 * `2026-05_Nightdrive (EP)`. Date first so folders sort. No date yet gives
 * `TBD`. When the date arrives the folder is renamed, not recreated, so the
 * folder id and every shared link survive.
 */
export function releaseFolderName(p: {
  title: string;
  project_type: string;
  street_date?: string | Date | null;
}): string {
  const month = p.street_date ? new Date(p.street_date).toISOString().slice(0, 7) : "TBD";
  const type = TYPE_LABEL[p.project_type] ?? p.project_type;
  return `${month}_${safe(p.title)} (${type})`;
}

/** `2026-04-02_Studio-teaser (reel)`. One per create task, sorted by due date. */
export function taskFolderName(t: {
  title: string;
  due_date: string | Date;
  format?: string | null;
}): string {
  const day = new Date(t.due_date).toISOString().slice(0, 10);
  const title = safe(t.title).replace(/\s/g, "-");
  return t.format ? `${day}_${title} (${t.format})` : `${day}_${title}`;
}

/**
 * Fixed folder names. `ensurePath` is find-or-create by name, so a second
 * spelling is a second folder. Casing is `Title-Case`, hyphen for multiword.
 */
export const CONTENTS = "Digital-Contents";

// `Audio/` and `Video/` are flat by the artist's choice. Do not add
// subfolders unless the artist asks.

/**
 * Token → path, e.g. AGENT.md's `releases/audio`. `ensureArtistBranch` and
 * `ensureReleaseBranch` build from these, and `workspace.test.ts` fails when a
 * token in `engine/frontmatter.ts` has no entry here.
 */
export const ARTIST_SUBFOLDERS = {
  "artist/presskit": ["Artist", "Presskit"],
  "artist/photos": ["Artist", "Photos"],
  "artist/brand": ["Artist", "Brand"],
  "artist/admin": ["Artist", "Admin"],
} as const;

/** `Budget/` at the root: one money folder, since some costs belong to no release. See budget-sheet.ts. */
export const BUDGET_SUBFOLDERS = {
  budget: ["Budget"],
} as const;

/** Beneath `Releases/<release>/`, whose own token is bare `releases`. */
export const RELEASE_SUBFOLDERS = {
  "releases/songs": ["Songs"],
  "releases/audio": ["Songs", "Audio"],
  "releases/lyrics": ["Songs", "Lyrics"],
  "releases/artwork": ["Artwork"],
  "releases/video": ["Video"],
  "releases/digital-contents": [CONTENTS],
} as const;

// ── the root ──────────────────────────────────────────────────────────────

/**
 * The workspace root, named from the profile, created if absent. Reads the
 * name itself so no caller can pass a second spelling (a second root).
 * Null when Google is not connected.
 */
export async function ensureWorkspaceRoot(): Promise<string | null> {
  if (!(await available())) return null;
  const override = ROOT.getStore();
  return ensureRoot(override ?? rootName(await currentArtistName()));
}

/** `artist.profile.artist_name`, or null on an empty or unreachable profile. */
export async function currentArtistName(): Promise<string | null> {
  const { openArtist } = await import("../../data/artist/client");
  const artist = await openArtist();
  try {
    const row = await artist.one<{ artist_name: string | null }>("profile");
    return row?.artist_name ?? null;
  } finally {
    await artist.close();
  }
}

// ── the branches ──────────────────────────────────────────────────────────

export interface ArtistBranch {
  rootId: string;
  presskitId: string;
  photosId: string;
  brandId: string;
  adminId: string;
}

/**
 * The root, `Artist/` and `Admin/`, owned by `houselabel profile`. Both exist
 * independent of any release. `Admin/` holds paperwork the artist files by
 * hand; departments read the facts from `artist.registrations` instead.
 */
export async function ensureArtistBranch(artistName: string | null): Promise<ArtistBranch | null> {
  if (!(await available())) return null;

  const rootId = await ensureRoot(rootName(artistName));
  const at = (token: keyof typeof ARTIST_SUBFOLDERS) =>
    ensurePath(rootId, [...ARTIST_SUBFOLDERS[token]]);

  return {
    rootId,
    presskitId: await at("artist/presskit"),
    photosId: await at("artist/photos"),
    brandId: await at("artist/brand"),
    adminId: await at("artist/admin"),
  };
}

export interface ReleaseBranch {
  releaseId: string;
  songsId: string;
  audioId: string;
  lyricsId: string;
  artworkId: string;
  videoId: string;
  contentsId: string;
  /** Shared "anyone with the link" — this is the advance listening link. */
  audioUrl: string;
  url: string;
}

/**
 * The release folder, owned by label-manager, built when the artist validates
 * the scope.
 *
 * ```
 * 2026-05_Nightdrive (EP)/
 * ├── Songs/
 * │   ├── Audio/
 * │   └── Lyrics/
 * ├── Artwork/
 * ├── Video/
 * └── Digital-Contents/
 * ```
 *
 * `Audio/` is shared as a folder: press needs a non-expiring link, and some
 * outlets refuse download-only or WeTransfer links. `Digital-Contents/` is
 * created empty here and filled by digital-marketing. Money lives in the root
 * `Budget/`.
 */
export async function ensureReleaseBranch(
  artistName: string | null,
  project: { title: string; project_type: string; street_date?: string | Date | null },
): Promise<ReleaseBranch | null> {
  if (!(await available())) return null;

  const rootId = await ensureRoot(rootName(artistName));
  const folder = releaseFolderName(project);
  const releaseId = await ensurePath(rootId, ["Releases", folder]);

  const at = (token: keyof typeof RELEASE_SUBFOLDERS) =>
    ensurePath(releaseId, [...RELEASE_SUBFOLDERS[token]]);

  const songsId = await at("releases/songs");
  const audioId = await at("releases/audio");
  const lyricsId = await at("releases/lyrics");

  const artworkId = await at("releases/artwork");
  const videoId = await at("releases/video");
  const contentsId = await at("releases/digital-contents");

  return {
    releaseId,
    songsId,
    audioId,
    lyricsId,
    artworkId,
    videoId,
    contentsId,
    audioUrl: await shareFolder(audioId),
    url: `https://drive.google.com/drive/folders/${releaseId}`,
  };
}

export interface ContentFolder {
  taskId: string;
  name: string;
  folderId: string;
  url: string;
}

/**
 * `Digital-Contents/<task>`: one empty drop folder per `task_type = 'create'`
 * task, owned by digital-marketing. Its URL goes onto
 * `marketing_tasks.content_url`. Other task types have no asset, so no folder.
 */
export async function ensureContentFolders(
  artistName: string | null,
  project: { title: string; project_type: string; street_date?: string | Date | null },
  tasks: { id: string; title: string; due_date: string | Date; task_type: string; format?: string | null }[],
): Promise<ContentFolder[] | null> {
  if (!(await available())) return null;

  const rootId = await ensureRoot(rootName(artistName));
  const releaseId = await ensurePath(rootId, ["Releases", releaseFolderName(project)]);
  const contentsId = await ensurePath(releaseId, [CONTENTS]);

  const out: ContentFolder[] = [];
  for (const task of tasks) {
    if (task.task_type !== "create") continue;
    const name = taskFolderName(task);
    const folderId = await ensurePath(contentsId, [name]);
    out.push({
      taskId: task.id,
      name,
      folderId,
      url: `https://drive.google.com/drive/folders/${folderId}`,
    });
  }
  return out;
}

// ── the credits sheet ─────────────────────────────────────────────────────

export interface CreditsSheet {
  id: string;
  url: string;
  created: boolean;
  /** Songs added to the SONG_CREDITS tab by this call. */
  seeded: number;
  /** What an existing sheet needed to reach the current spec. Empty on a new one. */
  reconciled: ReconcileReport;
}

/**
 * `<Release> — Release-Credits` in `Releases/<release>/`, created if absent.
 * The input half of credits: collaborators fill it and `rights-manage-catalog`
 * imports it into `artist.songs`, `song_writers`, `song_splits` and
 * `release_credits`, which stay the source of truth.
 *
 * Append-only: each call adds only ids missing from the System ID column, and
 * never touches an edited row. An older-shaped sheet goes through
 * `reconcileTabs` first, under the same rule.
 */
export async function ensureCreditsSheet(
  releaseFolderId: string,
  release: {
    id?: string | null;
    title: string;
    release_type?: string | null;
    release_date?: string | Date | null;
    upc?: string | null;
    label?: string | null;
    distributor?: string | null;
    p_year?: number | string | null;
    p_owner?: string | null;
    c_year?: number | string | null;
    c_owner?: string | null;
  },
  songs: {
    id: string;
    release_id?: string | null;
    title: string;
    isrc?: string | null;
    iswc?: string | null;
    duration_seconds?: number | null;
    genre?: string | null;
    language?: string | null;
  }[],
): Promise<CreditsSheet | null> {
  if (!(await available())) return null;

  const sheet = await ensureSpreadsheet({
    folderId: releaseFolderId,
    name: sheetName(release.title),
    tabs: TABS.map((t) => ({ title: t.title, headers: t.headers, groups: t.groups, rows: t.rows })),
  });

  // Bring an older or hand-renamed sheet to spec first, keeping typed rows.
  const reconciled: ReconcileReport = sheet.created
    ? { renamed: [], added: [], rewritten: [], deleted: [], kept: [] }
    : await reconcileTabs(sheet.id, TABS.map((t) => ({ title: t.title, headers: t.headers, groups: t.groups, rows: t.rows })));

  const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v));
  const text = (v: unknown) => (v == null ? "" : String(v));

  // Formatting runs every time. It touches no values, so a filled sheet is safe.
  await styleSheet(
    sheet.id,
    TABS.map((t) => ({ title: t.title, headers: t.headers, groups: t.groups, purpose: t.purpose, systemColumns: systemColumns(t) })),
  );

  /** A row keyed by header label, so the seed survives a moved column. */
  const byLabel = (tabTitle: string, header: string[], cells: Record<string, string>) => {
    const spec = TABS.find((t) => t.title === tabTitle)!;
    const value = new Map(spec.columns.map((col) => [col.label, cells[col.key] ?? ""]));
    return header.map((label) => value.get(label) ?? "");
  };

  /**
   * The header as it stands — row 1, or row 2 under a group row — or, on an
   * empty tab whose header drifted, rewritten.
   */
  const headerOf = async (tabTitle: string): Promise<{ header: string[]; rows: string[][] }> => {
    const spec = TABS.find((t) => t.title === tabTitle)!;
    const all = await readTab(sheet.id, tabTitle);
    const at = headerRows(spec) - 1;
    const header = all[at] ?? [];
    const rows = all.slice(at + 1);
    const same = header.length === spec.headers.length && header.every((h, i) => h === spec.headers[i]);
    if (!same && rows.length === 0) {
      await writeHeader(sheet.id, spec);
      return { header: spec.headers, rows };
    }
    return { header, rows };
  };

  // ── RELEASE_CREDITS — one row, keyed on the grey System ID column ────────
  const releaseKey = release.id ?? `project:${release.title}`;
  {
    const { header, rows } = await headerOf(TITLES.release);
    const idCol = header.indexOf(labelOf(TITLES.release, "release_id"));
    const present = new Set(rows.map((r) => (r[idCol] ?? "").trim()));
    if (!present.has(releaseKey)) {
      await appendRows(sheet.id, TITLES.release, [
        byLabel(TITLES.release, header, {
          release_id: releaseKey,
          title: release.title,
          release_type: text(release.release_type),
          release_date: day(release.release_date),
          upc: text(release.upc),
          label: text(release.label),
          distributor: text(release.distributor),
          p_year: text(release.p_year),
          p_owner: text(release.p_owner),
          c_year: text(release.c_year),
          c_owner: text(release.c_owner),
        }),
      ]);
    }
  }

  // ── SONG_CREDITS — keyed on the artist.songs uuid, never on titles.
  const { header, rows: existing } = await headerOf(TITLES.songs);
  const idCol = header.indexOf(labelOf(TITLES.songs, "song_id"));
  const present = new Set(existing.map((row) => (row[idCol] ?? "").trim()).filter(Boolean));

  const rows = songs
    .filter((song) => !present.has(song.id))
    .map((song, i) =>
      byLabel(TITLES.songs, header, {
        song_id: song.id,
        track_number: String(present.size + i + 1),
        title: song.title,
        isrc: song.isrc ?? "",
        iswc: song.iswc ?? "",
        // MM:SS, for a human reading a waveform.
        duration: song.duration_seconds ? mmss(song.duration_seconds) : "",
        genre: song.genre ?? "",
        language: song.language ?? "",
        version_type: "original",
      }),
    );

  const seeded = await appendRows(sheet.id, TITLES.songs, rows);
  return { ...sheet, seeded, reconciled };
}

export interface BudgetBranch {
  folderId: string;
  sheet: EnsuredSheet;
}

/**
 * `Budget/` and the `Budget` sheet, created if absent. Private: nothing here
 * is shared by link. Null when Google is not connected.
 */
export async function ensureBudget(): Promise<BudgetBranch | null> {
  const rootId = await ensureWorkspaceRoot();
  if (!rootId) return null;

  const folderId = await ensurePath(rootId, [...BUDGET_SUBFOLDERS.budget]);
  const sheet = await ensureSpreadsheet({
    folderId,
    name: BUDGET_SHEET,
    tabs: BUDGET_TABS.map((t) => ({ title: t.title, headers: t.headers })),
  });
  if (sheet.created)
    await styleSheet(
      sheet.id,
      BUDGET_TABS.map((t) => ({
        title: t.title,
        headers: t.headers,
        purpose: t.purpose,
        systemColumns: t.columns.map((c, i) => (c.system ? i : -1)).filter((i) => i >= 0),
      })),
    );
  return { folderId, sheet };
}

/**
 * One release's plan into EXPECTED: its own block rewritten, every other
 * release's rows kept. SPENT is never touched here — see budget-sheet.ts.
 */
export async function writeExpected(
  release: string,
  plan: PlanForSheet,
  ownerName: (o: string | null) => string,
): Promise<(EnsuredSheet & { rows: number }) | null> {
  const budget = await ensureBudget();
  if (!budget) return null;

  const existing = (await readTab(budget.sheet.id, EXPECTED_TAB)).slice(1);
  const merged = mergeExpected(existing, release, expectedRows(release, plan, ownerName));
  await replaceRows(budget.sheet.id, EXPECTED_TAB, merged);
  return { ...budget.sheet, rows: merged.length };
}

/** 214 → `3:34`. */
export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.round(seconds - m * 60)).padStart(2, "0")}`;
}

// ── the whole tree at once ────────────────────────────────────────────────

export interface SetupReport {
  rootUrl: string;
  releases: { title: string; url: string }[];
  contentFolders: number;
  creditsSheets: number;
  /** Per credits sheet that existed already: what changed to bring it to spec. */
  reconciled: { title: string; url: string; report: ReconcileReport }[];
}

/**
 * `houselabel drive setup`: every folder the database implies, via the same
 * `ensure*` functions as the normal path (no separate backfill). Idempotent;
 * after a rename it moves the folder. Null when Google is not connected.
 */
export async function setupWorkspace(): Promise<SetupReport | null> {
  if (!(await available())) return null;
  const { openArtist } = await import("../../data/artist/client");
  const artist = await openArtist();
  try {
    const data = await loadWorkspaceData(artist);
    const built = await buildWorkspace(data);
    if (!built) return null;
    // What the Drive gave back, written onto the rows it came from.
    for (const r of built.projects) {
      if (r.projectId) await artist.update("projects", { id: r.projectId }, { drive_folder_id: r.releaseId });
      for (const f of r.contentFolders)
        await artist.update("marketing_tasks", { id: f.taskId }, { drive_folder_url: f.url });
    }
    return built.report;
  } finally {
    await artist.close();
  }
}

/** Everything the Drive template is built from — read from the database, or from an example file. */
export interface WorkspaceData {
  profile: { artist_name: string | null; preferred_locale?: string | null };
  platforms: { platform: string; url: string }[];
  projects: {
    project: { id?: string; title: string; project_type: string; street_date: string | null };
    release: {
      id?: string; title: string; release_type?: string | null; release_date?: string | null;
      upc?: string | null; label?: string | null; distributor?: string | null; smart_link_url?: string | null;
      p_year?: number | null; p_owner?: string | null; c_year?: number | null; c_owner?: string | null;
    } | null;
    songs: {
      id: string; release_id?: string | null; title: string; isrc?: string | null; iswc?: string | null;
      duration_seconds?: number | null; genre?: string | null; language?: string | null; lyrics?: string | null;
    }[];
    links: { category: string; label: string; url: string }[];
    tasks: { id: string; title: string; due_date: string; task_type: string; format?: string | null }[];
  }[];
}

type ArtistDb = Awaited<ReturnType<(typeof import("../../data/artist/client"))["openArtist"]>>;

/** The database half: every row the template needs, nothing written. */
export async function loadWorkspaceData(artist: ArtistDb): Promise<WorkspaceData> {
  const profile = await artist.one<{ artist_name: string | null; preferred_locale: string | null }>("profile");
  const platforms = await artist.query<{ platform: string; url: string }>("platforms", {}, { orderBy: "created_at asc" });
  const projects = await artist.query<{
    id: string; title: string; project_type: string; street_date: string | null; release_id: string | null;
  }>("projects", {}, { orderBy: "created_at asc" });

  const out: WorkspaceData["projects"] = [];
  for (const project of projects) {
    const rid = project.release_id;
    const [release] = rid ? await artist.query<NonNullable<WorkspaceData["projects"][number]["release"]>>("releases", { id: rid }) : [];
    const songs = rid ? await artist.query<WorkspaceData["projects"][number]["songs"][number]>("songs", { release_id: rid }, { orderBy: "created_at asc" }) : [];
    const links = rid ? await artist.query<{ category: string; label: string; url: string }>("release_links", { release_id: rid }, { orderBy: "created_at asc" }) : [];
    // A campaign's tasks, when the artist has planned one for this project.
    const tasks: WorkspaceData["projects"][number]["tasks"] = [];
    for (const c of await artist.query<{ id: string }>("marketing_campaigns", { project_id: project.id }))
      tasks.push(...(await artist.query<WorkspaceData["projects"][number]["tasks"][number]>("marketing_tasks", { campaign_id: c.id }, { orderBy: "due_date asc" })));
    out.push({ project, release: release ?? null, songs, links, tasks });
  }
  return { profile: profile ?? { artist_name: null }, platforms, projects: out };
}

/** The Drive half: the whole tree from data. Idempotent; writes nothing back. */
export async function buildWorkspace(data: WorkspaceData): Promise<{
  report: SetupReport;
  projects: { projectId?: string; title: string; releaseId: string; contentFolders: ContentFolder[] }[];
} | null> {
  const name = data.profile.artist_name ?? null;
  const lang = data.profile.preferred_locale === "fr" ? "fr" : "en";
  const { ensureLinksSheet, ensureLyricsDocs } = await import("./release-docs");

  const branch = await ensureArtistBranch(name);
  if (!branch) return null;
  await ensureBudget();

  const releases: { title: string; url: string }[] = [];
  const projects: { projectId?: string; title: string; releaseId: string; contentFolders: ContentFolder[] }[] = [];
  let contentFolders = 0;
  let creditsSheets = 0;
  const reconciled: SetupReport["reconciled"] = [];

  for (const { project, release: row, songs, links, tasks } of data.projects) {
    const release = await ensureReleaseBranch(name, project);
    if (!release) continue;
    releases.push({ title: project.title, url: release.url });

    // Credits sheet, append-only. Before a release row exists the project's
    // title and date stand in.
    const sheet = await ensureCreditsSheet(
      release.releaseId,
      row ?? { id: project.id, title: project.title, release_type: project.project_type, release_date: project.street_date },
      songs,
    );
    if (sheet) {
      creditsSheets += 1;
      const r = sheet.reconciled;
      if (r.renamed.length || r.added.length || r.rewritten.length || r.deleted.length || r.kept.length)
        reconciled.push({ title: project.title, url: sheet.url, report: r });
    }

    // The release's links and each song's lyrics — both only ever added to.
    await ensureLinksSheet(release.releaseId, {
      release: { title: project.title, smart_link_url: row?.smart_link_url, upc: row?.upc },
      links, platforms: data.platforms, songs,
    }, lang);
    await ensureLyricsDocs(release.lyricsId, songs, lang);

    const folders = tasks.length ? ((await ensureContentFolders(name, project, tasks)) ?? []) : [];
    contentFolders += folders.length;
    projects.push({ projectId: project.id, title: project.title, releaseId: release.releaseId, contentFolders: folders });
  }

  return {
    report: { rootUrl: `https://drive.google.com/drive/folders/${branch.rootId}`, releases, contentFolders, creditsSheets, reconciled },
    projects,
  };
}
