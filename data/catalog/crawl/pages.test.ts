import { describe, expect, test } from "bun:test";
import { marketingSite } from "./pages";

/** Signup URLs often sit on an app subdomain whose origin lists no products. */

describe("marketingSite", () => {
  test("drops an app subdomain to reach the site that sells", () => {
    expect(marketingSite("https://apply.awal.com/submit-form/")).toBe("https://awal.com");
    expect(marketingSite("https://login.dittomusic.com/en/signup/")).toBe("https://dittomusic.com");
    expect(marketingSite("https://auth.imusician.pro/signup?lng=en")).toBe("https://imusician.pro");
    expect(marketingSite("https://artist.amuse.io/#/")).toBe("https://amuse.io");
    expect(marketingSite("https://dashboard.onerpm.com/registration")).toBe("https://onerpm.com");
  });

  test("keeps a host that is already the marketing site", () => {
    expect(marketingSite("https://routenote.com/pricing")).toBe("https://routenote.com");
    expect(marketingSite("https://toolost.com/register")).toBe("https://toolost.com");
    expect(marketingSite("https://symphonicdistribution.com")).toBe("https://symphonicdistribution.com");
  });

  test("keeps www, which is the marketing site and not an app", () => {
    expect(marketingSite("https://www.venicemusic.co/sign-up-to-venice-general"))
      .toBe("https://www.venicemusic.co");
  });

  test("never invents a host that would not resolve", () => {
    // Two labels: there is nothing to drop, even if the first looks like an app.
    expect(marketingSite("https://app.co/signup")).toBe("https://app.co");
    // An unknown subdomain is left alone rather than guessed away.
    expect(marketingSite("https://eu-central.example.com/x")).toBe("https://eu-central.example.com");
  });

  test("returns the input unchanged when it is not a URL", () => {
    expect(marketingSite("not a url")).toBe("not a url");
  });
});
