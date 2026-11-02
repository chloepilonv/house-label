/**
 * The package checklist: one deterministic row per thing a release needs.
 * Each item says whose rule it is (distributor, then store baseline, then
 * unknown), since only a distributor's rule is escaped by switching.
 * Optional items appear with `required = false` and never block.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export type Status = "ready" | "missing" | "unknown" | "not_applicable";

export interface Item {
  item: string;
  label: string;
  status: Status;
  required: boolean;
  detail?: string;
  fix?: string;
  whose_rule: "store" | "distributor" | "unknown";
  source?: string;
}

/** What the distributor itself demands, when the catalog knows. */
export interface DistributorRules {
  name?: string;
  artwork_formats?: string[];
  artwork_min_px?: number | null;
  artwork_max_px?: number | null;
  audio_formats?: string[];
}

/** The store floor, from knowledge/delivery-requirements.md. */
const STORE = {
  artworkMin: 640, // Spotify's floor. NOT 3000 — that is Apple's recommendation.
  artworkMax: 10000,
  artworkFormats: ["jpg", "jpeg", "png", "tiff"],
  audioFormats: ["wav", "flac", "aiff"],
  pitchDays: 7, // Spotify editorial, verified
};

/** The bands the interview offers, as the number each one is at least. */
const PX_BAND: Record<string, number> = {
  "under 1000": 640,
  "1000 to 1399": 1000,
  // Split at 1400, CD Baby's floor.
  "1400 to 1599": 1400,
  "1000 to 1599": 1000, // an answer saved before the split
  "1600 to 2999": 1600,
  "3000 or more": 3000,
};

const unsure = (v: unknown): boolean =>
  typeof v === "string" && /^(i'?m not sure|i don'?t know|unknown)/i.test(v.trim());

/**
 * Turn answers into items. `rules` is the distributor's row when known;
 * absent, every check falls back to the store baseline and says so.
 */
export function buildChecklist(
  answers: Record<string, unknown>,
  rules: DistributorRules = {},
): Item[] {
  const items: Item[] = [];
  const has = (k: string) => answers[k] !== undefined && !unsure(answers[k]);

  // ── audio ──────────────────────────────────────────────────────────────
  const fmt = String(answers.audio_format ?? "").toLowerCase();
  const accepted = rules.audio_formats?.length ? rules.audio_formats : STORE.audioFormats;
  const whoseAudio = rules.audio_formats?.length ? "distributor" : "store";
  if (!has("audio_format")) {
    items.push({ item: "audio_format", label: "Audio file format", status: "unknown", required: true,
      fix: "Check what your masters were exported as — WAV, FLAC or AIFF.", whose_rule: whoseAudio, source: rules.name });
  } else if (fmt.includes("mp3")) {
    items.push({ item: "audio_format", label: "Audio file format", status: "missing", required: true,
      detail: "MP3 is not a delivery format — it is what you send to press.",
      fix: "Export the masters as WAV or FLAC at the rate they were mastered.",
      whose_rule: "store" });
  } else if (accepted.some((a) => fmt.includes(a))) {
    items.push({ item: "audio_format", label: "Audio file format", status: "ready", required: true,
      detail: `${fmt.toUpperCase()} — accepted`, whose_rule: whoseAudio, source: rules.name });
  } else {
    items.push({ item: "audio_format", label: "Audio file format", status: "missing", required: true,
      detail: `${fmt} — ${rules.name ?? "the stores"} take ${accepted.join(", ")}`,
      fix: `Convert to ${accepted[0]?.toUpperCase()}.`, whose_rule: whoseAudio, source: rules.name });
  }

  // Never "upgrade" a master. The rule is deliver-as-mastered.
  items.push(
    has("audio_specs")
      ? { item: "audio_specs", label: "Bit depth and sample rate", status: "ready", required: false,
          detail: `${answers.audio_specs} — deliver exactly as mastered, never upconverted`, whose_rule: "store" }
      : { item: "audio_specs", label: "Bit depth and sample rate", status: "unknown", required: false,
          fix: "44.1kHz is the floor. Send what you mastered; upconverting can cost lossless eligibility.",
          whose_rule: "store" },
  );

  // ── artwork ────────────────────────────────────────────────────────────
  const minPx = rules.artwork_min_px ?? STORE.artworkMin;
  const whosePx = rules.artwork_min_px != null ? "distributor" : "store";
  const band = PX_BAND[String(answers.artwork_size ?? "")];
  if (!has("artwork_size") || band === undefined) {
    items.push({ item: "artwork_size", label: "Cover art resolution", status: "unknown", required: true,
      fix: `Right-click the file → Get Info. It needs to be at least ${minPx}px square${whosePx === "distributor" ? ` for ${rules.name}` : " for the stores; nobody has checked what your distributor asks for"}.`,
      whose_rule: whosePx, source: rules.name });
  } else if (band >= minPx) {
    items.push({ item: "artwork_size", label: "Cover art resolution", status: "ready", required: true,
      detail: `${answers.artwork_size}px — clears the ${minPx}px minimum`, whose_rule: whosePx, source: rules.name });
  } else {
    items.push({ item: "artwork_size", label: "Cover art resolution", status: "missing", required: true,
      detail: `${answers.artwork_size}px — ${rules.name ?? "the stores"} need ${minPx}px`,
      fix: `Re-export the cover at ${Math.max(minPx, 3000)}×${Math.max(minPx, 3000)}. 3000 clears every distributor.`,
      whose_rule: whosePx, source: rules.name });
  }

  const okFormats = rules.artwork_formats?.length ? rules.artwork_formats : STORE.artworkFormats;
  const af = String(answers.artwork_format ?? "").toLowerCase();
  items.push(
    !has("artwork_format")
      ? { item: "artwork_format", label: "Cover art file type", status: "unknown", required: false,
          fix: "JPG is accepted everywhere.", whose_rule: "unknown", source: rules.name }
      : okFormats.some((o) => af.includes(o))
        ? { item: "artwork_format", label: "Cover art file type", status: "ready", required: false,
            detail: `${af.toUpperCase()} — accepted`,
            whose_rule: rules.artwork_formats?.length ? "distributor" : "store", source: rules.name }
        : { item: "artwork_format", label: "Cover art file type", status: "missing", required: false,
            detail: `${af} — ${rules.name ?? "the stores"} take ${okFormats.join(", ")}`,
            fix: "Export as JPG; it clears everyone.",
            whose_rule: rules.artwork_formats?.length ? "distributor" : "store", source: rules.name },
  );

  // The most common rejection cause, and it is content, not spec.
  const on = (answers.artwork_content as string[] | undefined) ?? [];
  const banned = on.filter((x) => ["url", "handle", "logo"].includes(x));
  items.push(
    !answers.artwork_content
      ? { item: "artwork_content", label: "What is printed on the cover", status: "unknown", required: true,
          fix: "A URL, QR code, social handle or third-party logo is an automatic rejection at every store.",
          whose_rule: "store" }
      : banned.length
        ? { item: "artwork_content", label: "What is printed on the cover", status: "missing", required: true,
            detail: `${banned.join(", ")} on the cover — an automatic rejection at every store`,
            fix: "Remove it and re-export. Artist name and release title are fine; nothing else is.",
            whose_rule: "store" }
        : { item: "artwork_content", label: "What is printed on the cover", status: "ready", required: true,
            detail: "nothing that gets a cover rejected", whose_rule: "store" },
  );

  // ── identifiers, lyrics, timing ────────────────────────────────────────
  const ids = String(answers.identifiers ?? "");
  items.push(
    !has("identifiers")
      ? { item: "identifiers", label: "ISRCs and UPC", status: "unknown", required: true,
          fix: `${rules.name ?? "Your distributor"} issues both free if you don't have them.`,
          whose_rule: "store", source: rules.name }
      : ids.startsWith("both")
        ? { item: "identifiers", label: "ISRCs and UPC", status: "ready", required: true, whose_rule: "store" }
        : { item: "identifiers", label: "ISRCs and UPC", status: "missing", required: true,
            detail: ids,
            fix: `${rules.name ?? "Your distributor"} issues both free at upload. One ISRC per recording, one UPC per release.`,
            whose_rule: "store", source: rules.name },
  );

  // Required by no store; listed as optional.
  const lyr = String(answers.lyrics ?? "");
  items.push({
    item: "lyrics", label: "Lyrics",
    status: lyr === "yes" ? "ready" : lyr === "instrumental" ? "not_applicable" : has("lyrics") ? "missing" : "unknown",
    required: false,
    detail: "No store requires them. They feed the lyric display on Spotify and Apple Music.",
    fix: lyr === "no" ? "Write them out any time before release; they can be added later." : undefined,
    whose_rule: "store",
  });

  if (typeof answers.release_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(answers.release_date)) {
    const days = Math.round((Date.parse(answers.release_date) - Date.now()) / 86_400_000);
    items.push({
      item: "pitch_deadline", label: "Spotify editorial pitch",
      // The track must be delivered and pitched seven days before release,
      // plus the distributor's own window.
      status: days > STORE.pitchDays ? "ready" : "missing", required: false,
      detail: days > 0 ? `${days} days to release; the pitch closes ${STORE.pitchDays} days before` : "the release date has passed",
      fix: days <= STORE.pitchDays ? "Too late for editorial. Release Radar still reaches your followers." : undefined,
      whose_rule: "store",
    });
  }

  return items;
}
