import { describe, expect, it } from "vitest";
import { autocompletePassage } from "../src/index";

describe("autocompletePassage", () => {
  it("suggests books for partial book input", () => {
    const suggestions = autocompletePassage("jo", { limit: 6 });
    const labels = suggestions.map((suggestion) => suggestion.label);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((suggestion) => suggestion.kind === "book")).toBe(true);
    expect(labels).toContain("John");
    expect(labels).toContain("Jonah");
    expect(labels).toContain("Joel");
    expect(labels).toContain("Joshua");
  });

  it("suggests a chapter reference for complete book + chapter input", () => {
    const suggestions = autocompletePassage("john 3");
    expect(suggestions).toEqual([
      {
        label: "John 3",
        insertText: "John 3",
        canonical: "JHN.3",
        kind: "chapter"
      }
    ]);
  });

  it("suggests first verses when user types a chapter and colon", () => {
    const suggestions = autocompletePassage("john 3:", { limit: 3 });
    expect(suggestions).toEqual([
      {
        label: "John 3:1",
        insertText: "John 3:1",
        canonical: "JHN.3.1",
        kind: "verse"
      },
      {
        label: "John 3:2",
        insertText: "John 3:2",
        canonical: "JHN.3.2",
        kind: "verse"
      },
      {
        label: "John 3:3",
        insertText: "John 3:3",
        canonical: "JHN.3.3",
        kind: "verse"
      }
    ]);
  });

  it("filters verses by prefix", () => {
    const suggestions = autocompletePassage("john 3:1", { limit: 3 });
    expect(suggestions).toEqual([
      {
        label: "John 3:1",
        insertText: "John 3:1",
        canonical: "JHN.3.1",
        kind: "verse"
      },
      {
        label: "John 3:10",
        insertText: "John 3:10",
        canonical: "JHN.3.10",
        kind: "verse"
      },
      {
        label: "John 3:11",
        insertText: "John 3:11",
        canonical: "JHN.3.11",
        kind: "verse"
      }
    ]);
  });

  it("suggests same-chapter range completions", () => {
    const suggestions = autocompletePassage("john 3:16-", { limit: 3 });
    expect(suggestions).toEqual([
      {
        label: "John 3:16-17",
        insertText: "John 3:16-17",
        canonical: "JHN.3.16-17",
        kind: "range"
      },
      {
        label: "John 3:16-18",
        insertText: "John 3:16-18",
        canonical: "JHN.3.16-18",
        kind: "range"
      },
      {
        label: "John 3:16-19",
        insertText: "John 3:16-19",
        canonical: "JHN.3.16-19",
        kind: "range"
      }
    ]);
  });

  it("supports numbered aliases in natural form", () => {
    const suggestions = autocompletePassage("second cor 5:", { limit: 2 });
    expect(suggestions).toEqual([
      {
        label: "2 Corinthians 5:1",
        insertText: "2 Corinthians 5:1",
        canonical: "2CO.5.1",
        kind: "verse"
      },
      {
        label: "2 Corinthians 5:2",
        insertText: "2 Corinthians 5:2",
        canonical: "2CO.5.2",
        kind: "verse"
      }
    ]);
  });

  it("returns no suggestions for invalid chapters", () => {
    expect(autocompletePassage("phm 2")).toEqual([]);
    expect(autocompletePassage("john 22")).toEqual([]);
  });
});
