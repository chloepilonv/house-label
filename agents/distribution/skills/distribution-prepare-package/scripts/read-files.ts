/**
 * Answer the package interview's technical questions (cover size and type,
 * audio format, bit depth, sample rate) by measuring the artist's files.
 * Read-only: the masters may be the artist's only copy.
 *
 *   bun run .../read-files.ts ~/Music/Sables/*.wav ~/Music/Sables/cover.jpg
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { bandFor, inspect, specsFor, type Facts } from "../../../../../engine/media";

export interface FromFiles {
  /** Answers, keyed as the interview keys them. Merged over what was said. */
  answers: Record<string, string>;
  /** One line per file, for the artist to check we read the right things. */
  notes: string[];
}

/**
 * Turn a set of files into interview answers. The weakest file wins: a
 * release is only as deliverable as its worst cover or audio spec.
 */
export function readFiles(files: { name: string; bytes: Uint8Array }[]): FromFiles {
  const answers: Record<string, string> = {};
  const notes: string[] = [];
  let smallest: number | null = null;
  const audioFormats = new Set<string>();
  const specs = new Set<string>();

  for (const { name, bytes } of files) {
    const f: Facts = inspect(bytes);
    if (f.kind === "image") {
      const px = Math.min(f.width, f.height);
      smallest = smallest === null ? px : Math.min(smallest, px);
      answers.artwork_format = f.format === "jpeg" ? "jpg" : f.format;
      notes.push(
        `${name}: ${f.width}×${f.height} ${f.format.toUpperCase()}` +
          (f.square ? "" : " — NOT SQUARE, every store requires 1:1"),
      );
    } else if (f.kind === "audio") {
      audioFormats.add(f.format);
      const s = specsFor(f);
      if (s) specs.add(s);
      notes.push(
        `${name}: ${f.format.toUpperCase()}` +
          (f.bitDepth && f.sampleRate ? ` ${f.bitDepth}-bit / ${f.sampleRate / 1000}kHz` : "") +
          (f.channels === 1 ? " — MONO, stores expect stereo" : ""),
      );
    } else {
      // Never guessed from the extension; an unreadable file is reported.
      notes.push(`${name}: not a format I can read (${f.head}) — check it opens`);
    }
  }

  if (smallest !== null) answers.artwork_size = bandFor(smallest);
  // A mixed set is a finding, not an answer: one format is wrong.
  if (audioFormats.size === 1) answers.audio_format = [...audioFormats][0]!;
  else if (audioFormats.size > 1) notes.push(`mixed audio formats: ${[...audioFormats].join(", ")} — deliver one`);
  if (specs.size === 1) answers.audio_specs = [...specs][0]!;
  else if (specs.size > 1) notes.push(`mixed audio specs: ${[...specs].join(", ")} — the weakest one is what ships`);

  return { answers, notes };
}

if (import.meta.main) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error("✗ Usage: bun run .../read-files.ts <file> [file...]");
    console.error("  Give it your masters and your cover; it reads the rest.");
    process.exit(1);
  }
  const files = [];
  for (const p of paths) {
    try {
      if (!statSync(p).isFile()) continue;
      files.push({ name: basename(p), bytes: readFileSync(p) });
    } catch {
      console.error(`  ✗ cannot open ${p}`);
    }
  }
  if (!files.length) { console.error("✗ Nothing readable."); process.exit(1); }

  const { answers, notes } = readFiles(files);
  console.log(`\n  read ${files.length} file(s):\n`);
  for (const n of notes) console.log(`    ${n}`);
  console.log(`\n  which answers:\n`);
  for (const [k, v] of Object.entries(answers)) console.log(`    ${k.padEnd(16)} ${v}`);
  console.log(`\n  nothing was written. Give these to the package check.\n`);
  process.exit(0);
}
