/**
 * Reads image and audio specs from file headers, so the artist is not asked.
 * Takes a Buffer, never a path; no network, filesystem or dependencies.
 * An unrecognised file is `kind: "unknown"`, never a guess.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface ImageFacts {
  kind: "image";
  format: "jpg" | "png" | "gif" | "tiff" | "webp";
  width: number;
  height: number;
  square: boolean;
}

export interface AudioFacts {
  kind: "audio";
  format: "wav" | "flac" | "aiff" | "mp3";
  /** Null when the format does not state it in a header we read. */
  sampleRate: number | null;
  bitDepth: number | null;
  channels: number | null;
}

export interface UnknownFacts {
  kind: "unknown";
  /** The first bytes, so a human can say what it was. Never a guess. */
  head: string;
}

export type Facts = ImageFacts | AudioFacts | UnknownFacts;

const u16 = (b: Uint8Array, i: number, le = false) => (le ? b[i]! | (b[i + 1]! << 8) : (b[i]! << 8) | b[i + 1]!);
const u32 = (b: Uint8Array, i: number, le = false) =>
  le
    ? (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0
    : ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));

/** JPEG stores size in a SOF marker, which can be anywhere after the header. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1]!;
    // SOF0..SOF15, excluding the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: u16(b, i + 5), width: u16(b, i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    i += 2 + u16(b, i + 2);
  }
  return null;
}

/** WAV: walk the RIFF chunks to `fmt `. The header is not always at byte 12. */
function wavFacts(b: Uint8Array): AudioFacts | null {
  let i = 12;
  while (i + 8 <= b.length) {
    const id = ascii(b, i, 4);
    const size = u32(b, i + 4, true);
    if (id === "fmt " && i + 8 + 16 <= b.length) {
      return {
        kind: "audio", format: "wav",
        channels: u16(b, i + 10, true),
        sampleRate: u32(b, i + 12, true),
        bitDepth: u16(b, i + 22, true),
      };
    }
    // Chunks are word-aligned; an odd size is followed by a pad byte.
    i += 8 + size + (size % 2);
  }
  return null;
}

/** FLAC: the STREAMINFO block is always first, and its layout is fixed. */
function flacFacts(b: Uint8Array): AudioFacts | null {
  if (b.length < 34) return null;
  // 20 bits of sample rate, then 3 of channels-1, then 5 of bits-per-sample-1,
  // packed across bytes 18-20 of the block.
  const x = (u32(b, 18) >>> 12) & 0xfffff;
  const ch = ((b[20]! >> 1) & 0x07) + 1;
  const bits = (((b[20]! & 0x01) << 4) | (b[21]! >> 4)) + 1;
  return { kind: "audio", format: "flac", sampleRate: x, channels: ch, bitDepth: bits };
}

/** AIFF: the COMM chunk, whose sample rate is an 80-bit extended float. */
function aiffFacts(b: Uint8Array): AudioFacts | null {
  let i = 12;
  while (i + 8 <= b.length) {
    const id = ascii(b, i, 4);
    const size = u32(b, i + 4);
    if (id === "COMM" && i + 8 + 18 <= b.length) {
      const e = i + 16;
      const exp = u16(b, e) - 16383;
      const mant = u32(b, e + 2);
      return {
        kind: "audio", format: "aiff",
        channels: u16(b, i + 8),
        bitDepth: u16(b, i + 14),
        sampleRate: Math.round(mant * Math.pow(2, exp - 31)),
      };
    }
    i += 8 + size + (size % 2);
  }
  return null;
}

/**
 * What this file is, from its magic bytes, so a renamed file (a PNG named
 * `cover.jpg`) reports what it is.
 */
export function inspect(buf: Uint8Array): Facts {
  const b = buf;
  const head = Array.from(b.slice(0, 8)).map((x) => x.toString(16).padStart(2, "0")).join(" ");

  // ── images ────────────────────────────────────────────────────────────
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") {
    return { kind: "image", format: "png", width: u32(b, 16), height: u32(b, 20), square: u32(b, 16) === u32(b, 20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    const s = jpegSize(b);
    if (s) return { kind: "image", format: "jpg", ...s, square: s.width === s.height };
  }
  if (ascii(b, 0, 3) === "GIF") {
    const w = u16(b, 6, true), h = u16(b, 8, true);
    return { kind: "image", format: "gif", width: w, height: h, square: w === h };
  }
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    // VP8X carries the canvas size as two 24-bit values, minus one.
    if (ascii(b, 12, 4) === "VP8X") {
      const w = (b[24]! | (b[25]! << 8) | (b[26]! << 16)) + 1;
      const h = (b[27]! | (b[28]! << 8) | (b[29]! << 16)) + 1;
      return { kind: "image", format: "webp", width: w, height: h, square: w === h };
    }
  }
  if ((ascii(b, 0, 2) === "II" && b[2] === 42) || (ascii(b, 0, 2) === "MM" && b[3] === 42)) {
    const le = ascii(b, 0, 2) === "II";
    const ifd = u32(b, 4, le);
    const n = u16(b, ifd, le);
    let w = 0, h = 0;
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      const tag = u16(b, e, le);
      // A tag's value is SHORT (type 3) or LONG (type 4) in the same four-byte
      // field; a SHORT occupies only the first two.
      const type = u16(b, e + 2, le);
      const v = type === 3 ? u16(b, e + 8, le) : u32(b, e + 8, le);
      if (tag === 0x0100) w = v;
      if (tag === 0x0101) h = v;
    }
    if (w && h) return { kind: "image", format: "tiff", width: w, height: h, square: w === h };
  }

  // ── audio ─────────────────────────────────────────────────────────────
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") {
    const f = wavFacts(b);
    if (f) return f;
  }
  if (ascii(b, 0, 4) === "fLaC") {
    const f = flacFacts(b);
    if (f) return f;
  }
  if (ascii(b, 0, 4) === "FORM" && (ascii(b, 8, 4) === "AIFF" || ascii(b, 8, 4) === "AIFC")) {
    const f = aiffFacts(b);
    if (f) return f;
  }
  // MP3 is identified but not measured: it is not a delivery format.
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0)) {
    return { kind: "audio", format: "mp3", sampleRate: null, bitDepth: null, channels: null };
  }

  return { kind: "unknown", head };
}

/** The checklist speaks in bands, not pixels. This is the bridge. */
export const bandFor = (px: number): string =>
  px < 1000 ? "under 1000" : px < 1600 ? "1000 to 1599" : px < 3000 ? "1600 to 2999" : "3000 or more";

/** And in the interview's own words for bit depth and rate. */
export function specsFor(a: AudioFacts): string | null {
  if (!a.bitDepth || !a.sampleRate) return null;
  const khz = a.sampleRate / 1000;
  if (a.bitDepth === 16 && khz === 44.1) return "16-bit / 44.1khz";
  if (a.bitDepth === 24 && khz === 44.1) return "24-bit / 44.1khz";
  if (a.bitDepth >= 24 && khz >= 48) return "24-bit / 48khz or higher";
  return null;
}
