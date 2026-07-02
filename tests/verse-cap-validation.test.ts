import { describe, expect, it } from "vitest";
import {
  parsePassage,
  PassageParseError,
  resolveBookAlias,
  tryParsePassage,
} from "../src/index";

describe("verse and chapter caps", () => {
  it("rejects out-of-range verse for direct OSIS", () => {
    expect(() => parsePassage("JHN.3.37")).toThrowError("John 3 has 36 verses.");
  });

  it("rejects out-of-range verse for natural shorthand range", () => {
    expect(() => parsePassage("John 3:16-37")).toThrowError("John 3 has 36 verses.");
  });

  it("rejects out-of-range verse for natural single verse", () => {
    expect(() => parsePassage("John 3:133")).toThrowError("John 3 has 36 verses.");
  });

  it("rejects out-of-range verse for explicit cross-reference", () => {
    expect(() => parsePassage("JHN.3.16-JHN.3.37")).toThrowError("John 3 has 36 verses.");
  });

  it("rejects out-of-range verse for implied-book cross-chapter range", () => {
    expect(() => parsePassage("John 3:35-4:99")).toThrowError("John 4 has 54 verses.");
  });

  it("accepts max valid verse boundary", () => {
    expect(parsePassage("JHN.3.36").canonical).toBe("JHN.3.36");
  });

  it("accepts max valid single-chapter verse", () => {
    expect(parsePassage("PHM.1.25").canonical).toBe("PHM.1.25");
  });

  it("rejects chapter overflow in natural refs", () => {
    expect(() => parsePassage("Jude 2")).toThrowError("Jude has 1 chapter.");
  });

  it("attaches structured details for chapter overflow", () => {
    const result = tryParsePassage("Jude 2");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toEqual({
        kind: "chapter_cap",
        book: "JUD",
        bookName: "Jude",
        maxChapter: 1,
        attemptedChapter: 2,
      });
    }
  });

  it("attaches structured details for verse overflow", () => {
    const result = tryParsePassage("John 3:133");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details).toEqual({
        kind: "verse_cap",
        book: "JHN",
        bookName: "John",
        chapter: 3,
        maxVerse: 36,
        attemptedVerse: 133,
      });
    }
  });

  it("rejects non-positive verse values", () => {
    expect(() => parsePassage("John 3:0")).toThrowError(PassageParseError);
  });
});

describe("book alias variations", () => {
  it("supports ordinal word variations for numbered books", () => {
    expect(parsePassage("First John 4:7").canonical).toBe("1JN.4.7");
    expect(parsePassage("Second Corinthians 5:17").canonical).toBe("2CO.5.17");
    expect(parsePassage("Third John 1:2").canonical).toBe("3JN.1.2");
  });

  it("supports roman numeral variations for numbered books", () => {
    expect(parsePassage("I John 4:7").canonical).toBe("1JN.4.7");
    expect(parsePassage("II Corinthians 5:17").canonical).toBe("2CO.5.17");
    expect(parsePassage("III John 1:2").canonical).toBe("3JN.1.2");
  });

  it("supports punctuation and spacing variations", () => {
    expect(parsePassage("1.John 4:7").canonical).toBe("1JN.4.7");
    expect(parsePassage("song of songs 1:1").canonical).toBe("SNG.1.1");
    expect(parsePassage("psalm 23:1").canonical).toBe("PSA.23.1");
  });

  it("returns null for ambiguous fuzzy aliases", () => {
    expect(resolveBookAlias("jo")).toBeNull();
  });
});
