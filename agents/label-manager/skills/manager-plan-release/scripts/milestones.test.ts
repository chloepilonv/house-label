/**
 * What the plan must never do.
 *
 *   bun test agents/label-manager
 *
 * The completeness test is the load-bearing one: every expected step traces to
 * a published checklist in knowledge/release-path.md, so a step that drops out
 * of the plan fails here.
 */
import { expect, test, describe } from "bun:test";
import {
  MILESTONES, PHASE_ORDER, PROPOSED, SOURCES, anchorsFor, resolve, type Scope,
} from "./milestones";
import {
  QUESTIONS, askable, branchesFor, plannedTotal, validate,
} from "../../manager-scope-project/scripts/questions";

const EP: Scope = {
  projectType: "ep",
  branches: ["creation", "rights", "distribution", "presskit", "press", "campaign", "post_release"],
  physical: "none",
  recordingStatus: "tracking",
  markets: ["quebec", "canada"],
};
const STREET = "2026-10-30";
const TODAY = "2026-08-26";

describe("the catalog itself", () => {
  test("milestone keys are unique — the upsert is keyed on them", () => {
    const keys = MILESTONES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every milestone says where its date came from, in both languages", () => {
    for (const m of MILESTONES) {
      expect(m.basis.en.length).toBeGreaterThan(20);
      expect(m.basis.fr.length).toBeGreaterThan(20);
      expect(m.title.fr).not.toBe(m.title.en);
    }
  });

  test("a milestone with no owner says why — the gap is the output", () => {
    for (const m of MILESTONES) {
      if (m.owner === null && m.key !== "release_day") expect(m.gapReason).toBeDefined();
    }
  });
});

describe("dates", () => {
  test("is deterministic — same scope, same plan", () => {
    const a = resolve(EP, STREET, TODAY);
    const b = resolve(EP, STREET, TODAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("every milestone has either a date or a reason it has none", () => {
    for (const m of resolve(EP, STREET, TODAY).milestones) {
      if (m.date === null) expect(m.noDateReason).toBeDefined();
      else expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("vinyl moves the whole plan back to the 12-week end, not the 8", () => {
    const vinyl = resolve({ ...EP, physical: "vinyl", branches: [...EP.branches, "manufacturing"] }, STREET, TODAY);
    const plant = vinyl.milestones.find((m) => m.key === "plant_booked");
    expect(plant?.date).toBe("2026-08-07"); // 84 days before
    // and the masters are due at the plant, not at the upload
    expect(vinyl.milestones.find((m) => m.key === "masters_done")?.date).toBe("2026-08-07");
  });

  test("with no physical, the masters are due at the advance link, not at the upload", () => {
    // 9 weeks out: the link goes up at 8, and a master that lands the same
    // morning is a link that goes up late.
    expect(anchorsFor(EP).mastersDue).toBe(-63);
    expect(resolve(EP, STREET, TODAY).milestones.find((m) => m.key === "masters_done")?.date)
      .toBe("2026-08-28");
  });

  test("the upload clears Spotify's 7-day floor, and beats the editorial pitch", () => {
    const plan = resolve(EP, STREET, TODAY);
    const delivered = plan.milestones.find((m) => m.key === "delivered")!;
    const pitch = plan.milestones.find((m) => m.key === "editorial_pitched")!;
    expect(delivered.date! <= pitch.date!).toBe(true);
    expect(delivered.date! < STREET).toBe(true);
  });

  test("a lead single gets its own delivery floor off its own street date", () => {
    const plan = resolve({ ...EP, leadSingle: "Fausse alerte", leadSingleOffset: -35 }, STREET, TODAY);
    expect(plan.milestones.find((m) => m.key === "single_out")?.date).toBe("2026-09-25");
    expect(plan.milestones.find((m) => m.key === "single_delivered")?.date).toBe("2026-08-28");
  });
});

describe("shape", () => {
  test("phases run in the order a record is made, not by earliest date", () => {
    // A lead single's upload is the earliest date but must not become phase 1.
    const plan = resolve({ ...EP, leadSingle: "x", leadSingleOffset: -35 }, STREET, TODAY);
    const order = plan.phases.map((p) => p.key);
    expect(order).toEqual(PHASE_ORDER.filter((k) => order.includes(k)));
    expect(order[0]).toBe("record");
  });

  test("covers the steps the published checklists contain", () => {
    // Each line traces to a source in knowledge/release-path.md (CD Baby,
    // Spotify, CMRRA, CIPO, SoundExchange, the press playbook).
    const plan = resolve(
      {
        ...EP,
        leadSingle: "x", leadSingleOffset: -35, markets: ["quebec", "canada", "usa"],
      },
      STREET, TODAY,
    );
    const keys = new Set(plan.milestones.map((m) => m.key));
    for (const step of [
      "recording_done",        // finish recording
      "masters_done",          // mix and master
      "artwork_done",          // cover art, credits, lyrics — CD Baby's upload list
      "splits_agreed",         // who owns what, before registration
      "identifiers_assigned",  // ISRC + UPC — CD Baby's upload list
      "copyright_registered",  // CIPO, voluntary, no deadline
      "registrations_filed",   // PRO + SoundExchange, two registrations
      "presskit_ready",        // press kit and press release
      "advance_link_ready",    // the link Exclaim! and CKRL will accept
      "content_shot",          // video, lyric video, Canvas
      "radio_serviced",
      "press_pitched",
      "editorial_pitched",     // Spotify, one song at a time
      "single_editorial_pitched", // the single's own pitch, before its own day
      "radio_followed_up",     // the relance, three weeks after servicing
      "radio_followed_up_release", // and the last one, release week
      "curators_followed_up",
      "dsp_profiles_claimed",  // Spotify / Apple for Artists, right after upload
      "metadata_declared",     // MétaMusique, Quebec only
      "campaign_live",
      "distributor_chosen",
      "delivered",             // audio, art, codes, credits, discovery data
      "lyrics_submitted",      // Musixmatch, before release or they trickle in
      "presave_live",
      "countdown_page",        // Spotify, albums and EPs only
      "curators_pitched",      // independent curators, release week
      "single_out",
      "release_day",
      "pandora_submitted",     // US only, after release
      "numbers_read",
    ]) {
      expect(keys).toContain(step);
    }
  });

  test("a cover needs a mechanical licence on physical and nothing on digital", () => {
    // CMRRA: the online services pay them directly, so digital needs no
    // application. Physical does, and it gates the pressing order.
    const digital = resolve({ ...EP, covers: true }, STREET, TODAY);
    expect(digital.milestones.some((m) => m.key === "mechanical_licence")).toBe(false);

    const pressed = resolve(
      { ...EP, covers: true, physical: "vinyl", branches: [...EP.branches, "manufacturing"] },
      STREET, TODAY,
    );
    const licence = pressed.milestones.find((m) => m.key === "mechanical_licence");
    const plant = pressed.milestones.find((m) => m.key === "plant_booked");
    expect(licence?.date).toBe(plant?.date);
  });

  test("the Countdown Page is not offered on a single", () => {
    const single = resolve(
      { ...EP, projectType: "single", branches: ["creation", "distribution", "campaign"] },
      STREET, TODAY,
    );
    expect(single.milestones.some((m) => m.key === "countdown_page")).toBe(false);
    expect(resolve(EP, STREET, TODAY).milestones.some((m) => m.key === "countdown_page")).toBe(true);
  });

  test("Pandora appears only when the US is a market", () => {
    expect(resolve(EP, STREET, TODAY).milestones.some((m) => m.key === "pandora_submitted")).toBe(false);
    expect(
      resolve({ ...EP, markets: ["canada", "usa"] }, STREET, TODAY)
        .milestones.some((m) => m.key === "pandora_submitted"),
    ).toBe(true);
  });

  test("a single with no physical still gets a plan, and it is shorter", () => {
    const single = resolve(
      { ...EP, projectType: "single", branches: ["creation", "rights", "distribution", "campaign", "post_release"] },
      STREET, TODAY,
    );
    expect(single.milestones.length).toBeGreaterThan(5);
    expect(single.milestones.length).toBeLessThan(resolve(EP, STREET, TODAY).milestones.length);
    expect(single.milestones.some((m) => m.key === "single_out")).toBe(false);
  });
});

describe("sources and windows", () => {
  test("every milestone cites at least one source, and every source resolves", () => {
    for (const m of MILESTONES) {
      expect(m.sources.length).toBeGreaterThan(0);
      for (const id of m.sources) expect(SOURCES[id]).toBeDefined();
    }
  });

  test("every source has a URL or a repo path, and a verified date", () => {
    for (const [id, src] of Object.entries(SOURCES)) {
      expect(src.url ?? src.where, id).toBeDefined();
      if (src.url) expect(src.url).toMatch(/^https:\/\//);
      expect(src.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("a window's far end is always later than its target, or absent", () => {
    // A single whose own date sits inside the window can collapse the range;
    // when it does the milestone degrades to one day rather than printing
    // a backwards window.
    for (const m of resolve({ ...EP, leadSingle: "x", leadSingleOffset: -14 }, STREET, TODAY).milestones) {
      if (m.latestOffsetDays != null) expect(m.latestOffsetDays).toBeGreaterThan(m.offsetDays!);
    }
  });

  test("the pitch window bends: aim at three to four weeks, floor at seven days", () => {
    const pitch = resolve(EP, STREET, TODAY).milestones.find((m) => m.key === "editorial_pitched")!;
    expect(pitch.date).toBe("2026-10-02");      // four weeks out, the target
    expect(pitch.latestDate).toBe("2026-10-23"); // seven days out, Spotify's floor
  });

  test("vinyl states both ends of 8–12 weeks, not just the one it planned at", () => {
    const vinyl = resolve({ ...EP, physical: "vinyl", branches: [...EP.branches, "manufacturing"] }, STREET, TODAY);
    const plant = vinyl.milestones.find((m) => m.key === "plant_booked")!;
    expect(plant.date).toBe("2026-08-07");       // 12 weeks — where the plan starts
    expect(plant.latestDate).toBe("2026-09-04"); // 8 weeks — the last honest moment
  });
});

describe("departments the label does not have", () => {
  test("a step with no staff owner names the department instead of shrugging", () => {
    const full = resolve(
      { ...EP, physical: "vinyl", branches: [...EP.branches, "manufacturing", "merch"] },
      STREET, TODAY,
    );
    expect(full.missingDepartments.sort()).toEqual(["artwork", "manufacturing", "merch"]);
    for (const d of full.missingDepartments) expect(PROPOSED[d]).toBeDefined();
  });

  test("making the record is a permanent gap, never a hiring suggestion", () => {
    // The charter puts making music out of scope, so no department is proposed.
    for (const key of ["recording_done", "masters_done"]) {
      expect(MILESTONES.find((m) => m.key === key)!.proposedOwner).toBeUndefined();
    }
  });

  test("a missing department is its own warning, separate from the permanent gaps", () => {
    const full = resolve(
      { ...EP, physical: "vinyl", branches: [...EP.branches, "manufacturing", "merch"] },
      STREET, TODAY,
    );
    expect(full.warnings.some((w) => w.kind === "missing_department")).toBe(true);
    const gaps = full.warnings.find((w) => w.kind === "no_owner");
    expect(gaps?.text.en).not.toContain("merch");
  });
});

describe("warnings", () => {
  test("says how late the plan already is instead of quietly compressing it", () => {
    const late = resolve(EP, "2026-09-15", TODAY);
    const w = late.warnings.find((x) => x.kind === "past_start");
    expect(w?.text.en).toContain("days ago");
  });

  test("catches a single that ships before the masters land", () => {
    const plan = resolve(
      { ...EP, leadSingle: "Fausse alerte", leadSingleOffset: -35, mastersReadyOffset: -40 },
      STREET, TODAY,
    );
    expect(plan.warnings.some((w) => w.kind === "single_inside_recording")).toBe(true);
  });

  test("no lead single is itself a warning — one pitch, none once live", () => {
    expect(resolve(EP, STREET, TODAY).warnings.some((w) => w.kind === "no_lead_single")).toBe(true);
  });

  test("every warning is one or two sentences", () => {
    const plan = resolve(EP, STREET, TODAY);
    for (const w of plan.warnings) {
      expect(w.text.en.split(". ").length).toBeLessThanOrEqual(3);
      expect(w.text.en.length).toBeLessThan(220);
    }
  });
});

describe("the question set", () => {
  test("the count only ever shrinks during an interview", () => {
    let total = plannedTotal({});
    const answers: Record<string, unknown> = {};
    for (const q of QUESTIONS) {
      answers[q.id] = q.options?.[0] ?? "x";
      const now = plannedTotal(answers);
      expect(now).toBeLessThanOrEqual(total);
      total = now;
    }
  });

  test("a finished record is never asked when its master lands", () => {
    expect(askable({ recording_status: "mastered" }).some((q) => q.id === "masters_ready")).toBe(false);
    expect(askable({ recording_status: "tracking" }).some((q) => q.id === "masters_ready")).toBe(true);
  });

  test("every question carries a topic for the progress line, in both languages", () => {
    for (const q of QUESTIONS) {
      expect(q.topic.en.length).toBeGreaterThan(2);
      expect(q.topic.fr.length).toBeGreaterThan(2);
    }
  });

  test("a bad answer is refused before anything is written, with the valid ones", () => {
    // Choice answers are CHECK-constrained in the schema. Catch a bad value
    // here rather than at save time, after the interview.
    const physical = QUESTIONS.find((q) => q.id === "physical")!;
    expect(validate(physical, "vinyle")).toContain("none, vinyl, cd, both");
    expect(validate(physical, "vinyl")).toBeNull();

    const markets = QUESTIONS.find((q) => q.id === "markets")!;
    expect(validate(markets, ["quebec", "ontario"])).toContain("ontario");
    expect(validate(markets, ["quebec", "canada"])).toBeNull();

    const street = QUESTIONS.find((q) => q.id === "street_date")!;
    expect(validate(street, "next spring")).toContain("2027-04-16");
    expect(validate(street, "2027-04-16")).toBeNull();
  });

  test("\"I don't know\" is always a valid answer", () => {
    for (const q of QUESTIONS) expect(validate(q, "unknown")).toBeNull();
  });

  test("branch selection is deterministic and order-independent", () => {
    const a = branchesFor({ project_type: "ep", physical: "vinyl", merch: "yes" });
    const b = branchesFor({ merch: "yes", physical: "vinyl", project_type: "ep" });
    expect([...a].sort()).toEqual([...b].sort());
  });
});
