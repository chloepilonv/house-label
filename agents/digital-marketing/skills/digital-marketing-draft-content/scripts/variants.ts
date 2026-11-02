#!/usr/bin/env bun
/**
 * One photo in the task's Drive folder → one copy per shape the task's
 * platforms need, saved beside it, each with a link Buffer can fetch.
 *
 *   bun run social:variants <task-id> [--format reel]        crop every photo in the task's folder
 *   bun run social:variants <task-id> --save vertical <url>  keep a crop made elsewhere (Adobe, in Claude)
 *
 * Drive because Buffer needs a public URL that still works at post time
 * (https://developers.buffer.com/guides/hosting-media.html); Adobe links expire, hence `--save`.
 * One file per shape, not per platform. Sizes: https://buffer.com/resources/instagram-image-size/
 * Crops use sharp's `attention` strategy to keep the busiest region in frame. Photos only.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import sharp from "sharp";
import {
  directImageUrl,
  downloadFile,
  ensurePath,
  folderIdFromUrl,
  listFolder,
  uploadBinary,
} from "../../../../../engine/google/drive";
import { inspect } from "../../../../../engine/media";

export const SHAPES = {
  feed: { width: 1080, height: 1350, folder: "Feed-4x5" },
  vertical: { width: 1080, height: 1920, folder: "Vertical-9x16" },
  wide: { width: 1920, height: 1080, folder: "Wide-16x9" },
} as const;
export type Shape = keyof typeof SHAPES;

const VERTICAL_FORMATS = new Set(["story", "reel", "short"]);

/**
 * Which shapes a task needs, from its `platforms` and the caller's `--format`
 * (tasks have no format column). No platforms named means all three.
 */
export function shapesFor(platforms: string[], format: string | null): Shape[] {
  if (!platforms.length) return ["feed", "vertical", "wide"];
  const vertical = VERTICAL_FORMATS.has(format ?? "");
  const out = new Set<Shape>();
  for (const p of platforms.map((x) => x.toLowerCase())) {
    if (p === "tiktok") out.add("vertical");
    else if (p === "instagram" || p === "facebook") out.add(vertical ? "vertical" : "feed");
    else if (p === "threads") out.add("feed");
    else if (p === "youtube") out.add(format === "short" ? "vertical" : "wide");
    else if (p === "x" || p === "twitter") out.add("wide");
  }
  return out.size ? [...out] : ["feed", "vertical", "wide"];
}

/** The crop itself. Pure: bytes in, JPEG bytes out, no network. */
export async function cropTo(image: Buffer, shape: Shape): Promise<Buffer> {
  const { width, height } = SHAPES[shape];
  return sharp(image)
    .rotate() // honour the phone's EXIF orientation before cropping
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export interface Variant {
  source: string;
  shape: Shape;
  name: string;
  /** What Buffer fetches. */
  url: string;
  /** What the artist opens. */
  driveUrl: string;
  /** False when an earlier run already made it — re-running doubles nothing. */
  created: boolean;
}

const IMAGE = /^image\/(jpeg|png|webp)$/;
const variantName = (source: string, shape: Shape) =>
  `${source.replace(/\.[^.]+$/, "")}_${SHAPES[shape].width}x${SHAPES[shape].height}.jpg`;

/** Every photo at the top of the task folder, cropped to every shape it needs. */
export async function makeVariants(task: {
  drive_folder_url: string | null;
  platforms: string[] | null;
  format: string | null;
}): Promise<{ variants: Variant[]; skipped: string[] }> {
  const folderId = task.drive_folder_url ? folderIdFromUrl(task.drive_folder_url) : null;
  if (!folderId)
    throw new Error("This task has no Drive folder yet. Run the plan's folders step, then drop the photo in it.");

  const entries = await listFolder(folderId);
  const photos = entries.filter((e) => IMAGE.test(e.mimeType));
  const skipped = entries
    .filter((e) => !IMAGE.test(e.mimeType) && e.mimeType !== "application/vnd.google-apps.folder")
    .map((e) => e.name);

  const variants: Variant[] = [];
  for (const shape of shapesFor(task.platforms ?? [], task.format)) {
    const shapeFolder = await ensurePath(folderId, [SHAPES[shape].folder]);
    const existing = new Map((await listFolder(shapeFolder)).map((e) => [e.name, e.id]));
    for (const photo of photos) {
      const name = variantName(photo.name, shape);
      let id = existing.get(name);
      const created = !id;
      if (!id) {
        const body = await cropTo(await downloadFile(photo.id), shape);
        id = (await uploadBinary({ name, mimeType: "image/jpeg", body, folderId: shapeFolder })).id;
      }
      variants.push({
        source: photo.name,
        shape,
        name,
        url: directImageUrl(id),
        driveUrl: `https://drive.google.com/file/d/${id}/view`,
        created,
      });
    }
  }
  return { variants, skipped };
}

/**
 * Keep a crop made elsewhere in the same folder, so Buffer gets a link that
 * does not expire. Checked against the shape: a 1:1 file saved as `vertical`
 * would be cropped again by Instagram.
 */
export async function saveVariant(
  task: { drive_folder_url: string | null },
  shape: Shape,
  from: string,
): Promise<Variant> {
  const folderId = task.drive_folder_url ? folderIdFromUrl(task.drive_folder_url) : null;
  if (!folderId) throw new Error("This task has no Drive folder yet.");
  const res = await fetch(from);
  if (!res.ok) throw new Error(`Could not download ${from} (${res.status}) — the link may have expired.`);
  const body = Buffer.from(await res.arrayBuffer());

  const facts = inspect(body);
  const want = SHAPES[shape];
  if (facts.kind !== "image") throw new Error("That link is not a JPG, PNG or WebP image.");
  if (Math.abs(facts.width / facts.height - want.width / want.height) > 0.02)
    throw new Error(`That image is ${facts.width}×${facts.height}; ${shape} needs ${want.width}×${want.height}.`);

  const name = `${new URL(from).pathname.split("/").pop()?.replace(/\.[^.]+$/, "") || "variant"}_${facts.width}x${facts.height}.${facts.format === "png" ? "png" : "jpg"}`;
  const shapeFolder = await ensurePath(folderId, [want.folder]);
  const { id } = await uploadBinary({
    name,
    mimeType: facts.format === "png" ? "image/png" : "image/jpeg",
    body,
    folderId: shapeFolder,
  });
  return {
    source: from,
    shape,
    name,
    url: directImageUrl(id),
    driveUrl: `https://drive.google.com/file/d/${id}/view`,
    created: true,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const taskId = args[0];
  const at = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const format = at("--format") ?? null;
  const saving = args.includes("--save");
  const shape = at("--save");
  const from = saving ? args[args.indexOf("--save") + 2] : undefined;
  if (!taskId) {
    console.error("✗ Which task? social:variants <task-id> [--format reel|story|short|post] [--save <feed|vertical|wide> <url>]");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ No DATABASE_URL. Run `houselabel init` first.");
    process.exit(1);
  }
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1 });
  try {
    const [task] = await sql`
      select title, drive_folder_url, platforms from artist.marketing_tasks where id = ${taskId}`;
    if (!task) throw new Error(`No task with id ${taskId}.`);

    if (saving) {
      if (!shape || !(shape in SHAPES) || !from) throw new Error("--save needs a shape (feed | vertical | wide) and a URL.");
      const v = await saveVariant(task as never, shape as Shape, from);
      console.log(`\n  ✓ ${v.shape}: ${v.name}\n    buffer: ${v.url}\n    drive:  ${v.driveUrl}\n`);
    } else {
      const { variants, skipped } = await makeVariants({ ...(task as never), format });
      if (!variants.length) console.log(`\n  No photo in "${task.title}"'s folder yet. Drop a JPG or PNG in it.\n`);
      for (const v of variants)
        console.log(`  ${v.created ? "✓" : "·"} ${v.shape.padEnd(8)} ${v.name}\n    buffer: ${v.url}`);
      if (skipped.length) console.log(`\n  Not a photo, left alone: ${skipped.join(", ")}`);
    }
  } catch (err) {
    console.error(`\n  ✗ ${(err as Error).message}\n`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}
