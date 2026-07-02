import { describe, expect, it } from "vitest";
import { grab, grabBCV, normalizeBookName, parseBCV } from "../src/index.js";

describe("grabBCV", () => {
  it("extracts multiple references from prose", () => {
    const input = "Read John 3:16 and 1 Cor 13:4-7 this week.";
    const output = grabBCV(input);

    expect(output).toEqual([
      {
        raw: "John 3:16",
        index: 5,
        book: "John",
        chapter: 3,
        verse: 16
      },
      {
        raw: "1 Cor 13:4-7",
        index: 19,
        book: "1 Corinthians",
        chapter: 13,
        verse: 4,
        endVerse: 7
      }
    ]);
  });

  it("supports chapter-only references", () => {
    expect(grabBCV("Pray through Psalms 23.")).toEqual([
      {
        raw: "Psalms 23",
        index: 13,
        book: "Psalms",
        chapter: 23
      }
    ]);
  });

  it("exposes grab alias", () => {
    expect(grab("Matthew 5:9")).toHaveLength(1);
  });
});

describe("parseBCV", () => {
  it("parses a single reference string", () => {
    expect(parseBCV("Gen 1:1")).toEqual({
      raw: "Gen 1:1",
      index: 0,
      book: "Genesis",
      chapter: 1,
      verse: 1
    });
  });

  it("returns null for invalid strings", () => {
    expect(parseBCV("hello world")).toBeNull();
  });
});

describe("normalizeBookName", () => {
  it("normalizes common abbreviations", () => {
    expect(normalizeBookName("jn")).toBe("John");
    expect(normalizeBookName("1 Pet")).toBe("1 Peter");
  });
});
