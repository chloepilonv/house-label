/**
 * smoothWriter loses nothing and leaves piped sessions untouched; labelled
 * output names the speaker.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { smoothWriter, speakerWriter } from "./repl";

/** Enough of a WriteStream for the writer to talk to. */
const fake = (isTTY: boolean) => {
  const out: string[] = [];
  return {
    stream: { isTTY, write: (s: string) => (out.push(s), true) } as unknown as NodeJS.WriteStream,
    text: () => out.join(""),
    calls: () => out.length,
  };
};

describe("smoothWriter", () => {
  test("loses nothing — everything written comes out", async () => {
    const f = fake(true);
    const w = smoothWriter(f.stream);
    w.write("hello ");
    w.write("world, this arrived in three bursts");
    w.write(" and a fourth");
    await w.flush();
    expect(f.text()).toBe("hello world, this arrived in three bursts and a fourth");
  });

  test("breaks a burst into more writes than it arrived in", async () => {
    const f = fake(true);
    const w = smoothWriter(f.stream);
    w.write("a".repeat(200));
    await w.flush();
    expect(f.calls()).toBeGreaterThan(1);
    expect(f.text()).toHaveLength(200);
  });

  // Non-TTY output is written immediately.
  test("a non-TTY stream is passed through untouched, one call per write", async () => {
    const f = fake(false);
    const w = smoothWriter(f.stream);
    w.write("one");
    w.write("two");
    await w.flush();
    expect(f.text()).toBe("onetwo");
    expect(f.calls()).toBe(2);
  });

  test("flush resolves even when nothing was written", async () => {
    const w = smoothWriter(fake(true).stream);
    await w.flush();
  });
});

/**
 * Assertions are on the name as text, not escape codes, so NO_COLOR does not matter.
 */
describe("speakerWriter", () => {
  const collect = () => {
    const out: string[] = [];
    return { write: (s: string) => void out.push(s), text: () => out.join("") };
  };
  /** Feed a reply one character at a time — the worst case a stream produces. */
  const stream = (name: string, text: string) => {
    const c = collect();
    const w = speakerWriter(name, c.write);
    for (const ch of text) w.write(ch);
    return c.text();
  };

  test("names the speaker over the first paragraph", () => {
    expect(stream("The Rights Agent", "Which role are you registering for?")).toContain(
      "The Rights Agent",
    );
  });

  test("names them again over every later paragraph", () => {
    const out = stream("The Rights Agent", "First thing.\n\nSecond thing.\n\nThird thing.");
    expect(out.split("The Rights Agent")).toHaveLength(4);
  });

  test("a single newline stays a line break, not a new paragraph", () => {
    const out = stream("The Press Agent", "One line.\nStill the same thought.");
    expect(out.split("The Press Agent")).toHaveLength(2);
    expect(out).toContain("One line.\n  Still the same thought.");
  });

  test("loses no words, however the chunks fall", () => {
    const text = "Paragraph one.\n\nParagraph two, which is longer.";
    const words = (s: string) => s.replace(/\s+/g, " ").trim();
    const out = stream("The Press Agent", text);
    for (const w of ["Paragraph one.", "Paragraph two, which is longer."])
      expect(words(out)).toContain(w);
  });

  test("indents the body into the same gutter as the name", () => {
    expect(stream("The Press Agent", "Hello.")).toMatch(/ {2}.*The Press Agent.*\n {2}Hello\./);
  });

  // The model sometimes emits bold despite the house voice.
  test("drops the stars a model puts around a question", () => {
    const out = stream("The Platforms Agent", "**What's your annual revenue right now?**");
    expect(out).not.toContain("*");
    expect(out).toContain("What's your annual revenue right now?");
  });

  test("the name still lands on the first real word, not on a star", () => {
    expect(stream("The Press Agent", "**Ready?**")).toMatch(/The Press Agent.*\n {2}Ready\?$/);
  });

  test("drops stars that arrive split across chunks", () => {
    const c = collect();
    const w = speakerWriter("The Press Agent", c.write);
    w.write("A *");
    w.write("*bold*");
    w.write("* word.");
    expect(c.text()).toContain("A bold word.");
    expect(c.text()).not.toContain("*");
  });

  test("blank lines before the reply do not push the name off the gutter", () => {
    const out = stream("The Promotion Agent", "\n\n   Radio first.");
    expect(out.startsWith("  ")).toBe(true);
    expect(out).toContain("Radio first.");
    expect(out.split("The Promotion Agent")).toHaveLength(2);
  });
});
