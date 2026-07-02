import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { autocompletePassage } from "../src/autocomplete";
import { findAnyPassage } from "../src/find";
import { BOOK_ALIAS_TO_OSIS, BOOK_CHAPTER_COUNTS, parsePassage, PassageParseError } from "../src/index";
import { parseAnyPassage } from "../src/parse";

describe("public api contract", () => {
  it("does not let exported alias map mutations change parser behavior", () => {
    (BOOK_ALIAS_TO_OSIS as unknown as Map<string, string>).set("xyz", "JHN");
    expect(() => parsePassage("xyz 3:16")).toThrow(PassageParseError);
  });

  it("does not let exported chapter count mutations change parser behavior", () => {
    try {
      (BOOK_CHAPTER_COUNTS as Record<string, number>).JHN = 1;
    } catch {
      // frozen exports throw in strict mode
    }

    expect(parsePassage("John 3:16").canonical).toBe("JHN.3.16");
  });

  it("exposes additive subpath entrypoints for package exports", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"),
    ) as {
      exports?: Record<string, unknown>;
    };

    expect(packageJson.exports).toMatchObject({
      "./books": expect.any(Object),
      "./parse": expect.any(Object),
      "./find": expect.any(Object),
      "./autocomplete": expect.any(Object),
    });
  });

  it("keeps subpath entrypoints aligned with the root contract", () => {
    expect(parseAnyPassage("John 3:16").canonical).toBe("JHN.3.16");
    expect(findAnyPassage("Read Psalm 23:1 this week.")?.canonical).toBe("PSA.23.1");
    expect(autocompletePassage("john 3")[0]?.canonical).toBe("JHN.3");
  });
});
