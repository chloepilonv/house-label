/**
 * The workspace's pure naming rules. A drifting name creates duplicate
 * folders. The `ensure*` Google round trips are tested by hand.
 */
import { describe, expect, test } from "bun:test";
import {
  ARTIST_SUBFOLDERS,
  CONTENTS,
  RELEASE_SUBFOLDERS,
  BUDGET_SUBFOLDERS,
  releaseFolderName,
  rootName,
  taskFolderName,
} from "./workspace";
import { WORKSPACE_FOLDERS } from "../frontmatter";

describe("the root folder is named from the profile", () => {
  test("the artist's name, then the label", () => {
    expect(rootName("Odile Ray")).toBe("Odile Ray — House Label");
  });

  test("an unfilled profile still gets a folder", () => {
    // The workspace can be created before the artist name is known.
    expect(rootName(null)).toBe("House Label");
    expect(rootName("   ")).toBe("House Label");
  });
});

describe("release folders sort themselves", () => {
  test("month first, so the list is chronological", () => {
    expect(releaseFolderName({ title: "Nightdrive", project_type: "ep", street_date: "2026-05-14" })).toBe(
      "2026-05_Nightdrive (EP)",
    );
  });

  test("a project with no date yet is TBD, not bare", () => {
    expect(releaseFolderName({ title: "Untitled", project_type: "album", street_date: null })).toBe(
      "TBD_Untitled (Album)",
    );
  });

  test("a slash in the title does not read as a path", () => {
    expect(releaseFolderName({ title: "Him/Her", project_type: "single", street_date: "2026-01-02" })).toBe(
      "2026-01_Him-Her (Single)",
    );
  });

  test("the same project always names the same folder", () => {
    // ensurePath is find-or-create by name, so two spellings are two folders.
    const p = { title: "Nightdrive", project_type: "ep", street_date: "2026-05-14" };
    expect(releaseFolderName(p)).toBe(releaseFolderName({ ...p, street_date: new Date("2026-05-14") }));
  });
});

describe("content folders are the shooting schedule", () => {
  test("due date first, format in parentheses", () => {
    expect(taskFolderName({ title: "Studio teaser", due_date: "2026-04-02", format: "reel" })).toBe(
      "2026-04-02_Studio-teaser (reel)",
    );
  });

  test("no format is not the string 'null'", () => {
    expect(taskFolderName({ title: "Cover reveal", due_date: "2026-04-16", format: null })).toBe(
      "2026-04-16_Cover-reveal",
    );
  });

  test("they sort into due-date order on their own", () => {
    const names = [
      taskFolderName({ title: "Cover reveal", due_date: "2026-04-16", format: "carousel" }),
      taskFolderName({ title: "Studio teaser", due_date: "2026-04-02", format: "reel" }),
      taskFolderName({ title: "Lyric video", due_date: "2026-04-09", format: "short" }),
    ];
    expect([...names].sort()).toEqual([
      "2026-04-02_Studio-teaser (reel)",
      "2026-04-09_Lyric-video (short)",
      "2026-04-16_Cover-reveal (carousel)",
    ]);
  });
});

describe("every token a department can be granted has a folder", () => {
  test("the map covers WORKSPACE_FOLDERS exactly", () => {
    // Every granted token must have a folder that something creates.
    const mapped = [
      ...Object.keys(ARTIST_SUBFOLDERS),
      "releases",
      ...Object.keys(RELEASE_SUBFOLDERS),
      ...Object.keys(BUDGET_SUBFOLDERS),
    ];
    expect([...mapped].sort()).toEqual([...WORKSPACE_FOLDERS].sort());
  });
});

describe("folder names are Title-Case, hyphen for multiword", () => {
  const every = [
    ...Object.values(ARTIST_SUBFOLDERS).flat(),
    ...Object.values(RELEASE_SUBFOLDERS).flat(),
    ...Object.values(BUDGET_SUBFOLDERS).flat(),
    "Releases",
  ];

  test("no lowercase first letter, no spaces", () => {
    // Title-Case throughout. Casing is the folder's identity under find-by-name.
    for (const name of every) expect(name).toMatch(/^[A-Z][A-Za-z]*(-[A-Z][A-Za-z]*)*$/);
  });

  test("the campaign folder's parent is Digital-Contents", () => {
    expect(CONTENTS).toBe("Digital-Contents");
  });

  test("Audio and Video are flat", () => {
    // Audio/ and Video/ stay flat, by the artist's choice.
    const under = (prefix: string) =>
      Object.values(RELEASE_SUBFOLDERS).filter((p) => p[0] === prefix && p.length > 2);
    expect(under("Songs")).toEqual([]);
    expect(Object.values(RELEASE_SUBFOLDERS).every((p) => p.length <= 2)).toBe(true);
  });
});
