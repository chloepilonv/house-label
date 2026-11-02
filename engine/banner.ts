/**
 * The record on the turntable, printed once at the top of a session.
 * NO_COLOR and non-TTY output fall back to plain text.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

const COLOR = !process.env.NO_COLOR && process.stdout.isTTY;
const c = (code: string, s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);

export const dim = (s: string) => c("2", s);
export const bold = (s: string) => c("1", s);
export const gold = (s: string) => c("38;5;179", s);
export const plum = (s: string) => c("38;5;139", s);

const DISC = [
  "      ▄▄▄▄▄▄▄▄▄      ",
  "   ▄██▀▀▀   ▀▀▀██▄   ",
  " ▄█▀   ▄▄▄▄▄▄▄   ▀█▄ ",
  "██   ▄█▀     ▀█▄   ██",
  "█   █▀   ▄▄▄   ▀█   █",
  "█   █   █ ◉ █   █   █",
  "█   █▄   ▀▀▀   ▄█   █",
  "██   ▀█▄     ▄█▀   ██",
  " ▀█▄   ▀▀▀▀▀▀▀   ▄█▀ ",
  "   ▀██▄▄▄   ▄▄▄██▀   ",
  "      ▀▀▀▀▀▀▀▀▀      ",
];

/** Right-hand column, aligned to the middle of the disc. */
function plate(lines: string[]): string[] {
  const out = new Array(DISC.length).fill("");
  const top = Math.max(0, Math.floor((DISC.length - lines.length) / 2));
  lines.forEach((l, i) => (out[top + i] = l));
  return out;
}

export function banner(subtitle = "the label, on your machine"): string {
  const right = plate([
    bold(gold("H O U S E L A B E L")),
    dim("───────────────────────────────"),
    dim(subtitle),
  ]);
  // A narrow pane (Claude Desktop's side terminal) wraps the side-by-side
  // version into noise; below 66 columns the title goes under the disc.
  const cols = process.stdout.columns ?? 80;
  if (cols < 66) {
    const disc = DISC.map((row) => `  ${plum(row)}`).join("\n");
    return `\n${disc}\n\n  ${bold(gold("H O U S E L A B E L"))}\n  ${dim(subtitle)}\n`;
  }
  const art = DISC.map((row, i) => `  ${plum(row)}   ${right[i]}`).join("\n");
  return `\n${art}\n`;
}

/** The line under the banner once we know who is in the room. */
export function nowPlaying(staff: string, department: string): string {
  return `  ${dim("side a ·")} ${bold(staff)} ${dim(`· ${department}`)}\n`;
}
