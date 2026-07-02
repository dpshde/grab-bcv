import { describe, expect, it } from "vitest";
import { getChapterCount, getMaxChapter, getMaxVerse, getVerseCount } from "../src/index";

describe("book count helpers", () => {
  it("returns chapter counts for books", () => {
    expect(getChapterCount("JHN")).toBe(21);
    expect(getChapterCount("PHM")).toBe(1);
  });

  it("returns verse counts for chapters", () => {
    expect(getVerseCount("JHN", 3)).toBe(36);
    expect(getVerseCount("PSA", 119)).toBe(176);
  });

  it("returns null for invalid verse-count chapter input", () => {
    expect(getVerseCount("JHN", 0)).toBeNull();
    expect(getVerseCount("JHN", -1)).toBeNull();
    expect(getVerseCount("JHN", 999)).toBeNull();
  });

  it("stays compatible with getMax aliases", () => {
    expect(getMaxChapter("ROM")).toBe(getChapterCount("ROM"));
    expect(getMaxVerse("ROM", 8)).toBe(getVerseCount("ROM", 8));
  });
});
