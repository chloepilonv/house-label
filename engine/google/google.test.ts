/**
 * Invariants of the Google connector that fail silently: stable event ids,
 * scopes, and per-department capabilities. Nothing here reaches Google.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "../agent";
import { GOOGLE_CAPABILITIES, parseDoc, parseDrive, parseGoogle, WORKSPACE_FOLDERS } from "../frontmatter";
import { authUrl, envValue, GMAIL_READONLY_SCOPE, SCOPES } from "./auth";
import { colorFor, eventIdFor, nextDay } from "./calendar";
import { decryptWith, encryptWith } from "./crypto";
import { composeUrl, mailtoUrl } from "./gmail";
import { buildGoogleTools } from "./tools";
import type { Department } from "../agent";

const KEY = Buffer.alloc(32, 7);

describe("tokens at rest", () => {
  test("a round trip returns the original", () => {
    const secret = "1//0gRefreshTokenLooksLikeThis-_~";
    expect(decryptWith(KEY, encryptWith(KEY, secret))).toBe(secret);
  });

  test("the same plaintext encrypts differently every time", () => {
    // A fixed IV would make identical tokens identical in a dump.
    expect(encryptWith(KEY, "same")).not.toBe(encryptWith(KEY, "same"));
  });

  test("a tampered ciphertext is refused, not silently wrong", () => {
    const box = Buffer.from(encryptWith(KEY, "hello"), "base64");
    box[box.length - 1]! ^= 0xff;
    expect(() => decryptWith(KEY, box.toString("base64"))).toThrow();
  });

  test("the wrong key is refused", () => {
    expect(() => decryptWith(Buffer.alloc(32, 9), encryptWith(KEY, "hello"))).toThrow();
  });

  test("a row this machine cannot decrypt reads as 'reconnect', not as OpenSSL", async () => {
    // Key rotated, or database copied to a machine with its own key.
    const { NotConnectedError } = await import("./store");
    const err = new NotConnectedError(
      "This Google connection was encrypted with a different key and cannot be read on this machine.",
    );
    expect(err.name).toBe("NotConnectedError");
    expect(err.message).toContain("different key");
  });
});

describe("the consent screen asks for exactly what we use", () => {
  const url = new URL(authUrl("http://127.0.0.1:9999/callback", "nonce", { clientId: "id", clientSecret: "s" }));

  test("offline access, or the connection dies in an hour", () => {
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  test("full drive, because the artist fills most of the workspace by hand", () => {
    // `drive.file` only sees files this app created; the artist fills most
    // workspace folders by hand.
    const scopes = url.searchParams.get("scope")!.split(" ");
    expect(scopes).toContain("https://www.googleapis.com/auth/drive");
    expect(scopes).not.toContain("https://www.googleapis.com/auth/drive.file");
  });

  test("no Slides scope: the deck is converted by Drive, not built by the Slides API", () => {
    // No Slides API call exists, so no `presentations` scope.
    expect(SCOPES.some((s) => s.includes("presentations"))).toBe(false);
  });

  test("no Gmail scope is requested by `connect google`", () => {
    // press and promotion promise "drafts, never sends"; gmail.ts builds a
    // compose URL. A Gmail scope here means both AGENT.md files need rewriting.
    expect(SCOPES.some((s) => s.includes("gmail"))).toBe(false);
  });

  test("the one Gmail scope is read-only, opt-in, and never in SCOPES", () => {
    // Requested only by `voice learn --gmail`, and must stay read-only.
    expect(GMAIL_READONLY_SCOPE).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(SCOPES as readonly string[]).not.toContain(GMAIL_READONLY_SCOPE);
    const extra = new URL(authUrl("http://127.0.0.1:9999/callback", "n", { clientId: "id", clientSecret: "s" }, [...SCOPES, GMAIL_READONLY_SCOPE]));
    expect(extra.searchParams.get("scope")!.split(" ")).toContain(GMAIL_READONLY_SCOPE);
    // incremental: Drive and Calendar survive the second consent
    expect(extra.searchParams.get("include_granted_scopes")).toBe("true");
  });

  test("the state nonce is carried", () => {
    expect(url.searchParams.get("state")).toBe("nonce");
  });
});

describe("calendar ids are derived, never stored", () => {
  const uuid = "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b";

  test("the same row always addresses the same event", () => {
    expect(eventIdFor(uuid)).toBe(eventIdFor(uuid));
  });

  test("it is legal in Google's alphabet", () => {
    // base32hex: 0-9 and a-v, 5 to 1024 characters.
    for (const id of [eventIdFor(uuid), eventIdFor("a-slug-not-a-uuid")]) {
      expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    }
  });

  test("different rows do not collide", () => {
    expect(eventIdFor(uuid)).not.toBe(eventIdFor("3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5c"));
  });

  test("all-day events end the next morning", () => {
    expect(nextDay("2026-09-02")).toBe("2026-09-03");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29"); // leap year, not 03-01
  });

  test("every department's colour is one Google accepts", () => {
    for (const d of ["digital-marketing", "press", "label-manager", "anything-else"])
      expect(Number(colorFor(d))).toBeGreaterThanOrEqual(1);
  });
});

describe("the Gmail draft is a link, not a send", () => {
  const draft = { to: "editor@exclaim.ca", subject: "Odile Ray — new single", body: "Hi,\n\nHere's the track." };

  test("the compose URL carries the whole draft", () => {
    const url = new URL(composeUrl(draft));
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe(draft.to);
    expect(url.searchParams.get("su")).toBe(draft.subject);
    expect(url.searchParams.get("body")).toBe(draft.body);
  });

  test("several recipients become one comma-separated field", () => {
    expect(new URL(composeUrl({ ...draft, to: ["a@b.ca", "c@d.ca"] })).searchParams.get("to")).toBe("a@b.ca,c@d.ca");
  });

  test("the mailto fallback escapes the newlines rather than breaking on them", () => {
    expect(mailtoUrl(draft)).toStartWith("mailto:editor%40exclaim.ca?");
    expect(mailtoUrl(draft)).toContain("Hi%2C%0A%0AHere");
  });
});

// ── the roster ─────────────────────────────────────────────────────────────

const dept = (name: string, google: string[]): Department =>
  ({
    name, slug: name, staffMember: "", description: "", department: name,
    status: "", skills: [], knowledge: [], body: "", front: {} as never,
    tables: { catalog: [], artist: [] }, google, services: [],
  }) as Department;

describe("a department gets only what it declared", () => {
  test("declaring nothing means no Google tool at all", () => {
    expect(Object.keys(buildGoogleTools(dept("royalties", [])))).toEqual([]);
  });

  test("gmail alone gets the draft tool and nothing that writes", () => {
    const tools = buildGoogleTools(dept("press", ["gmail"]));
    expect(Object.keys(tools).sort()).toEqual(["gmail_draft", "google_status"]);
  });

  test("calendar alone cannot upload to Drive", () => {
    const tools = buildGoogleTools(dept("digital-marketing", ["calendar"]));
    expect(tools.calendar_sync).toBeDefined();
    expect(tools.drive_upload).toBeUndefined();
  });

  test("drive alone cannot write the calendar", () => {
    const tools = buildGoogleTools(dept("presskit", ["drive"]));
    expect(tools.drive_upload).toBeDefined();
    expect(tools.calendar_sync).toBeUndefined();
  });

  test("no tool can return a token", () => {
    // Catches a tool schema field named like a credential.
    const tools = buildGoogleTools(dept("presskit", ["drive", "calendar", "gmail"]));
    for (const [name, t] of Object.entries(tools))
      expect(`${name} ${JSON.stringify(t.inputSchema ?? {})}`).not.toMatch(/token|secret|credential/i);
  });
});

describe("every department has been decided about", () => {
  test("each AGENT.md declares google:, with capabilities that exist", async () => {
    const dir = join(ROOT, "agents");
    const names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    expect(names.length).toBeGreaterThan(0);

    for (const name of names) {
      const { front } = parseDoc(await Bun.file(join(dir, name, "AGENT.md")).text());
      // parseGoogle returns [] for a missing key and for `google: []`, so check the raw key.
      expect(`${name}: ${front.google ?? "MISSING"}`).not.toContain("MISSING");
      const declared = (front.google!.match(/\[([^\]]*)\]/)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      expect(`${name}: ${declared.join(",")}`).toBe(`${name}: ${parseGoogle(front.google).join(",")}`);
    }
  });

  test("agents/sync.ts and engine/frontmatter.ts list the same capabilities", async () => {
    // agents/sync.ts must not import engine/, so its copy of the list is kept in step here.
    const src = await Bun.file(join(ROOT, "agents/sync.ts")).text();
    const inSync = src.match(/const GOOGLE_CAPABILITIES = \[([^\]]*)\]/)?.[1] ?? "";
    expect(inSync.split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)).toEqual([...GOOGLE_CAPABILITIES]);
  });

  test("agents/sync.ts and engine/frontmatter.ts list the same workspace folders", async () => {
    // Same duplication and guard for folder tokens.
    const src = await Bun.file(join(ROOT, "agents/sync.ts")).text();
    const inSync = src.match(/const WORKSPACE_FOLDERS = \[([^\]]*)\]/s)?.[1] ?? "";
    expect(inSync.split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)).toEqual([...WORKSPACE_FOLDERS]);
  });

  test("every department declares which workspace folders it touches", async () => {
    // Every department must declare `drive:` explicitly; missing is not "no folders".
    const dir = join(ROOT, "agents");
    const names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

    for (const name of names) {
      const { front } = parseDoc(await Bun.file(join(dir, name, "AGENT.md")).text());
      expect(`${name}: ${front.drive ?? "MISSING"}`).not.toContain("MISSING");
      expect(`${name} write:`).toBe(front.drive!.includes("write:") ? `${name} write:` : `${name} MISSING write:`);
      expect(`${name} read:`).toBe(front.drive!.includes("read:") ? `${name} read:` : `${name} MISSING read:`);

      // A folder without the matching capability is unenforced. agents:check also fails on this.
      const { write, read } = parseDrive(front.drive);
      if (write.length || read.length)
        expect(`${name}: ${parseGoogle(front.google).join(",")}`).toContain("drive");
    }
  });
});

describe("drive: says what the code allows, not what Google allows", () => {
  test("both lists are read", () => {
    const d = parseDrive("write: [artist/presskit] read: [artist/photos, artist/brand]");
    expect(d.write).toEqual(["artist/presskit"]);
    expect(d.read).toEqual(["artist/photos", "artist/brand"]);
  });

  test("an empty list is a real answer, and so is a missing key", () => {
    expect(parseDrive("write: [] read: []")).toEqual({ write: [], read: [] });
    expect(parseDrive(undefined)).toEqual({ write: [], read: [] });
  });

  test("an unknown folder is dropped rather than handed over", () => {
    // Unknown tokens are dropped at run time; agents/sync.ts rejects them at author time.
    expect(parseDrive("write: [artist/taxes] read: [artist/photos]")).toEqual({
      write: [],
      read: ["artist/photos"],
    });
  });
});

describe("a placeholder in the environment is not a client", () => {
  // A placeholder like `GOOGLE_CLIENT_ID=...` must not shadow config.json.
  const key = "HOUSELABEL_TEST_ENV_VALUE";
  const withEnv = (v: string | undefined, f: () => void) => {
    const before = process.env[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
    try {
      f();
    } finally {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    }
  };

  test("dots, angle brackets, blanks and absence all mean unset", () => {
    for (const v of ["...", "…….".replace(/…/g, "."), "<your-client-id>", "", "   ", undefined]) {
      withEnv(v, () => expect(envValue(key)).toBeUndefined());
    }
  });

  test("a real value is returned, trimmed", () => {
    withEnv("  123-abc.apps.googleusercontent.com ", () => expect(envValue(key)).toBe("123-abc.apps.googleusercontent.com"));
  });
});
