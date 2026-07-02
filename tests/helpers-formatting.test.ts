import { describe, expect, it } from "vitest";
import {
  normalizeResolverQuery,
  parseToCanonicalRef,
  parseToDisplayRef,
  parseToResolverPath,
  parseToResolverUrl,
  parsePassage,
  parseResolverQuery,
  serializeResolverQuery,
  toCanonicalRef,
  toDisplayRef,
  toQueryString,
  toResolverPath,
  toResolverUrl
} from "../src/index";

describe("reference helpers", () => {
  it("formats canonical references from raw input", () => {
    expect(parseToCanonicalRef("John 3:16")).toBe("JHN.3.16");
  });

  it("formats display references from raw input", () => {
    expect(parseToDisplayRef("JHN.3.16-18")).toBe("John 3:16-18");
  });

  it("builds resolver path from raw input", () => {
    expect(parseToResolverPath("John 3:16")).toBe("/jhn.3.16");
    expect(parseToResolverPath("John 3:16", { suffix: "web" })).toBe("/jhn.3.16/web");
  });

  it("builds resolver URL from raw input", () => {
    expect(
      parseToResolverUrl("https://route.bible", "John 3:16", {
        query: { translation: "esv", mode: "web" }
      })
    ).toBe("https://route.bible/jhn.3.16?translation=ESV&mode=web");
  });

  it("accepts parsed-passage input for pure helpers", () => {
    const parsed = parsePassage("Romans 8:28");
    expect(toCanonicalRef(parsed)).toBe("ROM.8.28");
    expect(toDisplayRef(parsed)).toBe("Romans 8:28");
    expect(toResolverPath(parsed)).toBe("/rom.8.28");
    expect(toResolverUrl("https://route.bible", parsed)).toBe("https://route.bible/rom.8.28");
  });
});

describe("resolver query helpers", () => {
  it("normalizes and serializes supported query params", () => {
    const params = new URLSearchParams({
      translation: "esv",
      mode: "web",
      app: "logos",
      src: "share",
      lang: "en",
      ignored: "true"
    });

    const normalized = parseResolverQuery(params);
    expect(normalized).toEqual({
      translation: "ESV",
      mode: "web",
      app: "logos",
      src: "share",
      lang: "en"
    });

    expect(normalizeResolverQuery(params)).toEqual(normalized);
    expect(serializeResolverQuery(normalized)).toBe("?translation=ESV&lang=en&app=logos&src=share&mode=web");
    expect(toQueryString(normalized)).toBe("?translation=ESV&lang=en&app=logos&src=share&mode=web");
  });

  it("normalizes direct query objects", () => {
    expect(toQueryString({ translation: "esv", mode: "web" })).toBe("?translation=ESV&mode=web");
  });

  it("omits auto mode and empty values", () => {
    expect(toQueryString({ mode: "auto", translation: "KJV" })).toBe("?translation=KJV");
    expect(toQueryString({})).toBe("");
  });
});
