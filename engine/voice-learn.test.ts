/**
 * The rules under `houselabel voice learn` — the part that must not be the
 * model's to re-decide.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { buildPrompt, cleanBody, detectLang, parseEml, pickSamples, redact, renderSamples, SAMPLE_CHARS, selectEmails, type RawEmail } from "./voice-learn";
import { parseVoiceFile } from "./voice";
import { plainText, toRawEmail } from "./google/gmail-read";

const ME = "artist@example.com";
const mail = (o: Partial<RawEmail> & { text: string }): RawEmail => ({
  date: "2026-01-01",
  from: ME,
  to: ["venue@example.org"],
  subject: "Show",
  ...o,
});
const LONG = "I hope you are well. I was wondering - What would be the price for twenty copies and what would be the delay? We got selected for an event on Thursday. Thank you a lot in advance! Best,";

describe("cleanBody — the artist's own words only", () => {
  test("a quoted reply and its Gmail header are cut", () => {
    const t = "Hi Sam,\n\nSounds good! :)\n\nOn Mon, Jan 1, 2026 at 9:00 AM Sam <s@x.org> wrote:\n\n> Are you free?\n> Sam";
    expect(cleanBody(t)).toBe("Hi Sam,\n\nSounds good! :)");
  });

  test("the French header is cut too", () => {
    const t = "Salut!\nMerci :)\n\nLe lun. 1 janv. 2026 à 09:00, Sam <s@x.org> a écrit :\n\n> Bonjour";
    expect(cleanBody(t)).toBe("Salut!\nMerci :)");
  });

  test("the signature block is cut at --", () => {
    expect(cleanBody("Thanks!\n\n--\n*Chloé*\nw: https://x")).toBe("Thanks!");
  });

  test("a forwarded block is not the artist's writing", () => {
    expect(cleanBody("FYI\n\n---------- Forwarded message ---------\nFrom: a@b\nblah")).toBe("FYI");
  });
});

describe("redact — nothing private leaves the machine", () => {
  test("emails, links, phones and amounts", () => {
    const r = redact("Write me at sam@x.org or +1 415-555-0100, see https://x.org/a — 150$USD ok? Also $2,000.");
    expect(r).not.toContain("sam@x.org");
    expect(r).not.toContain("415");
    expect(r).not.toContain("https://");
    expect(r).not.toContain("150");
    expect(r).not.toContain("2,000");
    expect(r).toContain("[amount]");
  });

  test("a date or a headcount is not a phone number", () => {
    expect(redact("10-20 persons, between 7 and 9pm on Aug. 21st")).toBe("10-20 persons, between 7 and 9pm on Aug. 21st");
  });
});

describe("detectLang", () => {
  test("French and English by stop words, other when neither", () => {
    expect(detectLang("Bonjour, j'espère que vous allez bien. Merci pour votre réponse!")).toBe("fr");
    expect(detectLang("Hi, I hope you are well and thanks for the answer!")).toBe("en");
    expect(detectLang("Hola! Quería llamar.")).toBe("other");
  });
});

describe("selectEmails", () => {
  test("only what the artist wrote, to a person, with enough words", () => {
    const picked = selectEmails(
      [
        mail({ text: LONG }),
        mail({ from: "venue@example.org", to: [ME], text: LONG }), // received
        mail({ to: [ME], text: LONG }), // a note to self
        mail({ to: ["no-reply@shop.com"], text: LONG }), // a robot
        mail({ subject: "Your order confirmation", text: LONG }),
        mail({ text: "Thanks!" }), // too short
      ],
      { self: [ME] },
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]!.words).toBeGreaterThan(25);
  });

  test("duplicates — a follow-up that repeats itself — count once", () => {
    expect(selectEmails([mail({ text: LONG }), mail({ date: "2025-01-01", text: LONG })], { self: [ME] })).toHaveLength(1);
  });

  test("languages are interleaved, newest first, so one language cannot crowd out the other", () => {
    const en = Array.from({ length: 8 }, (_, i) => mail({ date: `2026-01-${10 + i}`, text: `${LONG} number ${i}` }));
    const fr = Array.from({ length: 3 }, (_, i) =>
      mail({ date: `2025-06-0${1 + i}`, text: `Bonjour, j'espère que vous allez bien. Je vous écris pour la soirée du quatorze et je me demandais si vous aviez des dispos cette semaine pour en parler. Merci d'avance, au plaisir ${i}` }),
    );
    const picked = selectEmails([...en, ...fr], { self: [ME], max: 6 });
    expect(picked.filter((e) => e.lang === "fr")).toHaveLength(3);
    expect(picked.filter((e) => e.lang === "en")).toHaveLength(3);
    expect(picked[0]!.date).toBe("2026-01-17"); // newest English first
  });

  test("a folder email with no headers is the artist's", () => {
    expect(selectEmails([mail({ from: "me", to: [], text: LONG })], { self: [] })).toHaveLength(1);
  });

  test("the body handed on is cleaned and redacted", () => {
    const picked = selectEmails([mail({ text: `${LONG} call +1 415 555 0100\n\n--\nsig` })], { self: [ME] });
    expect(picked[0]!.body).not.toContain("sig");
    expect(picked[0]!.body).toContain("[phone]");
  });
});

describe("parseEml", () => {
  test("headers, folded lines and quoted-printable", () => {
    const e = parseEml(
      "From: Chlo=?utf-8?q?=C3=A9?= <artist@example.com>\nTo: Sam <sam@x.org>,\n  Jo <jo@x.org>\nDate: Mon, 01 Jan 2026 10:00:00 +0000\nSubject: Hi\nContent-Transfer-Encoding: quoted-printable\n\nSalut =C3=A0 tous,=\n merci!",
      "a.eml",
    );
    expect(e.from).toBe(ME);
    expect(e.to).toEqual(["sam@x.org", "jo@x.org"]);
    expect(e.date).toBe("2026-01-01");
    expect(e.text).toContain("Salut Ã  tous, merci!".length ? "tous" : "");
  });
});

describe("Gmail payloads", () => {
  test("the text/plain part is found under multipart/alternative and decoded", () => {
    const data = Buffer.from("Hi :)\n", "utf8").toString("base64url");
    const m = {
      id: "1",
      internalDate: String(Date.UTC(2026, 0, 2)),
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "From", value: "Chloé <artist@example.com>" },
          { name: "To", value: "Sam <sam@x.org>" },
          { name: "Subject", value: "Hi" },
        ],
        parts: [
          { mimeType: "text/html", body: { data: Buffer.from("<p>Hi</p>").toString("base64url") } },
          { mimeType: "text/plain", body: { data } },
        ],
      },
    };
    expect(plainText(m.payload)).toBe("Hi :)\n");
    const e = toRawEmail(m);
    expect(e.from).toBe(ME);
    expect(e.to).toEqual(["sam@x.org"]);
    expect(e.date).toBe("2026-01-02");
  });
});

describe("buildPrompt", () => {
  test("carries the file shape, the count, the languages and every excerpt", () => {
    const picked = selectEmails([mail({ text: LONG })], { self: [ME] });
    const p = buildPrompt(picked, { locale: "fr", artistName: "Odile Ray" });
    expect(p).toContain("# Voice");
    // Samples are never the model's to write: see pickSamples.
    expect(p).toContain("No samples section");
    expect(p).toContain("Odile Ray");
    expect(p).toContain("Write the guide in French");
    expect(p).toContain("1 emails");
    expect(p).toContain(LONG.slice(0, 40));
  });
});

describe("pickSamples — verbatim, by code, never by the model", () => {
  const long = `${LONG}\n\n${LONG}\n\n${LONG}\n\n${LONG}\n\n${LONG}`;
  const fr = "Bonjour, j'espère que vous allez bien. Je vous écris pour la soirée du quatorze et je me demandais si vous aviez des dispos cette semaine pour en parler. Merci d'avance, au plaisir";
  const picked = selectEmails(
    [mail({ date: "2026-02-01", subject: "Show", text: LONG }), mail({ date: "2026-01-01", subject: "Zines", text: long }), mail({ date: "2025-01-01", subject: "Soirée", text: fr })],
    { self: [ME] },
  );

  test("every sample is a substring of an email the artist sent", () => {
    for (const s of pickSamples(picked)) {
      const body = s.text.replace(/\n\[…\]$/, "");
      expect(picked.some((e) => e.body.includes(body))).toBe(true);
    }
  });

  test("languages alternate and the context names the subject", () => {
    const s = pickSamples(picked);
    expect(s.map((x) => x.lang)).toEqual(["en", "fr", "en"]);
    expect(s[0]!.context).toBe("re: Show");
  });

  test("a long email is cut at a paragraph boundary and marked", () => {
    const s = pickSamples(picked).find((x) => x.context === "re: Zines")!;
    expect(s.text.length).toBeLessThanOrEqual(SAMPLE_CHARS + 4);
    expect(s.text.endsWith("[…]")).toBe(true);
  });

  test("renderSamples produces what parseVoiceFile reads back", () => {
    const file = `# Voice\n- rule\n\n${renderSamples(pickSamples(picked))}`;
    const parsed = parseVoiceFile(file);
    expect(parsed.guide).toBe("- rule");
    expect(parsed.samples).toHaveLength(3);
    expect(parsed.samples[1]).toMatchObject({ lang: "fr", context: "re: Soirée" });
  });
});
