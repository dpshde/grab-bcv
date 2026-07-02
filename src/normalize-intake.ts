const INVISIBLE_FORMATTING_REGEX = /[\u061C\u200B-\u200D\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const FULL_WIDTH_PUNCTUATION_REGEX = /[：．／]/g;
const DASH_VARIANT_REGEX = /[‐‑‒–—―−﹘﹣－]/g;

function normalizeFullWidthPunctuation(value: string): string {
  return value.replace(FULL_WIDTH_PUNCTUATION_REGEX, (character) => {
    switch (character) {
      case "：":
        return ":";
      case "．":
        return ".";
      case "／":
        return "/";
      default:
        return character;
    }
  });
}

export function normalizePassageIntakeText(input: string): string {
  return normalizeFullWidthPunctuation(input.normalize("NFKC"))
    .replace(INVISIBLE_FORMATTING_REGEX, "")
    .replace(DASH_VARIANT_REGEX, "-");
}
