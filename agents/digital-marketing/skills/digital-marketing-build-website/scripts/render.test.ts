/**
 * Pins the rules in site.ts and checks the page render.ts writes from them.
 * The fixture carries real gaps: a French bio on an `en` profile, an EP with
 * no artwork, few smart links, no shows.
 */
import { describe, expect, test } from "bun:test";
import { collectSite, detectLocale, type SiteRows } from "./site";
import { renderDocument, renderSite } from "./render";

const TODAY = "2026-09-04";

const odileRay = (): SiteRows => ({
  profile: {
    artist_name: "Odile Ray",
    city: "Montreal",
    region: "QC",
    country: "CA",
    genres: ["folk acoustic"],
    target_markets: ["QC", "CA", "US"],
    disciplines: ["songwriter", "performer", "producer", "composer"],
    preferred_locale: "en",
  },
  presskit: {
    id: 1,
    short_bio: null,
    long_bio: "Odile Ray est une autrice-compositrice-interprète folk basée à Montréal. En 2024, son EP « Charlevoix Sessions » remporte le prix GAMIQ du EP folk de l'année.",
    contact_email: "management@example.com",
    booking_email: null,
    visual_identity: {},
    current_version: 9,
  },
  presskit_version: { version: 9, presentation_url: "https://docs.google.com/presentation/d/x/edit", pdf_url: null },
  presskit_items: [
    { kind: "show", data: { venue: "Club Soda", city: "Montréal", date: "2026-12-01" } },
    { kind: "clipping", data: { url: "https://panm360.com/a", title: "Odile Ray, la plume folk", outlet: "PAN M 360", quote: "Le ton, le verbe, tout semble réussir." } },
    { kind: "clipping", data: { url: "https://danslatetedesfilles.com/b", title: "Une folk qui ne demande pas la permission", outlet: "Dans la tête des filles", quote: null } },
    { kind: "award", data: { year: "2024", title: "EP folk de l'année", organization: "GAMIQ" } },
    { kind: "team", data: { role: "Booking", email: "booking@example.com" } },
    { kind: "team", data: { role: "Presse", email: "press@example.com" } },
    { kind: "photo", data: { url: "https://example.com/photo-1.jpg" } },
    { kind: "photo", data: { url: "https://example.com/photo-2.jpg" } },
  ],
  releases: [
    { id: "r1", title: "Les heures creuses", release_type: "ep", release_date: "2026-11-13", cover_art_url: null, smart_link_url: null },
    { id: "r2", title: "Premier hiver (Radio Edit)", release_type: "single", release_date: "2024-01-01", cover_art_url: "https://f4.bcbits.com/img/a.jpg", smart_link_url: "https://found.ee/premierhiver" },
    { id: "r3", title: "Charlevoix Sessions", release_type: "album", release_date: "2022-01-01", cover_art_url: "https://f4.bcbits.com/img/b.jpg", smart_link_url: null },
    { id: "r4", title: "Les fenêtres ouvertes", release_type: "mixtape", release_date: "2023-01-01", cover_art_url: "https://f4.bcbits.com/img/c.jpg", smart_link_url: null },
  ],
  platforms: [
    { platform: "spotify", url: "https://open.spotify.com/artist/5llp" },
    { platform: "bandcamp", url: "https://odile-ray.bandcamp.com" },
    { platform: "instagram", url: "https://instagram.com/odileray" },
    { platform: "website", url: "https://odile-ray.com" },
  ],
  brand: null,
  website: null,
  memory: [],
});

describe("detectLocale", () => {
  test("a French bio on an English profile is French", () => {
    expect(detectLocale(odileRay().presskit!.long_bio as string, "en")).toBe("fr");
  });
  test("an English bio is English, and a tie falls back to the profile", () => {
    expect(detectLocale("She is the first woman to win the award, and the record is out.", "fr")).toBe("en");
    expect(detectLocale("Odile Ray", "fr")).toBe("fr");
  });
});

describe("collectSite — the rules", () => {
  const site = collectSite(odileRay(), { today: TODAY });

  test("the hero is the next release, and its pre-save is missing until someone sets it", () => {
    expect(site.hero.release?.title).toBe("Les heures creuses");
    expect(site.hero.release?.upcoming).toBe(true);
    expect(site.hero.presave).toBeNull();
    expect(site.missing.map((m) => m.id)).toContain("hero.presave");
  });

  test("the listen button is the latest released record's smart link", () => {
    expect(site.hero.listen).toEqual({ title: "Premier hiver (Radio Edit)", url: "https://found.ee/premierhiver" });
  });

  test("releases are newest first and link to the smart link, else Bandcamp", () => {
    expect(site.releases.map((r) => r.title)[0]).toBe("Les heures creuses");
    expect(site.releases.find((r) => r.title.startsWith("Charlevoix"))?.link).toBe("https://odile-ray.bandcamp.com");
    expect(site.releases.find((r) => r.title.startsWith("Les fenêtres"))?.type).toBe("Mixtape");
  });

  test("a show dated after today is upcoming; the rest are past", () => {
    expect(site.shows.upcoming.map((s) => s.venue)).toEqual(["Club Soda"]);
    expect(site.missing.map((m) => m.id)).not.toContain("shows.upcoming");
    expect(site.missing.map((m) => m.id)).toContain("shows.past");
  });

  test("the bio lands in the language it was written in, and the other one is missing", () => {
    expect(site.bio.text.fr).toBeDefined();
    expect(site.bio.text.en).toBeUndefined();
    expect(site.missing.find((m) => m.id === "bio.en")?.fix).toContain("artist:remember digital-marketing website.bio");
  });

  test("a clipping that carries a quote is a quote; one that does not stays a clipping", () => {
    expect(site.press.quotes).toHaveLength(1);
    expect(site.press.quotes[0]?.source).toBe("PAN M 360");
    expect(site.press.clippings).toHaveLength(2);
  });

  test("the website platform row is not a social; the rest are", () => {
    expect(site.contact.socials.map((s) => s.platform)).toEqual(["spotify", "bandcamp", "instagram"]);
  });

  test("the store, newsletter and SMS are missing until artist.website says otherwise", () => {
    const ids = site.missing.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["store.url", "contact.newsletter", "contact.sms"]));
    expect(site.missing.find((m) => m.id === "store.url")?.fix).toContain("artist:set website");
  });

  test("artist.website and memory fill the gaps without touching the presskit", () => {
    const rows = odileRay();
    rows.website = { shop_url: "https://odile-ray.bandcamp.com/merch", newsletter_url: "https://mailchi.mp/x", presave_url: "https://found.ee/pga", default_locale: "fr", bandsintown_artist: "Odile Ray" };
    rows.memory = [{ key: "website.bio", value: "Odile Ray is a rapper and producer from Montreal.", language: "en" }];
    const s = collectSite(rows, { today: TODAY });
    expect(s.locale).toBe("fr");
    expect(s.hero.presave).toBe("https://found.ee/pga");
    expect(s.bio.text.en).toContain("Montreal");
    expect(s.bio.text.fr).toContain("Montréal");
    expect(s.missing.map((m) => m.id)).not.toContain("store.url");
    expect(s.missing.map((m) => m.id)).not.toContain("bio.en");
  });

  test("Drive photos come first, so the hero is the artist's own photo", () => {
    const s = collectSite(odileRay(), { today: TODAY, extraPhotos: ["drive://abc"] });
    expect(s.photos[0]).toBe("drive://abc");
    expect(s.photos).toHaveLength(3);
  });

  test("the theme is the brand when there is one, the default otherwise", () => {
    expect(site.theme.accent).toBe("#D9B65C");
    const rows = odileRay();
    rows.brand = { primary_color: "#E4572E", background_color: "#101010", text_color: "#FFFFFF", font_display: "Syne", font_body: "Inter", font_source: "google" };
    const s = collectSite(rows, { today: TODAY });
    expect(s.theme).toMatchObject({ accent: "#E4572E", background: "#101010", fontDisplay: "Syne" });
  });

  test("empty rows produce a site, not a crash", () => {
    const s = collectSite({ profile: null, presskit: null, presskit_items: [], presskit_version: null, releases: [], platforms: [], brand: null, website: null, memory: [] }, { today: TODAY });
    expect(s.name).toBe("");
    expect(s.hero.release).toBeNull();
    expect(s.missing.length).toBeGreaterThan(5);
    expect(() => renderSite(s, { mode: "preview" })).not.toThrow();
  });
});

describe("renderSite — the page", () => {
  const site = collectSite(odileRay(), { today: TODAY });

  test("preview marks every gap; public shows none of them", () => {
    const preview = renderSite(site, { mode: "preview" });
    const pub = renderSite(site, { mode: "public" });
    expect(preview).toContain('class="ph');
    expect(pub).not.toContain('class="ph');
    expect(pub).not.toContain("to be completed");
  });

  test("both languages are on the page and the default opens first", () => {
    const html = renderDocument(site, { mode: "public" });
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('<span class="fr">Musique</span>');
    expect(html).toContain('<span class="en">Music</span>');
  });

  test("images are swapped for their data URIs and nothing else is rewritten", () => {
    const html = renderSite(site, { mode: "public", images: { "https://f4.bcbits.com/img/a.jpg": "data:image/jpeg;base64,AAAA" } });
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(html).toContain('src="https://f4.bcbits.com/img/b.jpg"');
  });

  test("what the data holds is on the page; nothing is invented", () => {
    const html = renderSite(site, { mode: "public" });
    for (const s of ["Odile Ray", "Les heures creuses", "https://found.ee/premierhiver", "Club Soda", "PAN M 360", "GAMIQ", "booking@example.com", "Bricolage+Grotesque"]) {
      expect(html).toContain(s);
    }
    // A leaked null or undefined lands between tags or inside an attribute.
    expect(html).not.toMatch(/>(undefined|null)</);
    expect(html).not.toMatch(/="(undefined|null)"/);
    expect(html).not.toContain("Vinyle");
  });

  test("a switched-off section is not rendered", () => {
    const s = collectSite({ ...odileRay(), website: { sections: { press: false }, shop_url: "https://shop.example" } }, { today: TODAY });
    const html = renderSite(s, { mode: "public" });
    expect(html).not.toContain('id="press"');
    expect(html).toContain('id="store"');
  });
});
