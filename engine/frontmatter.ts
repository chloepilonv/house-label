/**
 * One YAML-ish frontmatter reader, shared by everything that loads an agent.
 *
 * agents/sync.ts keeps its own copy of the same grammar so the contract
 * check does not depend on the runtime.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export type Front = Record<string, string>;

export interface Doc {
  front: Front;
  body: string;
}

/** `---\n...\n---\n<body>`. A file with no frontmatter is all body. */
export function parseDoc(src: string): Doc {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { front: {}, body: src };
  const [, raw, body] = m;
  const front: Front = {};
  const lines = raw!.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i]!.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!km) continue;
    let [, key, val] = km;
    if (val === ">" || val === "|" || val === "") {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]!)) block.push(lines[++i]!.trim());
      val = block.join(" ");
    }
    front[key!] = val!.trim();
  }
  return { front, body: body! };
}

/** The `[a, b, c]` inline lists AGENT.md uses for `skills:`. */
export function parseList(val: string | undefined): string[] {
  if (!val) return [];
  return (val.match(/\[([^\]]*)\]/)?.[1] ?? val)
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * Tables named under a `data:` key, split by prefix. `proposed:` is dropped:
 * those tables do not exist yet.
 */
/**
 * The outside services an AGENT.md declares: `services: [buffer]`. Tools live
 * in engine/<service>/tools.ts. Required on every AGENT.md, `[]` included.
 */
export const SERVICES = ["buffer", "hunter"] as const;
export type Service = (typeof SERVICES)[number];

export function parseServices(val: string | undefined): Service[] {
  return parseList(val).filter((v): v is Service => (SERVICES as readonly string[]).includes(v));
}

/**
 * The Google capabilities an AGENT.md declares: `google: [drive, calendar]`.
 * `[]` means "needs nothing"; agents/sync.ts requires the key on every AGENT.md.
 */
export const GOOGLE_CAPABILITIES = ["drive", "calendar", "gmail"] as const;
export type GoogleCapability = (typeof GOOGLE_CAPABILITIES)[number];

export function parseGoogle(val: string | undefined): GoogleCapability[] {
  return parseList(val).filter((v): v is GoogleCapability =>
    (GOOGLE_CAPABILITIES as readonly string[]).includes(v),
  );
}

/**
 * The folders of the artist's Drive workspace, as stable tokens so paths can
 * change without editing AGENT.md. engine/google/workspace.ts is the only place
 * that maps token to path. `releases` is the release folder itself; `budget`
 * is the root money folder.
 */
export const WORKSPACE_FOLDERS = [
  "artist/presskit",
  "artist/photos",
  "artist/brand",
  "artist/admin",
  "releases",
  "releases/songs",
  "releases/audio",
  "releases/lyrics",
  "releases/artwork",
  "releases/video",
  "releases/digital-contents",
  "budget",
] as const;
export type WorkspaceFolder = (typeof WORKSPACE_FOLDERS)[number];

export interface DrivePermissions {
  /** Folders this department creates files in. */
  write: WorkspaceFolder[];
  /** Folders it may read and never write, including what the artist put there. */
  read: WorkspaceFolder[];
}

/**
 * `drive:` with its `write:` and `read:` lists, from an AGENT.md. The OAuth
 * scope is full `drive`; this is the narrower boundary the code enforces.
 * Unknown tokens are dropped here and rejected by agents/sync.ts.
 */
export function parseDrive(val: string | undefined): DrivePermissions {
  const known = new Set<string>(WORKSPACE_FOLDERS);
  const grab = (key: string) =>
    parseList(new RegExp(`${key}:\\s*(\\[[^\\]]*\\])`).exec(val ?? "")?.[1]).filter(
      (f): f is WorkspaceFolder => known.has(f),
    );
  return { write: grab("write"), read: grab("read") };
}

export function parseData(data: string | undefined): { catalog: string[]; artist: string[] } {
  const grab = (key: string) =>
    [...((data ?? "").match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/[a-z_]+\.([a-z_]+)/g)].map(
      (m) => m[1]!,
    );
  return { catalog: grab("catalog"), artist: grab("artist") };
}
