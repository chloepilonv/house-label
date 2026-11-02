import { describe, expect, test } from "bun:test";
import { addDays, cheer, compose, cronLine, day, mondayOf, numberLines, plist, splitWeek, type RecapInput } from "./recap";
import { applyStatuses, sheetRows } from "./plan-sheet";
import type { Item } from "./items";

// 2026-10-26 is a Monday.
const MONDAY = day("2026-10-26");
const it = (o: Partial<Item> & { title: string; due: string }): Item => ({
  owner: "you", done: false, key: `${o.owner ?? "you"}|${o.title}`, ...o, due: day(o.due), last: o.last ? day(o.last as unknown as string) : undefined,
});

const base: RecapInput = {
  artistName: "Mireille Caron",
  lang: "en",
  project: { id: "p1", title: "Nuit blanche", projectType: "ep", streetDate: day("2026-11-13"), leadSingleDate: day("2026-10-30"), driveFolderId: "f1" },
  undated: 1,
  items: [
    it({ title: "Press release finished", due: "2026-10-22", owner: "press", done: true, updatedAt: "2026-10-22", milestone: true }),
    it({ title: "Pitch CISM", due: "2026-10-28", owner: "promotion", link: "https://cism893.ca/", note: "ask for the music director" }),
    it({ title: "Upload to distributor", due: "2026-10-30", owner: "distribution", milestone: true }),
    it({ title: "Lyrics on Musixmatch Pro", due: "2026-10-31", owner: "promotion", priority: true }),
    it({ title: "Book the launch room", due: "2026-10-15", owner: "you" }),
    it({ title: "Radio serviced", due: "2026-10-16", last: "2026-10-30" as never, owner: "promotion", milestone: true }),
    it({ title: "Teaser reel", due: "2026-11-04", owner: "digital-marketing" }),
    it({ title: "Old thing", due: "2026-09-01", owner: "press", done: true, updatedAt: "2026-09-02" }),
  ],
  readings: [
    { platform: "spotify", metric: "monthly_listeners", date: "2026-10-25", value: 1240 },
    { platform: "spotify", metric: "monthly_listeners", date: "2026-10-12", value: 1155 },
    { platform: "instagram", metric: "followers", date: "2026-10-25", value: 2310 },
  ],
};

describe("dates", () => {
  test("mondayOf — a Sunday belongs to the week before", () => {
    expect(mondayOf(MONDAY)).toEqual(MONDAY);
    expect(mondayOf(day("2026-10-29"))).toEqual(MONDAY);
    expect(mondayOf(day("2026-11-01"))).toEqual(MONDAY);
    expect(mondayOf(day("2026-11-02"))).toEqual(day("2026-11-02"));
  });
  test("addDays crosses a month", () => {
    expect(addDays(day("2026-10-30"), 3)).toEqual(day("2026-11-02"));
  });
});

describe("splitWeek", () => {
  const w = splitWeek(base.items, MONDAY);
  test("this week is Monday to Sunday, in date order, priorities first on a tie", () => {
    expect(w.week.map((i) => i.title)).toEqual(["Radio serviced", "Pitch CISM", "Upload to distributor", "Lyrics on Musixmatch Pro"]);
  });
  test("a window still open is this week's work, not late", () => {
    expect(w.late.map((i) => i.title)).toEqual(["Book the launch room"]);
    expect(w.week[0]!.title).toBe("Radio serviced"); // due Oct 16, last day Oct 30
  });
  test("done last week is the 7 days before Monday, by updated_at", () => {
    expect(w.done.map((i) => i.title)).toEqual(["Press release finished"]);
  });
});

describe("compose", () => {
  const r = compose(base, MONDAY);

  test("text: done, week, late, numbers, countdown, link", () => {
    expect(r.subject).toBe("Your week at the label — Oct 26");
    expect(r.text).toContain("Last week you got 1 thing done.");
    expect(r.text).toContain("✓ Press release finished  (Press Agent)");
    expect(r.text).toContain("Fri 16 → Oct 30  Radio serviced  (Promotion)");
    expect(r.text).toMatch(/Wed 28 +Pitch CISM  \(Promotion\)\n +https:\/\/cism893\.ca\//);
    expect(r.text).toContain("Lyrics on Musixmatch Pro  (Promotion) ★");
    expect(r.text).toContain("1 thing is late:");
    expect(r.text).toContain("1 step(s) in the plan still have no date");
    expect(r.text).toContain("Spotify 1,240 monthly listeners (+85 since Oct 12)");
    expect(r.text).toContain("Instagram 2,310 followers\n");
    expect(r.text).toContain("The single comes out Oct 30 — 4 days.");
    expect(r.text).toContain("The EP comes out Nov 13 — 18 days to go.");
    expect(r.text).not.toContain("Old thing");
  });

  test("html: header, chips, buttons, day-by-day, link on the task", () => {
    const h = compose({ ...base, links: { sheet: "https://docs.google.com/x", folder: "https://drive.google.com/drive/folders/f1" } }, MONDAY).html;
    expect(h).toContain("MIREILLE CARON");
    expect(h).toContain("EP in <b>18</b> days");
    expect(h).toContain("<b>4</b> tasks this week");
    expect(h).toContain('href="https://docs.google.com/x"');
    expect(h).toContain('<a href="https://cism893.ca/"');
    expect(h).toContain("Wed 28");
    expect(h).toContain("Late</h2>");
  });

  test("French follows preferred_locale", () => {
    const fr = compose({ ...base, lang: "fr" }, MONDAY);
    expect(fr.subject).toBe("Ta semaine au label — 26 oct.");
    expect(fr.text).toContain("Salut Mireille Caron,");
    expect(fr.text).toContain("(Relations de presse)");
    expect(fr.text).toContain("auditeurs mensuels");
    expect(fr.text).toContain("Le EP sort le 13 nov. — encore 18 jours.");
  });

  test("no project: one sentence, no sections", () => {
    const none = compose({ ...base, project: null, items: [], undated: 0 }, MONDAY);
    expect(none.text).toContain("No release is planned yet.");
    expect(none.text).not.toContain("This week");
    expect(none.html).not.toContain("day by day");
  });

  test("the same recap run on Wednesday reads the same week", () => {
    expect(compose(base, day("2026-10-28")).subject).toBe(compose(base, MONDAY).subject);
  });
});

describe("cheer", () => {
  test("release week beats everything", () => {
    expect(cheer({ done: 0, due: 0, late: 9, daysToStreet: 3 }, "en")).toContain("This is the week");
  });
  test("a clean week is named as one", () => {
    expect(cheer({ done: 2, due: 3, late: 0, daysToStreet: 40 }, "en")).toContain("Nothing late");
  });
  test("an empty week with late items gets one task, not a lecture", () => {
    expect(cheer({ done: 0, due: 0, late: 2, daysToStreet: null }, "fr")).toContain("une seule chose");
  });
});

describe("numberLines", () => {
  test("a metric change between readings shows no delta", () => {
    expect(numberLines([
      { platform: "youtube", metric: "subscribers", date: "2026-10-25", value: 500 },
      { platform: "youtube", metric: "total_views", date: "2026-10-12", value: 9000 },
    ], "en")).toEqual(["Youtube 500 subscribers"]);
  });
});

describe("plan sheet", () => {
  test("rows: date, action, agent, status, source, key — date order", () => {
    const rows = sheetRows(base.items.slice(1, 4));
    expect(rows[0]).toEqual(["2026-10-28", "Pitch CISM", "promotion", "To do", "https://cism893.ca/", "promotion|Pitch CISM"]);
    expect(sheetRows([it({ title: "x", due: "2026-10-28" })])[0]![2]).toBe("label-manager");
  });
  test("the sheet's status wins both ways, and a legacy checkbox reads as Done", () => {
    const items = [it({ title: "a", due: "2026-10-28", done: true }), it({ title: "b", due: "2026-10-28" }), it({ title: "c", due: "2026-10-28" })];
    applyStatuses(items, [["Date", "Action", "Agent", "Status", "Source", "Key — don't edit"], ["", "", "", "To do", "", "you|a"], ["", "", "", "Won't do", "", "you|b"], ["", "", "", "TRUE", "", "you|c"]], "Key — don't edit");
    expect(items.map((i) => [i.status, i.done])).toEqual([["To do", false], ["Won't do", false], ["Done", true]]);
  });
  test("a sheet with the earlier columns (Status first) still reads", () => {
    const items = [it({ title: "a", due: "2026-10-28" })];
    applyStatuses(items, [["Status", "Date", "Key — don't edit"], ["Done", "", "you|a"]], "Key — don't edit");
    expect(items[0]!.done).toBe(true);
  });
});

describe("schedule", () => {
  test("plist runs the cli from the repo every Monday at 08:00", () => {
    const p = plist("/usr/local/bin/bun", "/Users/x/music & label", "/Users/x/.houselabel/recap.log", "/usr/bin");
    expect(p).toContain("<string>/Users/x/music &amp; label</string>");
    expect(p).toContain("<key>Weekday</key><integer>1</integer><key>Hour</key><integer>8</integer>");
    expect(p).toContain("<string>recap</string><string>--send</string>");
  });
  test("cron line", () => {
    expect(cronLine("bun", "/r", "/l")).toBe("0 8 * * 1 cd /r && bun run engine/cli.ts recap --send >> /l 2>&1");
  });
});
