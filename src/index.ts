export {
  OSIS_BOOK_CODES,
  OSIS_BOOK_CODE_SET,
  OSIS_BOOK_ORDER,
  OSIS_BOOK_NAMES,
  BOOK_CHAPTER_COUNTS,
  BOOK_VERSE_COUNTS,
  BOOK_ALIAS_TO_OSIS,
  getChapterCount,
  getVerseCount,
  getMaxChapter,
  getMaxVerse,
  getBookOrder,
  isOsisBookCode,
  resolveBookAlias
} from "./books";
export type { OsisBookCode } from "./books";

export { parsePassage, tryParsePassage } from "./parser";
export type {
  ParsedPassage,
  PassagePart,
  PassageRangeType,
  PassageErrorCode,
  PassageCapErrorDetails,
} from "./types";
export { PassageParseError } from "./types";
export { formatPassageForDisplay } from "./format";

export { ALLOWED_QUERY_KEYS, normalizeResolverQuery, parseResolverQuery, serializeResolverQuery, toQueryString } from "./query";
export type { ResolverQuery, ResolverMode } from "./query";

export {
  toCanonicalRef,
  toDisplayRef,
  toResolverPath,
  toResolverUrl,
  parseToCanonicalRef,
  parseToDisplayRef,
  parseToResolverPath,
  parseToResolverUrl
} from "./helpers";
export type { ResolverPathOptions, ResolverUrlOptions } from "./helpers";

export {
  extractSharedCanonical,
  normalizeSharedPassage,
  normalizeAnyPassage,
  parseSharedPassage,
  tryParseSharedPassage,
  parseAnyPassage,
  findAnyPassage,
  tryParseAnyPassage
} from "./share";
export type {
  SharePayload,
  AnyPassageParseOptions,
  NormalizePassageOptions,
  NormalizedPassage,
  NormalizedPassageSourceKind
} from "./share";

export { autocompletePassage } from "./autocomplete";
export type { AutocompletePassageOptions, AutocompletePassageSuggestion, AutocompleteSuggestionKind } from "./autocomplete";

// Verse context expansion (paragraph-aware)
export {
  getVerseContext,
  expandContext,
  formatContext,
  createParagraphStyles,
} from "./verse-context-expansion";
export type {
  VerseRef,
  ContextSelection,
  ParagraphStyle,
  VerseWithPara,
  ContextOptions,
} from "./verse-context-expansion";

// Paragraph data (client-side, zero network calls)
export { getParagraphData, hasParagraphData } from "./para-data";
export type { ParagraphEntry } from "./para-data";
