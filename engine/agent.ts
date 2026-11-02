/**
 * Loads an agents/<slug>/ folder into a department the engine can run. Second
 * reader of the AGENT.md contract, beside agents/sync.ts. AGENT.md and SKILL.md
 * bodies go in the system prompt; knowledge/ is listed by title and opened with
 * read_knowledge, which keeps the prompt near 10k tokens instead of 60k.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  parseData,
  parseDoc,
  parseDrive,
  parseGoogle,
  parseList,
  parseServices,
  type DrivePermissions,
  type Front,
  type GoogleCapability,
  type Service,
} from "./frontmatter";

/** The repo root, from this file rather than process.cwd(): `houselabel` runs from anywhere. */
export const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const AGENTS_DIR = join(ROOT, "agents");

export interface Skill {
  name: string;
  description: string;
  body: string;
  /**
   * `task` means the engine runs this skill as a deterministic interview.
   * null until the department's overhaul (see engine/modes.ts).
   */
  mode: "task" | null;
  /**
   * The clause this skill adds to the greeting, after "I can". Not
   * `description`, which is trigger text written for a model.
   */
  greeting: string | null;
  greetingFr: string | null;
}

export interface KnowledgeFile {
  file: string;
  title: string;
}

export interface Department {
  /** Folder name under agents/, and the CLI verb: `houselabel press`. */
  name: string;
  slug: string;
  staffMember: string;
  description: string;
  department: string;
  /**
   * The greeting clause after "or just", from AGENT.md `discuss:` /
   * `discuss-fr:`. null falls back to the department's name.
   */
  discuss: string | null;
  discussFr: string | null;
  status: string;
  skills: Skill[];
  knowledge: KnowledgeFile[];
  /** Tables this department is allowed to touch, from AGENT.md `data:`. */
  tables: { catalog: string[]; artist: string[] };
  /**
   * Network tools, from AGENT.md `network:`. engine/tools.ts builds no fetching
   * tool not named here, so a department cannot reach the web by accident.
   */
  network: string[];
  /**
   * Google account permissions, from AGENT.md `google:`. Empty means no Google tool.
   */
  google: GoogleCapability[];
  /** Outside services (Buffer), from AGENT.md `services:`. Empty means no tool. */
  services: Service[];
  /**
   * Drive workspace folders this department may write and read, from AGENT.md
   * `drive:`. The OAuth scope is wide; this per-department list is the real boundary.
   */
  drive: DrivePermissions;
  body: string;
  front: Front;
}

/** Departments the artist never talks to (the Recruiting Agent builds the label). */
export const INTERNAL = new Set(["agent-recruitor"]);

/**
 * Skill order for the greeting, from AGENT.md's `skills:` line. Skills missing
 * from that line still appear afterwards, alphabetically, rather than being hidden.
 */
export function inDeclaredOrder(skills: Skill[], declared: string[]): Skill[] {
  const rank = new Map(declared.map((n, i) => [n, i]));
  return [...skills].sort((a, b) => {
    const ra = rank.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.name) ?? Number.MAX_SAFE_INTEGER;
    return ra === rb ? a.name.localeCompare(b.name) : ra - rb;
  });
}

async function loadSkills(dir: string): Promise<Skill[]> {
  const skillsDir = join(dir, "skills");
  const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const skills: Skill[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const text = await Bun.file(join(skillsDir, e.name, "SKILL.md")).text().catch(() => "");
    if (!text) continue;
    const { front, body } = parseDoc(text);
    // `metadata:` arrives from the parser as one joined string.
    const raw = front.metadata?.match(/\bmode:\s*(task)\b/)?.[1] ?? null;
    // `greeting:` / `greeting-fr:` sit inside that string; each runs to the
    // next known key or the end.
    const meta = front.metadata ?? "";
    const metaLine = (key: string) =>
      meta.match(new RegExp(`\\b${key}:\\s*(.+?)(?=\\s+\\b(?:agent|status|mode|greeting|greeting-fr|author|version):|$)`))?.[1]?.trim() ?? null;
    skills.push({
      name: e.name,
      description: front.description ?? "",
      body: body.trim(),
      mode: raw === "task" ? raw : null,
      greeting: metaLine("greeting"),
      greetingFr: metaLine("greeting-fr"),
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadKnowledgeIndex(dir: string): Promise<KnowledgeFile[]> {
  const kdir = join(dir, "knowledge");
  const files = (await readdir(kdir).catch(() => [])).filter((f) => f.endsWith(".md")).sort();
  const out: KnowledgeFile[] = [];
  for (const f of files) {
    const text = await Bun.file(join(kdir, f)).text().catch(() => "");
    const { front, body } = parseDoc(text);
    // `title:`, else the first heading, else the filename.
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    out.push({ file: f, title: front.title ?? front.description ?? heading ?? f.replace(/\.md$/, "") });
  }
  return out;
}

export async function loadDepartment(name: string): Promise<Department> {
  const dir = join(AGENTS_DIR, name);
  const text = await Bun.file(join(dir, "AGENT.md")).text().catch(() => "");
  if (!text) throw new Error(`no such department '${name}' — run \`houselabel --staff\` for the roster`);
  const { front, body } = parseDoc(text);

  return {
    name,
    slug: front.slug ?? name,
    staffMember: front["staff-member"] ?? front.department ?? name,
    description: front.description ?? "",
    department: front.department ?? name,
    discuss: front.discuss ?? null,
    discussFr: front["discuss-fr"] ?? null,
    status: front.status ?? "draft",
    // `skills:` comes back from the parser as one bracketed string. It sets the greeting order.
    skills: inDeclaredOrder(
      await loadSkills(dir),
      (front.skills ?? "").replace(/[[\]]/g, "").split(",").map((n) => n.trim()).filter(Boolean),
    ),
    knowledge: await loadKnowledgeIndex(dir),
    tables: parseData(front.data),
    // `network:` is a YAML flow list like `skills:`. It is independent of `google:`.
    network: parseList(front.network),
    google: parseGoogle(front.google),
    services: parseServices(front.services),
    drive: parseDrive(front.drive),
    body: body.trim(),
    front,
  };
}

/** Every department folder, internal ones included. */
export async function listDepartments(): Promise<string[]> {
  const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

/** The roster the artist is offered. */
export async function listStaff(): Promise<Department[]> {
  const names = (await listDepartments()).filter((n) => !INTERNAL.has(n));
  return Promise.all(names.map(loadDepartment));
}

/** Read one knowledge page. Path-checked: the model names the file. */
export async function readKnowledge(dept: string, file: string): Promise<string> {
  if (file.includes("/") || file.includes("..") || !file.endsWith(".md"))
    throw new Error(`'${file}' is not a knowledge page in this department`);
  const text = await Bun.file(join(AGENTS_DIR, dept, "knowledge", file)).text().catch(() => "");
  if (!text) throw new Error(`no knowledge page '${file}' — list them again before opening one`);
  return text;
}
