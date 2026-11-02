/**
 * The pure half of social:variants — which shapes a task needs, and the crop.
 * The Drive half is the same listFolder/uploadBinary the presskit already uses.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { cropTo, SHAPES, shapesFor } from "./variants";

describe("shapesFor", () => {
  test("Instagram, Facebook and Threads share one 4:5 file", () => {
    expect(shapesFor(["instagram", "facebook", "threads"], "post")).toEqual(["feed"]);
  });

  test("a reel or story is vertical on Instagram; TikTok always is", () => {
    expect(shapesFor(["instagram"], "reel")).toEqual(["vertical"]);
    expect(shapesFor(["instagram"], "story")).toEqual(["vertical"]);
    expect(shapesFor(["tiktok"], null)).toEqual(["vertical"]);
  });

  test("YouTube is wide unless it is a Short", () => {
    expect(shapesFor(["youtube"], null)).toEqual(["wide"]);
    expect(shapesFor(["youtube"], "short")).toEqual(["vertical"]);
  });

  test("no platform decided yet makes all three", () => {
    expect(shapesFor([], null)).toEqual(["feed", "vertical", "wide"]);
  });
});

describe("cropTo", () => {
  // A landscape phone photo, the common case: the crop must hit the exact size.
  const photo = sharp({ create: { width: 4032, height: 3024, channels: 3, background: "#335" } }).jpeg().toBuffer();

  for (const shape of Object.keys(SHAPES) as (keyof typeof SHAPES)[])
    test(`${shape} comes out at exactly ${SHAPES[shape].width}×${SHAPES[shape].height}`, async () => {
      const meta = await sharp(await cropTo(await photo, shape)).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([SHAPES[shape].width, SHAPES[shape].height, "jpeg"]);
    });
});
