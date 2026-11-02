/**
 * Drive mechanics: make a folder path exist, upload, list. The tree's shape is
 * in workspace.ts and WORKSPACE.md. Every query is scoped to a parent folder
 * inside the workspace, despite the full `drive` scope.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { gapi, gapiBytes, gapiRaw } from "./api";

const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FILES = "https://www.googleapis.com/drive/v3/files";

/** Multipart upload: metadata and bytes in one request. Fine below ~5MB. */
async function uploadFile(opts: {
  name: string;
  mimeType: string;
  body: Buffer;
  /** Ask Drive to convert on the way in — PPTX becomes real Google Slides. */
  convertTo?: string;
  folderId?: string;
}): Promise<{ id: string }> {
  const boundary = `houselabel-${crypto.randomUUID()}`;
  const metadata = {
    name: opts.name,
    ...(opts.convertTo ? { mimeType: opts.convertTo } : {}),
    ...(opts.folderId ? { parents: [opts.folderId] } : {}),
  };

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\ncontent-type: ${opts.mimeType}\r\n\r\n`,
    ),
    opts.body,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return gapi<{ id: string }>(`the upload of "${opts.name}"`, `${UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** Anyone with the link can read. The artist keeps ownership. */
async function shareWithLink(fileId: string) {
  await gapi("sharing the file", `${FILES}/${fileId}/permissions`, {
    method: "POST",
    json: { type: "anyone", role: "reader" },
  });
}

/** Upload one document as itself, no conversion. */
export async function uploadDocument(opts: {
  name: string;
  mimeType: string;
  body: Buffer;
  folderId?: string;
  share?: boolean;
}): Promise<{ id: string; url: string }> {
  const file = await uploadFile(opts);
  if (opts.share !== false) await shareWithLink(file.id);
  return { id: file.id, url: `https://drive.google.com/file/d/${file.id}/view` };
}

const DOC_MIME = "application/vnd.google-apps.document";

/**
 * Upload text and get a native Google Doc back, never a `.md` file the artist
 * cannot edit. Returns the `docs.google.com/document/…` URL, which is what
 * goes on `artist.releases.credits_url`.
 */
export async function uploadAsGoogleDoc(opts: {
  name: string;
  /** Markdown or HTML. Drive reads both; HTML keeps more structure. */
  body: string;
  sourceMime?: "text/markdown" | "text/html" | "text/plain";
  folderId?: string;
  share?: boolean;
}): Promise<{ id: string; url: string }> {
  const file = await uploadFile({
    name: opts.name,
    mimeType: opts.sourceMime ?? "text/markdown",
    body: Buffer.from(opts.body, "utf8"),
    convertTo: DOC_MIME,
    folderId: opts.folderId,
  });
  if (opts.share !== false) await shareWithLink(file.id);
  return { id: file.id, url: `https://docs.google.com/document/d/${file.id}/edit` };
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Drive's query language has no escape sequence but the doubled quote. */
const quote = (s: string) => s.replace(/'/g, "\\'");

/**
 * One folder inside a known parent, created if absent. Scoped to `parentId` so
 * an unrelated artist folder with the same name is never matched.
 */
async function ensureChild(name: string, parentId: string): Promise<string> {
  const q = encodeURIComponent(
    `mimeType = '${FOLDER_MIME}' and name = '${quote(name)}' and '${parentId}' in parents and trashed = false`,
  );
  const { files } = await gapi<{ files?: { id: string }[] }>(
    `the folder "${name}"`,
    `${FILES}?q=${q}&fields=files(id)&pageSize=1`,
  );
  if (files?.[0]) return files[0].id;

  const created = await gapi<{ id: string }>(`creating "${name}"`, `${FILES}?fields=id`, {
    method: "POST",
    json: { name, mimeType: FOLDER_MIME, parents: [parentId] },
  });
  return created.id;
}

/** The workspace root in the artist's Drive, created once and reused. */
export async function ensureRoot(name: string): Promise<string> {
  const q = encodeURIComponent(
    `mimeType = '${FOLDER_MIME}' and name = '${quote(name)}' and 'root' in parents and trashed = false`,
  );
  const { files } = await gapi<{ files?: { id: string }[] }>(
    "the workspace folder",
    `${FILES}?q=${q}&fields=files(id)&pageSize=1`,
  );
  if (files?.[0]) return files[0].id;

  const created = await gapi<{ id: string }>("creating the workspace folder", `${FILES}?fields=id`, {
    method: "POST",
    json: { name, mimeType: FOLDER_MIME, parents: ["root"] },
  });
  return created.id;
}

/**
 * A whole path made to exist: `ensurePath(root, ["Releases", "2026-05_X", "Audio"])`.
 * Idempotent, so calling it on every save is intended. Sequential: each
 * segment needs its parent's id.
 */
export async function ensurePath(rootId: string, segments: string[]): Promise<string> {
  let id = rootId;
  for (const segment of segments) id = await ensureChild(segment, id);
  return id;
}

/** A file's bytes — what the artist dropped in a folder, a photo or a video. */
export async function downloadFile(fileId: string): Promise<Buffer> {
  return gapiBytes("downloading a file", `${FILES}/${fileId}?alt=media`);
}

/**
 * A direct media URL for services that fetch by link (Buffer). The file must
 * be link-shared, which `uploadBinary` does. See
 * https://developers.buffer.com/guides/hosting-media.html
 */
export const directImageUrl = (fileId: string) => `https://lh3.googleusercontent.com/d/${fileId}`;

/** The id at the end of a `drive.google.com/drive/folders/<id>` URL. */
export const folderIdFromUrl = (url: string): string | null => url.match(/\/folders\/([\w-]+)/)?.[1] ?? null;

/** Anyone with the link can read this folder and everything under it. */
export async function shareFolder(folderId: string): Promise<string> {
  await shareWithLink(folderId);
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  /** Bytes. Absent on folders and on Google-native files, which have no size. */
  size?: number;
  modifiedTime: string;
}

/**
 * What is in a folder, including files the artist added by hand. Presence is
 * not completion: callers like `manager-check-readiness` may only propose a
 * gate from it, never tick one.
 */
export async function listFolder(folderId: string): Promise<DriveEntry[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const out: DriveEntry[] = [];
  let pageToken: string | undefined;

  do {
    const page: { files?: (DriveEntry & { size?: string })[]; nextPageToken?: string } = await gapi(
      "the folder contents",
      `${FILES}?q=${q}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)` +
        `&orderBy=name&pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    for (const f of page.files ?? []) out.push({ ...f, size: f.size ? Number(f.size) : undefined });
    pageToken = page.nextPageToken;
  } while (pageToken);

  return out;
}

/** Bytes into a folder as themselves. Over the threshold, uses the resumable protocol. */
export async function uploadBinary(opts: {
  name: string;
  mimeType: string;
  body: Buffer;
  folderId: string;
  share?: boolean;
}): Promise<{ id: string; url: string }> {
  const file =
    opts.body.byteLength > RESUMABLE_THRESHOLD
      ? await uploadResumable(opts)
      : await uploadFile(opts);
  if (opts.share !== false) await shareWithLink(file.id);
  return { id: file.id, url: `https://drive.google.com/file/d/${file.id}/view` };
}

/** 5MB. Below it multipart is one round trip; above it, one failure is fatal. */
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024;

/**
 * Resumable upload in two requests: reserve a session URL, send the bytes.
 * Single-chunk, since the whole buffer is already in memory.
 */
async function uploadResumable(opts: {
  name: string;
  mimeType: string;
  body: Buffer;
  folderId?: string;
}): Promise<{ id: string }> {
  const session = await gapiRaw(
    `starting the upload of "${opts.name}"`,
    `${UPLOAD}?uploadType=resumable&fields=id`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": opts.mimeType,
        "x-upload-content-length": String(opts.body.byteLength),
      },
      json: { name: opts.name, ...(opts.folderId ? { parents: [opts.folderId] } : {}) },
    },
  );

  const location = session.headers.get("location");
  if (!location) throw new Error(`Drive did not return an upload session for "${opts.name}".`);

  return gapi<{ id: string }>(`the upload of "${opts.name}"`, location, {
    method: "PUT",
    headers: {
      "content-type": opts.mimeType,
      "content-range": `bytes 0-${opts.body.byteLength - 1}/${opts.body.byteLength}`,
    },
    body: opts.body,
  });
}
