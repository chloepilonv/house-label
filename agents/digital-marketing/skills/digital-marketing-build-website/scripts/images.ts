/**
 * Every image ships inside the page as a data URI: Drive photos are not
 * hotlinkable, outside URLs disappear, and nothing passes through our servers.
 * Resizing uses macOS `sips`; elsewhere the original bytes are inlined.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const DRIVE_PREFIX = "drive://";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

async function fetchBytes(url: string): Promise<{ bytes: Buffer; mime: string }> {
  if (url.startsWith(DRIVE_PREFIX)) {
    const { accessToken } = await import("../../../../../engine/google/auth");
    const token = await accessToken();
    const id = url.slice(DRIVE_PREFIX.length);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive ${res.status} for ${id}`);
    return { bytes: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/jpeg" };
  }
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (houselabel website build)" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/jpeg" };
}

/** Longest side ≤ maxPx, JPEG. Only on macOS; elsewhere the input is returned. */
async function shrink(bytes: Buffer, maxPx: number, quality: number): Promise<{ bytes: Buffer; mime: string } | null> {
  if (process.platform !== "darwin") return null;
  const dir = join(tmpdir(), "houselabel-website");
  mkdirSync(dir, { recursive: true });
  const stamp = sha1(bytes.subarray(0, 4096).toString("hex") + bytes.byteLength);
  const inFile = join(dir, `${stamp}.in`);
  const outFile = join(dir, `${stamp}.jpg`);
  writeFileSync(inFile, bytes);
  const proc = Bun.spawn(["sips", "-Z", String(maxPx), "-s", "format", "jpeg", "-s", "formatOptions", String(quality), inFile, "--out", outFile], {
    stdout: "ignore",
    stderr: "ignore",
  });
  if ((await proc.exited) !== 0 || !existsSync(outFile)) return null;
  return { bytes: readFileSync(outFile), mime: "image/jpeg" };
}

export interface InlineOpts {
  /** Longest side per image, in pixels. */
  maxPx: number;
  quality?: number;
  cacheDir: string;
  log?: (line: string) => void;
}

/**
 * url → data URI. An unfetchable URL is left out of the map, so the page
 * falls back to the URL instead of the build failing.
 */
export async function inlineImages(urls: string[], opts: InlineOpts): Promise<Record<string, string>> {
  mkdirSync(opts.cacheDir, { recursive: true });
  const out: Record<string, string> = {};
  for (const url of [...new Set(urls)]) {
    const key = join(opts.cacheDir, `${sha1(`${url}@${opts.maxPx}`)}.txt`);
    if (existsSync(key)) {
      out[url] = readFileSync(key, "utf8");
      continue;
    }
    try {
      const raw = await fetchBytes(url);
      const small = (await shrink(raw.bytes, opts.maxPx, opts.quality ?? 70)) ?? raw;
      const uri = `data:${small.mime.split(";")[0]};base64,${small.bytes.toString("base64")}`;
      writeFileSync(key, uri);
      out[url] = uri;
      opts.log?.(`  ✓ ${Math.round(small.bytes.byteLength / 1024)} KB  ${url.slice(0, 80)}`);
    } catch (e) {
      opts.log?.(`  ✗ ${url.slice(0, 80)} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

/**
 * The artist's photos in Drive `Artist/Photos`, as `drive://<id>` URLs
 * `inlineImages` can fetch. Null when Google is not connected; not an error.
 */
export async function drivePhotos(): Promise<string[] | null> {
  const ws = await import("../../../../../engine/google/workspace");
  if (!(await ws.available())) return null;
  const branch = await ws.ensureArtistBranch(await ws.currentArtistName());
  if (!branch) return null;
  const { listFolder } = await import("../../../../../engine/google/drive");
  const files = await listFolder(branch.photosId);
  return files
    .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.mimeType))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => `${DRIVE_PREFIX}${f.id}`);
}
