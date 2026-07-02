import { describe, expect, it } from "vitest";
import { formatPassageForDisplay, parsePassage, PassageParseError } from "../src/index";

describe("passage parser", () => {
  it("parses a single verse", () => {
    const parsed = parsePassage("JHN.3.16");
    expect(parsed.canonical).toBe("JHN.3.16");
    expect(parsed.rangeType).toBe("single");
    expect(formatPassageForDisplay(parsed)).toBe("John 3:16");
  });

  it("normalizes mixed case and separators", () => {
    const parsed = parsePassage(" jhn:3:16 - 18 ");
    expect(parsed.canonical).toBe("JHN.3.16-18");
    expect(parsed.rangeType).toBe("same_chapter");
  });

  it("parses natural language single verse references", () => {
    const parsed = parsePassage("John 3:16");
    expect(parsed.canonical).toBe("JHN.3.16");
    expect(parsed.rangeType).toBe("single");
  });

  it("parses chapter references without verses", () => {
    const parsed = parsePassage("JHN.3");
    expect(parsed.canonical).toBe("JHN.3");
    expect(parsed.rangeType).toBe("chapter");
    expect(formatPassageForDisplay(parsed)).toBe("John 3");
  });

  it("parses natural language chapter references", () => {
    const parsed = parsePassage("John 3");
    expect(parsed.canonical).toBe("JHN.3");
    expect(parsed.rangeType).toBe("chapter");
  });

  it("parses dotted path-style chapter references", () => {
    const parsed = parsePassage("Mark.11");
    expect(parsed.canonical).toBe("MRK.11");
    expect(parsed.rangeType).toBe("chapter");
    expect(formatPassageForDisplay(parsed)).toBe("Mark 11");
  });

  it("parses slash path-style chapter references", () => {
    const parsed = parsePassage("Mark/1");
    expect(parsed.canonical).toBe("MRK.1");
    expect(parsed.rangeType).toBe("chapter");
  });

  it("parses chapter ranges without verses", () => {
    const parsed = parsePassage("JHN.3-4");
    expect(parsed.canonical).toBe("JHN.3-4");
    expect(parsed.rangeType).toBe("chapter_range");
    expect(formatPassageForDisplay(parsed)).toBe("John 3-4");
  });

  it("parses natural language verse ranges", () => {
    const parsed = parsePassage("1 John 4:7-8");
    expect(parsed.canonical).toBe("1JN.4.7-8");
    expect(parsed.rangeType).toBe("same_chapter");
  });

  it("parses pasted references with bidi formatting controls", () => {
    expect(parsePassage("Philippians‬ ‭4‬:‭19").canonical).toBe("PHP.4.19");
    expect(parsePassage("Romans‬ ‭4‬:‭19").canonical).toBe("ROM.4.19");
  });

  it("parses pasted references with zero-width characters", () => {
    const parsed = parsePassage("Philippians\u200B 4\u200B:\u200B19");
    expect(parsed.canonical).toBe("PHP.4.19");
  });

  it("parses pasted references with full-width punctuation", () => {
    const parsed = parsePassage("Philippians 4：19");
    expect(parsed.canonical).toBe("PHP.4.19");
  });

  it("parses compact shorthand references", () => {
    const parsed = parsePassage("rom8:28");
    expect(parsed.canonical).toBe("ROM.8.28");
  });

  it("parses compact chapter-only shorthand references", () => {
    const parsed = parsePassage("ecc8");
    expect(parsed.canonical).toBe("ECC.8");
    expect(parsed.rangeType).toBe("chapter");
  });

  it("parses cross reference ranges", () => {
    const parsed = parsePassage("JHN.3.16-JHN.4.2");
    expect(parsed.canonical).toBe("JHN.3.16-JHN.4.2");
    expect(parsed.rangeType).toBe("cross_reference");
  });

  it("parses natural cross-reference ranges", () => {
    const parsed = parsePassage("John 3:16 - John 4:2");
    expect(parsed.canonical).toBe("JHN.3.16-JHN.4.2");
    expect(parsed.rangeType).toBe("cross_reference");
  });

  it("parses implied-book cross-chapter natural ranges", () => {
    const parsed = parsePassage("John 3:35-4:3");
    expect(parsed.canonical).toBe("JHN.3.35-JHN.4.3");
    expect(parsed.rangeType).toBe("cross_reference");
    expect(formatPassageForDisplay(parsed)).toBe("John 3:35-4:3");
  });

  it("parses implied-book cross-chapter OSIS shorthand ranges", () => {
    const parsed = parsePassage("JHN.3.35-4.3");
    expect(parsed.canonical).toBe("JHN.3.35-JHN.4.3");
    expect(parsed.rangeType).toBe("cross_reference");
  });

  it("rejects invalid book codes", () => {
    expect(() => parsePassage("XYZ.1.1")).toThrowError(PassageParseError);
  });

  it("rejects reversed ranges", () => {
    expect(() => parsePassage("JHN.3.18-16")).toThrowError(PassageParseError);
  });

  it("rejects malformed formats", () => {
    expect(() => parsePassage("JHN316")).toThrowError(PassageParseError);
  });

  it("rejects shorthand chapter range exceeding max chapters", () => {
    expect(() => parsePassage("GEN.1-999")).toThrowError(PassageParseError);
  });

  it("accepts valid shorthand chapter range", () => {
    const parsed = parsePassage("GEN.1-50");
    expect(parsed.rangeType).toBe("chapter_range");
  });

  it("rejects shorthand chapter range for single-chapter book", () => {
    expect(() => parsePassage("PHM.1-2")).toThrowError(PassageParseError);
  });
});
