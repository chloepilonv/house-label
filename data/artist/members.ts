/**
 * Shape of artist.profile.members. Lives in data/, not in engine/profile.ts,
 * because brief/rules.ts reads it too and data/ must not import engine/.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface Member {
  name: string;
  role: string | null;
}

// One line: "Ali (drums), Jo (bass, backing vocals)".
const MEMBER_LINE = /^(.*?)\s*\(([^)]*)\)\s*$/;

export function parseMembers(line: string): Member[] {
  return line
    .split(",")
    // A role may contain a comma, "Jo (bass, vocals)": rejoin any fragment
    // with an unclosed parenthesis.
    .reduce<string[]>((acc, part) => {
      const open = acc.length ? acc[acc.length - 1]! : "";
      if (acc.length && (open.match(/\(/g)?.length ?? 0) > (open.match(/\)/g)?.length ?? 0))
        acc[acc.length - 1] = `${open},${part}`;
      else acc.push(part);
      return acc;
    }, [])
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = MEMBER_LINE.exec(p);
      return m ? { name: m[1]!.trim(), role: m[2]!.trim() || null } : { name: p, role: null };
    })
    .filter((m) => m.name);
}

/** Exact inverse of parseMembers: the edit screen prefills the input with it. */
export const renderMembers = (members: Member[]): string =>
  members.map((m) => (m.role ? `${m.name} (${m.role})` : m.name)).join(", ");

/** postgres returns jsonb already parsed; a hand-written row may be a string. */
export function readMembers(v: unknown): Member[] {
  const raw = typeof v === "string" ? safeJson(v) : v;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {}))
    .map((m) => ({
      name: typeof m.name === "string" ? m.name : "",
      role: typeof m.role === "string" && m.role ? m.role : null,
    }))
    .filter((m) => m.name);
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
