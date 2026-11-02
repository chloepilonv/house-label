import { describe, expect, test } from "bun:test";
import { encodeHeader, rawMessage } from "./gmail-send";

describe("gmail-send", () => {
  test("ascii subject passes through, accents are RFC 2047 encoded", () => {
    expect(encodeHeader("Monday recap")).toBe("Monday recap");
    expect(encodeHeader("Récap du lundi")).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });

  test("raw message decodes to headers, blank line, body", () => {
    const raw = rawMessage("me@example.com", "Hi", "line 1\nline 2");
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    expect(mime.startsWith("To: me@example.com\r\nSubject: Hi\r\n")).toBe(true);
    expect(mime.endsWith("\r\n\r\nline 1\nline 2")).toBe(true);
  });

  test("with html it is multipart/alternative, text first", () => {
    const mime = Buffer.from(rawMessage("me@example.com", "Hi", "plain", "<b>rich</b>"), "base64url").toString("utf8");
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="');
    expect(mime.indexOf("text/plain")).toBeLessThan(mime.indexOf("text/html"));
    expect(mime).toContain("<b>rich</b>");
  });
});
