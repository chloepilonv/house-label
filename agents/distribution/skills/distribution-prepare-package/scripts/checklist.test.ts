/**
 * The checklist is arithmetic. The cases that matter are where the store and
 * the distributor disagree.
 */
import { describe, expect, test } from "bun:test";
import { buildChecklist } from "./checklist";

const at = (items: ReturnType<typeof buildChecklist>, id: string) => items.find((i) => i.item === id)!;
const CD_BABY = { name: "CD Baby", artwork_min_px: 1400, artwork_max_px: 3000, artwork_formats: ["png", "gif", "jpg", "jpeg"], audio_formats: ["wav", "flac"] };

describe("artwork resolution", () => {
  test("1000-1599 clears the store floor but FAILS CD Baby's 1400", () => {
    // Why `whose_rule` exists: only one of these is fixed by switching distributor.
    const store = at(buildChecklist({ artwork_size: "1000 to 1599" }), "artwork_size");
    expect(store.status).toBe("ready");
    expect(store.whose_rule).toBe("store");

    const cd = at(buildChecklist({ artwork_size: "1000 to 1599" }, CD_BABY), "artwork_size");
    expect(cd.status).toBe("missing");
    expect(cd.whose_rule).toBe("distributor");
    expect(cd.detail).toContain("CD Baby");
    expect(cd.fix).toContain("3000");
  });

  test("3000 or more clears everyone", () => {
    expect(at(buildChecklist({ artwork_size: "3000 or more" }, CD_BABY), "artwork_size").status).toBe("ready");
  });

  test("not sure is unknown, never a guess", () => {
    const i = at(buildChecklist({ artwork_size: "i'm not sure" }, CD_BABY), "artwork_size");
    expect(i.status).toBe("unknown");
    expect(i.fix).toContain("1400");
  });
});

describe("audio", () => {
  test("MP3 is refused as a delivery format, and says why", () => {
    const i = at(buildChecklist({ audio_format: "mp3 only" }), "audio_format");
    expect(i.status).toBe("missing");
    expect(i.detail).toContain("press");
  });

  test("WAV clears CD Baby; RouteNote's wav-less list does not", () => {
    expect(at(buildChecklist({ audio_format: "wav" }, CD_BABY), "audio_format").status).toBe("ready");
    const rn = at(buildChecklist({ audio_format: "wav" }, { name: "RouteNote", audio_formats: ["flac", "mp3"] }), "audio_format");
    expect(rn.status).toBe("missing");
    expect(rn.fix).toContain("FLAC");
  });
});

describe("cover content — the real rejection cause", () => {
  test("a social handle fails, and the fix is named", () => {
    const i = at(buildChecklist({ artwork_content: ["name", "handle"] }), "artwork_content");
    expect(i.status).toBe("missing");
    expect(i.detail).toContain("handle");
  });

  test("name and title alone are fine", () => {
    expect(at(buildChecklist({ artwork_content: ["name", "title"] }), "artwork_content").status).toBe("ready");
  });
});

describe("optional items", () => {
  test("lyrics always appear and never block", () => {
    // `required` carries optionality, not the label; "(optional)" is added at render time.
    const i = at(buildChecklist({}), "lyrics");
    expect(i.required).toBe(false);
    expect(i.label).toBe("Lyrics");
    expect(buildChecklist({}).some((x) => x.item === "lyrics")).toBe(true);
  });

  test("an instrumental is not_applicable, not missing", () => {
    expect(at(buildChecklist({ lyrics: "instrumental" }), "lyrics").status).toBe("not_applicable");
  });
});

describe("the pitch deadline is computed, not asserted", () => {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  test("30 days out still makes the editorial window", () => {
    expect(at(buildChecklist({ release_date: inDays(30) }), "pitch_deadline").status).toBe("ready");
  });

  test("3 days out has missed it, and says what is still possible", () => {
    const i = at(buildChecklist({ release_date: inDays(3) }), "pitch_deadline");
    expect(i.status).toBe("missing");
    expect(i.fix).toContain("Release Radar");
  });
});

test("an empty interview still produces the full list, all unknown", () => {
  const items = buildChecklist({});
  expect(items.length).toBeGreaterThanOrEqual(7);
  expect(items.filter((i) => i.status === "ready")).toHaveLength(0);
});
