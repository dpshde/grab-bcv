import {
  BOOK_ALIAS_TO_OSIS,
  OSIS_BOOK_CODES,
  OSIS_BOOK_NAMES,
  getChapterCount,
  getVerseCount,
  resolveBookAlias,
  type OsisBookCode
} from "./books";

export type AutocompleteSuggestionKind = "book" | "chapter" | "verse" | "range";

export type AutocompletePassageSuggestion = {
  label: string;
  insertText: string;
  canonical: string;
  kind: AutocompleteSuggestionKind;
};

export type AutocompletePassageOptions = {
  limit?: number;
};

type BookChapterContext = {
  book: OsisBookCode;
  chapter: number;
};

type VerseContext = BookChapterContext & {
  versePrefix: string;
};

type RangeContext = BookChapterContext & {
  startVerse: number;
  endPrefix: string;
};

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

const BOOK_NAME_KEYS: Readonly<Record<OsisBookCode, string>> = Object.freeze(
  Object.fromEntries(OSIS_BOOK_CODES.map((book) => [book, toLookupKey(OSIS_BOOK_NAMES[book] ?? book)])) as Record<
    OsisBookCode,
    string
  >
);

const BOOK_ALIAS_KEYS_BY_BOOK: ReadonlyMap<OsisBookCode, readonly string[]> = (() => {
  const buckets = new Map<OsisBookCode, Set<string>>();
  for (const [alias, book] of BOOK_ALIAS_TO_OSIS.entries()) {
    const existing = buckets.get(book);
    if (existing) {
      existing.add(alias);
      continue;
    }

    buckets.set(book, new Set([alias]));
  }

  return new Map(
    OSIS_BOOK_CODES.map((book) => {
      const aliases = buckets.get(book);
      return [book, Object.freeze([...(aliases ?? [])])];
    })
  );
})();

function toLookupKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ");
}

function toPositiveIntegerOrNull(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  const rounded = Math.floor(limit);
  if (rounded <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(rounded, MAX_LIMIT);
}

function parseBookChapter(bookRaw: string, chapterRaw: string): BookChapterContext | null {
  const book = resolveBookAlias(bookRaw);
  if (!book) {
    return null;
  }

  const chapter = toPositiveIntegerOrNull(chapterRaw);
  if (!chapter) {
    return null;
  }

  if (chapter > getChapterCount(book)) {
    return null;
  }

  return { book, chapter };
}

function parseVerseContext(input: string): VerseContext | null {
  const patterns = [
    /^(.+?)\s+(\d+)\s*[:.]\s*(\d*)$/i,
    /^(.+?)\s*[./]\s*(\d+)\s*[:.]\s*(\d*)$/i,
    /^([1-3]?[a-zA-Z]+)(\d+)\s*[:.]\s*(\d*)$/i
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match) {
      continue;
    }

    const bookRaw = match[1];
    const chapterRaw = match[2];
    const versePrefix = match[3];
    if (typeof bookRaw !== "string" || typeof chapterRaw !== "string" || typeof versePrefix !== "string") {
      continue;
    }

    const parsed = parseBookChapter(bookRaw, chapterRaw);
    if (!parsed) {
      continue;
    }

    return {
      ...parsed,
      versePrefix
    };
  }

  return null;
}

function parseRangeContext(input: string): RangeContext | null {
  const rangeMatch = input.match(/^(.*?)-\s*(\d*)$/);
  if (!rangeMatch) {
    return null;
  }

  const leftRaw = rangeMatch[1]?.trim();
  const endPrefix = rangeMatch[2] ?? "";
  if (!leftRaw) {
    return null;
  }

  const left = parseVerseContext(leftRaw);
  if (!left || !left.versePrefix) {
    return null;
  }

  const startVerse = toPositiveIntegerOrNull(left.versePrefix);
  if (!startVerse) {
    return null;
  }

  const maxVerse = getVerseCount(left.book, left.chapter);
  if (maxVerse === null || startVerse > maxVerse) {
    return null;
  }

  if (endPrefix && toPositiveIntegerOrNull(endPrefix) === null) {
    return null;
  }

  return {
    book: left.book,
    chapter: left.chapter,
    startVerse,
    endPrefix
  };
}

function parseChapterContext(input: string): BookChapterContext | null {
  const patterns = [/^(.+?)\s*[./]\s*(\d+)$/i, /^(.+?)\s+(\d+)$/i, /^([1-3]?[a-zA-Z]+)(\d+)$/i];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match) {
      continue;
    }

    const bookRaw = match[1];
    const chapterRaw = match[2];
    if (typeof bookRaw !== "string" || typeof chapterRaw !== "string") {
      continue;
    }

    const parsed = parseBookChapter(bookRaw, chapterRaw);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function makeSuggestion(
  kind: AutocompleteSuggestionKind,
  canonical: string,
  label: string
): AutocompletePassageSuggestion {
  return {
    kind,
    canonical,
    label,
    insertText: label
  };
}

function suggestBooks(input: string, limit: number): AutocompletePassageSuggestion[] {
  const key = toLookupKey(input);
  if (!key) {
    return [];
  }

  type Candidate = {
    book: OsisBookCode;
    score: number;
    shortestMatchLength: number;
    display: string;
  };

  const candidates: Candidate[] = [];
  for (const book of OSIS_BOOK_CODES) {
    const display = OSIS_BOOK_NAMES[book] ?? book;
    const nameKey = BOOK_NAME_KEYS[book];
    const aliasKeys = BOOK_ALIAS_KEYS_BY_BOOK.get(book) ?? [];

    let score = Number.POSITIVE_INFINITY;
    let shortestMatchLength = Number.POSITIVE_INFINITY;

    if (nameKey === key) {
      score = 0;
      shortestMatchLength = nameKey.length;
    } else if (nameKey.startsWith(key)) {
      score = 1;
      shortestMatchLength = nameKey.length;
    } else {
      for (const aliasKey of aliasKeys) {
        if (!aliasKey.startsWith(key)) {
          continue;
        }

        score = 2;
        if (aliasKey.length < shortestMatchLength) {
          shortestMatchLength = aliasKey.length;
        }
      }
    }

    if (!Number.isFinite(score)) {
      continue;
    }

    candidates.push({ book, score, shortestMatchLength, display });
  }

  candidates.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    if (left.shortestMatchLength !== right.shortestMatchLength) {
      return left.shortestMatchLength - right.shortestMatchLength;
    }

    return left.display.localeCompare(right.display);
  });

  return candidates.slice(0, limit).map((candidate) => makeSuggestion("book", candidate.book, candidate.display));
}

function suggestChapter(context: BookChapterContext): AutocompletePassageSuggestion[] {
  const name = OSIS_BOOK_NAMES[context.book] ?? context.book;
  const display = `${name} ${context.chapter}`;
  return [makeSuggestion("chapter", `${context.book}.${context.chapter}`, display)];
}

function suggestVerses(context: VerseContext, limit: number): AutocompletePassageSuggestion[] {
  const maxVerse = getVerseCount(context.book, context.chapter);
  if (maxVerse === null) {
    return [];
  }

  const name = OSIS_BOOK_NAMES[context.book] ?? context.book;
  const suggestions: AutocompletePassageSuggestion[] = [];

  for (let verse = 1; verse <= maxVerse; verse += 1) {
    const verseText = String(verse);
    if (context.versePrefix && !verseText.startsWith(context.versePrefix)) {
      continue;
    }

    const display = `${name} ${context.chapter}:${verseText}`;
    suggestions.push(makeSuggestion("verse", `${context.book}.${context.chapter}.${verseText}`, display));

    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}

function suggestRanges(context: RangeContext, limit: number): AutocompletePassageSuggestion[] {
  const maxVerse = getVerseCount(context.book, context.chapter);
  if (maxVerse === null) {
    return [];
  }

  const name = OSIS_BOOK_NAMES[context.book] ?? context.book;
  const minEnd = context.startVerse + 1;
  const suggestions: AutocompletePassageSuggestion[] = [];

  for (let verse = minEnd; verse <= maxVerse; verse += 1) {
    const verseText = String(verse);
    if (context.endPrefix && !verseText.startsWith(context.endPrefix)) {
      continue;
    }

    const display = `${name} ${context.chapter}:${context.startVerse}-${verseText}`;
    suggestions.push(makeSuggestion("range", `${context.book}.${context.chapter}.${context.startVerse}-${verseText}`, display));

    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}

export function autocompletePassage(
  input: string,
  options: AutocompletePassageOptions = {}
): AutocompletePassageSuggestion[] {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return [];
  }

  const limit = clampLimit(options.limit);

  const rangeContext = parseRangeContext(normalized);
  if (rangeContext) {
    return suggestRanges(rangeContext, limit);
  }

  const verseContext = parseVerseContext(normalized);
  if (verseContext) {
    return suggestVerses(verseContext, limit);
  }

  const chapterContext = parseChapterContext(normalized);
  if (chapterContext) {
    return suggestChapter(chapterContext);
  }

  return suggestBooks(normalized, limit);
}
