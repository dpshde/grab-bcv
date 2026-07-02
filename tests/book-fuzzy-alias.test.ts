import { describe, expect, it } from "vitest";
import { parsePassage, resolveBookAlias } from "../src/index";

describe("fuzzy book alias resolution", () => {
  it("resolves common misspellings for full book names", () => {
    expect(resolveBookAlias("genessis")).toBe("GEN");
    expect(resolveBookAlias("revelaiton")).toBe("REV");
  });

  it("supports misspelled numbered book names", () => {
    expect(parsePassage("Second Corintians 5:17").canonical).toBe("2CO.5.17");
  });

  it("falls back to a chapter-valid alias when shorthand overflows", () => {
    expect(parsePassage("jon 12").canonical).toBe("JHN.12");
    expect(parsePassage("jon 2").canonical).toBe("JON.2");
  });

  it("does not resolve short ambiguous aliases", () => {
    expect(resolveBookAlias("jo")).toBeNull();
  });

  it("does not map unrelated words", () => {
    expect(resolveBookAlias("kangaroo")).toBeNull();
  });
});
