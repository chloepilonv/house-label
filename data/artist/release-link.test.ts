import { describe, expect, test } from "bun:test";
import { releaseRowFor } from "./release-link";

describe("a project's release row", () => {
  test("an EP, album or single becomes a release with the street date", () => {
    expect(releaseRowFor({ title: "Nightdrive", project_type: "ep", street_date: new Date("2026-11-13T00:00:00Z") }))
      .toEqual({ title: "Nightdrive", release_type: "ep", release_date: "2026-11-13" });
    expect(releaseRowFor({ title: "X", project_type: "single", street_date: "2026-10-16" })!.release_type).toBe("single");
  });
  test("a tour is not a record and gets no release row", () => {
    expect(releaseRowFor({ title: "Fall run", project_type: "tour", street_date: null })).toBeNull();
  });
  test("a project without a date still gets a release, undated", () => {
    expect(releaseRowFor({ title: "TBD", project_type: "album", street_date: null })!.release_date).toBeNull();
  });
});
