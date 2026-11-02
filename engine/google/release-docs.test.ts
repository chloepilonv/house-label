import { describe, expect, test } from "bun:test";
import { linkRows, linksSheetName, lyricsDocName, newRows } from "./release-docs";

const input = {
  release: { title: "nuit blanche", smart_link_url: "https://ffm.to/nuitblanche", upc: "000000000000" },
  links: [{ category: "video", label: "visualizer (YouTube)", url: "https://youtu.be/x" }],
  platforms: [{ platform: "instagram", url: "https://instagram.com/a" }, { platform: "spotify", url: "https://open.spotify.com/artist/1" }],
  songs: [{ title: "nuit blanche", isrc: "CAXXX2600001" }, { title: "no code" }],
};

describe("useful links sheet", () => {
  test("smart link, the release's links, stores before socials, then the codes", () => {
    expect(linkRows(input, "fr")).toEqual([
      ["Smart link", "nuit blanche", "https://ffm.to/nuitblanche"],
      ["Vidéo", "visualizer (YouTube)", "https://youtu.be/x"],
      ["Plateformes", "Spotify", "https://open.spotify.com/artist/1"],
      ["Réseaux", "Instagram", "https://instagram.com/a"],
      ["Identifiants", "UPC — nuit blanche", "000000000000"],
      ["Identifiants", "ISRC — nuit blanche", "CAXXX2600001"],
    ]);
    expect(linksSheetName("nuit blanche", "fr")).toBe("Liens utiles — nuit blanche");
    expect(lyricsDocName("nuit blanche", "en")).toBe("nuit blanche — lyrics");
  });
  test("a link already in the sheet is not added twice; the artist's own rows stay", () => {
    const rows = linkRows(input, "en");
    const existing = [["Category", "What", "Link"], ["Mine", "my note", "https://x.y"], rows[0]!];
    expect(newRows(existing, rows)).toEqual(rows.slice(1));
  });
});
