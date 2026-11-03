import { describe, expect, it } from "vitest";
import {
  extractSharedCanonical,
  findAnyPassage,
  normalizeAnyPassage,
  normalizeSharedPassage,
  parseAnyPassage,
  parseSharedPassage,
  tryParseAnyPassage,
  tryParseSharedPassage
} from "../src/index";

describe("share target parser", () => {
  it("extracts canonical references from share payloads", () => {
    const canonical = extractSharedCanonical({
      url: "https://www.bible.com/bible/1/JHN.3.16.KJV"
    });
    expect(canonical).toBe("JHN.3.16");
  });

  it("parses YouVersion share URLs with translation suffixes", () => {
    const parsed = parseSharedPassage({
      url: "https://www.bible.com/bible/1/JHN.3.16.KJV"
    });
    expect(parsed?.canonical).toBe("JHN.3.16");
  });

  it("parses BibleGateway search URLs", () => {
    const parsed = parseSharedPassage({
      url: "https://www.biblegateway.com/passage/?search=John%203%3A12&version=KJV"
    });
    expect(parsed?.canonical).toBe("JHN.3.12");
  });

  it("parses Enduring Word chapter URLs", () => {
    const parsed = parseSharedPassage({
      url: "https://enduringword.com/bible-commentary/song-of-solomon-1/"
    });
    expect(parsed?.canonical).toBe("SNG.1");
  });

  it("parses mixed text shares with embedded URLs", () => {
    const parsed = parseSharedPassage({
      text: "Check this out https://app.logos.com/bible/ROM.8.28"
    });
    expect(parsed?.canonical).toBe("ROM.8.28");
  });

  it("parses Logos data-type references", () => {
    const parsed = parseSharedPassage({
      url: "https://app.logos.com/books/LLS%3A1.0.710/references/bible%2Besv.64.3.16"
    });
    expect(parsed?.canonical).toBe("JHN.3.16");
  });

  it("parses references from arbitrary URL slugs", () => {
    const parsed = parseSharedPassage({
      url: "https://example.com/blog/the-power-of-john-3-16-for-today"
    });
    expect(parsed?.canonical).toBe("JHN.3.16");
  });

  it("parses wd.bible locale URLs with verse-range hash anchors", () => {
    const parsed = parseSharedPassage({
      url: "https://wd.bible/en/bible/jhn.3.kjv#16-18"
    });
    expect(parsed?.canonical).toBe("JHN.3.16-18");
  });

  it("does not infer references from date-style URLs without book names", () => {
    const parsed = parseSharedPassage({
      url: "https://example.com/2026/03/16/weekly-update"
    });
    expect(parsed).toBeNull();
  });

  it("builds normalized metadata from share payloads", () => {
    const normalized = normalizeSharedPassage(
      {
        url: "https://www.biblegateway.com/passage/?search=John%203%3A12&version=KJV"
      },
      { routeBaseUrl: "https://route.bible" }
    );
    expect(normalized?.canonical).toBe("JHN.3.12");
    expect(normalized?.display).toBe("John 3:12");
    expect(normalized?.routePath).toBe("/jhn.3.12");
    expect(normalized?.routeUrl).toBe("https://route.bible/jhn.3.12");
    expect(normalized?.source.kind).toBe("url");
  });
});

describe("tryParseSharedPassage", () => {
  it("returns parsed passage when successful", () => {
    const result = tryParseSharedPassage({
      url: "https://www.biblegateway.com/passage/?search=John%203%3A12&version=KJV"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.canonical).toBe("JHN.3.12");
    }
  });

  it("returns EMPTY for non-passage payloads", () => {
    const result = tryParseSharedPassage({
      text: "hello world"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY");
    }
  });
});

describe("parseAnyPassage", () => {
  it("parses plain references", () => {
    expect(parseAnyPassage("John 3:16").canonical).toBe("JHN.3.16");
  });

  it("supports multiple-output overload", () => {
    const parsed = parseAnyPassage("Read John 3:16 and Romans 8:28 this week.", { multiple: true });
    expect(parsed.map((item) => item.canonical)).toEqual(["JHN.3.16", "ROM.8.28"]);
  });

  it("parses shared URLs directly", () => {
    expect(parseAnyPassage("https://www.biblegateway.com/passage/?search=John%203%3A12&version=KJV").canonical).toBe("JHN.3.12");
  });

  it("parses lowercase route.bible-style URLs", () => {
    expect(parseAnyPassage("https://route.bible/jhn.3.16").canonical).toBe("JHN.3.16");
  });

  it("keeps route.bible hyphen slugs as chapter ranges", () => {
    expect(parseAnyPassage("https://www.route.bible/rev.6-7?v=BSB&mode=launcher").canonical).toBe("REV.6-7");
  });

  it("parses wd.bible locale URLs with verse-range hash anchors", () => {
    expect(parseAnyPassage("https://wd.bible/en/bible/jhn.3.kjv#16-18").canonical).toBe("JHN.3.16-18");
  });

  it("throws parse errors for invalid input", () => {
    expect(() => parseAnyPassage("")).toThrow();
    expect(() => parseAnyPassage("not a passage")).toThrow();
  });

  it("normalizes any-passage input into route metadata", () => {
    const normalized = normalizeAnyPassage("John 3:16", {
      routeBaseUrl: "https://example.test"
    });
    expect(normalized?.canonical).toBe("JHN.3.16");
    expect(normalized?.routeUrl).toBe("https://example.test/jhn.3.16");
    expect(normalized?.source.kind).toBe("input");
  });
});

describe("findAnyPassage", () => {
  it("returns null for invalid input", () => {
    expect(findAnyPassage("")).toBeNull();
    expect(findAnyPassage("not a passage")).toBeNull();
    expect(findAnyPassage("John https://example.com 3")).toBeNull();
    expect(findAnyPassage("John https://example.com 3", { multiple: true })).toEqual([]);
  });

  it.each([
    "John 3:16,1a",
    "Read John 3:16,1a2 today.",
    "Read John 3:16,18a today.",
    "Read John 3:16,37 today.",
    "Read John 3:16,20-18 today.",
    "Read John 3:16,4:2 today.",
    "John 3,5",
    "John 3;5",
    "Read John 3,5 today.",
    "Read John 3-5,7 today.",
    "https://www.biblegateway.com/passage/?search=John%203%3A16%2C20-18",
    "https://www.bible.com/bible/1/JHN.3.16,20-18.KJV",
    "https://example.com/John-3-16%EF%BC%8C18",
  ])("does not silently truncate invalid or unsupported numeric lists: %s", (input) => {
    expect(findAnyPassage(input)).toBeNull();
    expect(findAnyPassage(input, { multiple: true })).toEqual([]);
    expect(tryParseAnyPassage(input).ok).toBe(false);
    expect(normalizeSharedPassage({ text: input })).toBeNull();
  });

  it.each([
    "John 3:16,18",
    "John 3 16,18",
    "John3:16,18",
    "John 3:16; 18",
    "JHN.3.16,18",
    "Read John 3:16,18 today.",
    "Read John 3 16,18 today.",
    "Read John3:16,18 today.",
    "Read John 3:16，18 today.",
    "Read John 3:16；18 today.",
    "Read Ｊｏｈｎ ３：１６，１８ today.",
    "https://www.biblegateway.com/passage/?search=John%203%3A16%2C18",
    "https://www.bible.com/bible/1/JHN.3.16,18.KJV",
    "https://www.bible.com/bible/1/JHN.3.16%2C18.KJV",
    "https://www.bible.com/bible/1/JHN.3.16%3B18.KJV",
  ])("returns separate verses from a list only with multiple: true: %s", (input) => {
    expect(findAnyPassage(input)).toBeNull();
    expect(tryParseAnyPassage(input)).toMatchObject({ ok: false, error: { code: "INVALID_FORMAT" } });
    expect(normalizeSharedPassage({ text: input })).toBeNull();
    expect(findAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual([
      "JHN.3.16", "JHN.3.18"
    ]);
    expect(parseAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual([
      "JHN.3.16", "JHN.3.18"
    ]);
  });

  it("preserves ranges, order, and separate numbered references in verse lists", () => {
    const input = "Read John 3:16–18,20,16-18; 1 John 4:7，9 and Romans 8:28.";
    expect(findAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual([
      "JHN.3.16-18", "JHN.3.20", "1JN.4.7", "1JN.4.9", "ROM.8.28"
    ]);
  });

  it.each([
    "Read John 3:16,37 and Romans 8:28.",
    "Read https://www.bible.com/bible/1/JHN.3.16%2C37.KJV and Romans 8:28.",
  ])("skips an unsupported list without losing a separate valid passage: %s", (input) => {
    expect(findAnyPassage(input)?.canonical).toBe("ROM.8.28");
    expect(findAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual(["ROM.8.28"]);
  });

  it.each([
    "Please join 3 groups",
    "Please join3 groups",
    "The duet 2 starts soon",
    "We act on 3 requests",
    "I wrote like 10 notes",
    "I wrote like４ notes",
    "Read like.4.KJV today.",
    "See where like 4 is a bible chip LOL #bug #dotflowy",
  ])(
    "does not fuzzy-match chapter-only references in prose: %s", (input) => {
      expect(findAnyPassage(input)).toBeNull();
      expect(findAnyPassage(input, { multiple: true })).toEqual([]);
    }
  );

  it("keeps explicit chapter aliases and verse-level typo recovery in prose", () => {
    expect(findAnyPassage("Read John 3 today.")?.canonical).toBe("JHN.3");
    expect(findAnyPassage("Read Jhon 3:16 today.")?.canonical).toBe("JHN.3.16");
    expect(findAnyPassage("Jhon 3")?.canonical).toBe("JHN.3");
  });

  it("returns multiple parsed passages in source order", () => {
    const parsed = findAnyPassage(
      "https://www.biblegateway.com/passage/?search=John%203%3A12&version=KJV and Romans 8:28",
      { multiple: true }
    );
    expect(parsed.map((item) => item.canonical)).toEqual(["JHN.3.12", "ROM.8.28"]);
  });

  it("preserves complete numbered references after list punctuation", () => {
    const input = "John 3:16, 1 John 4:7; 2 Corinthians 5:17";
    expect(findAnyPassage(input)?.canonical).toBe("JHN.3.16");
    expect(findAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual([
      "JHN.3.16", "1JN.4.7", "2CO.5.17"
    ]);
  });

  it.each([
    ["1st John 4:7", "1JN.4.7"],
    ["2nd Corinthians 5:17", "2CO.5.17"],
    ["3rd John 1:2", "3JN.1.2"],
  ])("preserves both references when the second uses an ordinal: %s", (reference, canonical) => {
    for (const separator of [",", ";"]) {
      const input = `John 3:16${separator} ${reference}`;
      expect(findAnyPassage(input)?.canonical).toBe("JHN.3.16");
      expect(findAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual([
        "JHN.3.16", canonical
      ]);
    }
  });

  it.each([
    ["1 John 1:1", "1JN.1.1"],
    ["1 jhon 1:1", "1JN.1.1"],
    ["2 John 1:13", "2JN.1.13"],
    ["3rd John 1:2", "3JN.1.2"],
    ["First John 4:7-8", "1JN.4.7-8"],
    ["II Corinthians 5:17", "2CO.5.17"],
    ["like 1 John 1:1", "1JN.1.1"],
  ])("keeps the numbered-book prefix after surrounding prose: %s", (reference, canonical) => {
    const input = `Read ${reference} today.`;
    expect(findAnyPassage(input)?.canonical).toBe(canonical);
    expect(findAnyPassage(input, { multiple: true }).map((p) => p.canonical)).toEqual([canonical]);
    expect(normalizeSharedPassage({ text: input })?.canonical).toBe(canonical);
  });

  it.each(["Read 1 John 6:1 today.", "Read 2 John 2:1 today."])(
    "does not retry an invalid numbered reference as an unnumbered book: %s", (input) => {
      expect(findAnyPassage(input)).toBeNull();
      expect(findAnyPassage(input, { multiple: true })).toEqual([]);
    }
  );

  it("dedupes duplicate references when using multiple-output overload", () => {
    const parsed = findAnyPassage("John 3:16, JHN.3.16, and John 3:16", { multiple: true });
    expect(parsed.map((item) => item.canonical)).toEqual(["JHN.3.16"]);
  });

  it("does not emit both verse and range interpretations for route.bible range URLs", () => {
    const parsed = findAnyPassage("https://www.route.bible/rev.6-7?v=BSB&mode=launcher", { multiple: true });
    expect(parsed.map((item) => item.canonical)).toEqual(["REV.6-7"]);
  });
});

describe("tryParseAnyPassage", () => {
  it("preserves cap-specific parser errors", () => {
    const verseCap = tryParseAnyPassage("John 3:16-37");
    expect(verseCap.ok).toBe(false);
    if (!verseCap.ok) {
      expect(verseCap.error.message).toBe("John 3 has 36 verses.");
    }

    const chapterCap = tryParseAnyPassage("Jude 2");
    expect(chapterCap.ok).toBe(false);
    if (!chapterCap.ok) {
      expect(chapterCap.error.message).toBe("Jude has 1 chapter.");
    }
  });

  it("supports multiple-output overload", () => {
    const result = tryParseAnyPassage("Read John 3:16 and Romans 8:28.", { multiple: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((item) => item.canonical)).toEqual(["JHN.3.16", "ROM.8.28"]);
    }
  });

  it("keeps parser errors when multiple-output overload finds no valid passages", () => {
    const result = tryParseAnyPassage("John 3:16-37", { multiple: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("John 3 has 36 verses.");
    }
  });
});
