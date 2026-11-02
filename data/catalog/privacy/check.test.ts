import { describe, expect, test } from "bun:test";
import { isPerson, REPLACEMENT, scrubPeople } from "./check";

describe("catalog privacy", () => {
  test("a desk is not a person", () => {
    for (const e of ["music@cism893.ca", "redaction@ledevoir.com", "submissions@exclaim.ca", "thecoast@thecoast.ca", "musictips@westword.com", "reviews@glidemagazine.com", "vancouver@dailyhive.com", "prenom.nom@lapresse.ca", "engage@poetryjazzcafe.com", "theatrestecatherine@gmail.com", "islander@example-metal.com", "chmrmusicdirector@gmail.com", "wxpndesk@xpn.org", "cjsfpsa@sfu.ca", "commentaires@cflx.qc.ca", "dg@cibl1015.com"])
      expect(isPerson(e)).toBe(false);
  });
  test("a named mailbox is a person", () => {
    for (const e of ["megan@example-mag.ca", "lea.marchand@example-weekly.com", "janet@example-blog.ca", "tleroux@example-weekly.com", "Gordy@example-roots.ca", "rob@example-beats.com", "andreal@example-island.com", "kforrest@example-mag.com", "milliekxyz@gmail.com", "marc.bedard@example-fm.ca"])
      expect(isPerson(e)).toBe(true);
  });
  test("the outlet's own name and a call sign are desks", () => {
    expect(isPerson("americanahighways@gmail.com", "Americana Highways")).toBe(false);
    for (const e of ["chmrpd@mun.ca", "cjsfmusc@sfu.ca", "ckuw@uwinnipeg.ca", "kcr@sdsu.edu"]) expect(isPerson(e)).toBe(false);
    expect(isPerson("nathalied@example-fm.ca", "CXYZ 89,1")).toBe(true);
  });
  test("scrubPeople keeps the desk and replaces the person in the same sentence", () => {
    expect(scrubPeople("Write to music@example-mag.ca or megan@example-mag.ca for reviews.")).toBe(`Write to music@example-mag.ca or ${REPLACEMENT} for reviews.`);
  });
});

test("the shipped catalog.sqlite holds desks only — no person's address", () => {
  const { findPeople } = require("./check");
  expect(findPeople()).toEqual([]);
});
