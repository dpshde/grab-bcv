import {
  BOOK_ALIAS_TO_OSIS,
  OSIS_BOOK_NAMES,
  resolveBookAlias,
  getMaxChapter,
  getMaxVerse,
  getBookOrder,
  isOsisBookCode
} from "./books";
import type { OsisBookCode } from "./books";
import type { ParsedPassage, PassageCapErrorDetails, PassagePart } from "./types";
import { PassageParseError } from "./types";
import { normalizePassageIntakeText } from "./normalize-intake";

const FULL_REFERENCE_REGEX = /^([1-3]?[A-Z]{2,})\.(\d+)\.(\d+)$/;
const CHAPTER_REFERENCE_REGEX = /^([1-3]?[A-Z]{2,})\.(\d+)$/;
const PASSAGE_FORMAT_ERROR_MESSAGE =
  "Use references like JHN.3, JHN.3.16, John 3:16-18, or JHN.3.16-JHN.4.2.";

function normalizeToken(input: string): string {
  return normalizePassageIntakeText(input)
    .trim()
    .replace(/\s+/g, "")
    .replace(/:/g, ".")
    .replace(/\.\.+/g, ".")
    .toUpperCase();
}

function normalizeNaturalToken(input: string): string {
  return normalizePassageIntakeText(input)
    .trim()
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ");
}

function toPositiveIntegerOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function toPositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new PassageParseError("INVALID_NUMBER", "Chapter and verse must be positive integers.");
  }

  return parsed;
}

function hasVerse(part: PassagePart): part is PassagePart & { verse: number } {
  return typeof part.verse === "number" && Number.isFinite(part.verse);
}

function formatPart(part: PassagePart): string {
  return hasVerse(part) ? `${part.book}.${part.chapter}.${part.verse}` : `${part.book}.${part.chapter}`;
}

function formatBookName(book: OsisBookCode): string {
  return OSIS_BOOK_NAMES[book] ?? book;
}

function chapterCapMessage(book: OsisBookCode, maxChapter: number): string {
  return `${formatBookName(book)} has ${maxChapter} chapter${maxChapter === 1 ? "" : "s"}.`;
}

function verseCapMessage(book: OsisBookCode, chapter: number, maxVerse: number): string {
  return `${formatBookName(book)} ${chapter} has ${maxVerse} verse${maxVerse === 1 ? "" : "s"}.`;
}

function createChapterCapDetails(
  book: OsisBookCode,
  maxChapter: number,
  attemptedChapter: number
): PassageCapErrorDetails {
  return {
    kind: "chapter_cap",
    book,
    bookName: formatBookName(book),
    maxChapter,
    attemptedChapter
  };
}

function createVerseCapDetails(
  book: OsisBookCode,
  chapter: number,
  maxVerse: number,
  attemptedVerse: number
): PassageCapErrorDetails {
  return {
    kind: "verse_cap",
    book,
    bookName: formatBookName(book),
    chapter,
    maxVerse,
    attemptedVerse
  };
}

function toAliasKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSingleInsertionAway(shorter: string, longer: string): boolean {
  if (longer.length !== shorter.length + 1) {
    return false;
  }

  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }

    if (skipped) {
      return false;
    }

    skipped = true;
    j += 1;
  }

  return true;
}

function resolveChapterFallbackBookAlias(
  bookRaw: string,
  chapter: number,
  primaryBook: OsisBookCode
): OsisBookCode | null {
  const key = toAliasKey(bookRaw);
  if (!key || key.length < 3) {
    return null;
  }

  type Candidate = {
    book: OsisBookCode;
    lengthDelta: number;
  };

  const byBook = new Map<OsisBookCode, Candidate>();
  for (const [aliasKey, osis] of BOOK_ALIAS_TO_OSIS.entries()) {
    if (osis === primaryBook) {
      continue;
    }

    const isPrefixMatch = aliasKey.startsWith(key) || key.startsWith(aliasKey);
    const isOneEditExpandedMatch =
      aliasKey.length >= 4 &&
      isSingleInsertionAway(key, aliasKey) &&
      aliasKey.slice(0, 2) === key.slice(0, 2);

    if (!isPrefixMatch && !isOneEditExpandedMatch) {
      continue;
    }

    if (chapter > getMaxChapter(osis)) {
      continue;
    }

    const next: Candidate = {
      book: osis,
      lengthDelta: Math.abs(aliasKey.length - key.length)
    };
    const existing = byBook.get(osis);
    if (!existing || next.lengthDelta < existing.lengthDelta) {
      byBook.set(osis, next);
    }
  }

  const ranked = Array.from(byBook.values()).sort((left, right) => left.lengthDelta - right.lengthDelta);
  const best = ranked[0];
  const second = ranked[1];
  if (!best) {
    return null;
  }

  if (second && second.lengthDelta === best.lengthDelta) {
    return null;
  }

  return best.book;
}

function parseReferenceToken(token: string): PassagePart {
  const fullMatch = token.match(FULL_REFERENCE_REGEX);
  if (fullMatch) {
    const rawBook = fullMatch[1];
    const chapterText = fullMatch[2];
    const verseText = fullMatch[3];
    if (!rawBook || !chapterText || !verseText) {
      throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
    }

    const book = rawBook.toUpperCase();
    if (!isOsisBookCode(book)) {
      throw new PassageParseError("INVALID_BOOK", `Unknown book code: ${rawBook}.`);
    }

    const chapter = toPositiveInteger(chapterText);
    const maxChapter = getMaxChapter(book);
    if (chapter > maxChapter) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        chapterCapMessage(book, maxChapter),
        createChapterCapDetails(book, maxChapter, chapter)
      );
    }

    const verse = toPositiveInteger(verseText);
    const maxVerse = getMaxVerse(book, chapter);
    if (maxVerse !== null && verse > maxVerse) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        verseCapMessage(book, chapter, maxVerse),
        createVerseCapDetails(book, chapter, maxVerse, verse)
      );
    }

    return {
      book,
      chapter,
      verse
    };
  }

  const chapterMatch = token.match(CHAPTER_REFERENCE_REGEX);
  if (chapterMatch) {
    const rawBook = chapterMatch[1];
    const chapterText = chapterMatch[2];
    if (!rawBook || !chapterText) {
      throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
    }

    const book = rawBook.toUpperCase();
    if (!isOsisBookCode(book)) {
      throw new PassageParseError("INVALID_BOOK", `Unknown book code: ${rawBook}.`);
    }

    const chapter = toPositiveInteger(chapterText);
    const maxChapter = getMaxChapter(book);
    if (chapter > maxChapter) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        chapterCapMessage(book, maxChapter),
        createChapterCapDetails(book, maxChapter, chapter)
      );
    }

    return {
      book,
      chapter
    };
  }

  throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
}

function createNaturalPassagePart(bookRaw: string, chapterRaw: string, verseRaw?: string): PassagePart | null {
  const primaryBook = resolveBookAlias(bookRaw);
  if (!primaryBook) {
    return null;
  }

  const chapter = toPositiveIntegerOrNull(chapterRaw);
  if (!chapter) {
    return null;
  }

  let book = primaryBook;
  const maxChapter = getMaxChapter(book);
  if (chapter > maxChapter) {
    const fallback = resolveChapterFallbackBookAlias(bookRaw, chapter, primaryBook);
    if (!fallback) {
      throw new PassageParseError(
        "INVALID_FORMAT",
        chapterCapMessage(book, maxChapter),
        createChapterCapDetails(book, maxChapter, chapter)
      );
    }
    book = fallback;
  }

  if (!verseRaw) {
    return {
      book,
      chapter
    };
  }

  const verse = toPositiveIntegerOrNull(verseRaw);
  if (!verse) {
    return null;
  }

  const maxVerse = getMaxVerse(book, chapter);
  if (maxVerse !== null && verse > maxVerse) {
    throw new PassageParseError(
      "INVALID_FORMAT",
      verseCapMessage(book, chapter, maxVerse),
      createVerseCapDetails(book, chapter, maxVerse, verse)
    );
  }

  return {
    book,
    chapter,
    verse
  };
}

function parseNaturalReference(input: string): PassagePart | null {
  const normalized = normalizeNaturalToken(input);
  if (!normalized) {
    return null;
  }

  const osisLikeVerse = normalized.match(/^(.+?)\s*[.]\s*(\d+)\s*[.]\s*(\d+)$/i);
  if (osisLikeVerse) {
    const bookRaw = osisLikeVerse[1];
    const chapterRaw = osisLikeVerse[2];
    const verseRaw = osisLikeVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }

  const pathLikeVerse = normalized.match(/^(.+?)\s*\/\s*(\d+)\s*[/:.]\s*(\d+)$/i);
  if (pathLikeVerse) {
    const bookRaw = pathLikeVerse[1];
    const chapterRaw = pathLikeVerse[2];
    const verseRaw = pathLikeVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }

  const chapterVerse = normalized.match(/^(.+?)\s*(\d+)\s*[:.]\s*(\d+)$/i);
  if (chapterVerse) {
    const bookRaw = chapterVerse[1];
    const chapterRaw = chapterVerse[2];
    const verseRaw = chapterVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }

  const spaceSeparatedVerse = normalized.match(/^(.+?)\s+(\d+)\s+(\d+)$/i);
  if (spaceSeparatedVerse) {
    const bookRaw = spaceSeparatedVerse[1];
    const chapterRaw = spaceSeparatedVerse[2];
    const verseRaw = spaceSeparatedVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }

  const compactVerse = normalized.match(/^([1-3]?[a-zA-Z]+)(\d+)[:.](\d+)$/i);
  if (compactVerse) {
    const bookRaw = compactVerse[1];
    const chapterRaw = compactVerse[2];
    const verseRaw = compactVerse[3];
    if (bookRaw && chapterRaw && verseRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw, verseRaw);
    }
  }

  const compactChapter = normalized.match(/^([1-3]?[a-zA-Z]+)(\d+)$/i);
  if (compactChapter) {
    const bookRaw = compactChapter[1];
    const chapterRaw = compactChapter[2];
    if (bookRaw && chapterRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw);
    }
  }

  const dottedOrPathChapter = normalized.match(/^(.+?)\s*[./]\s*(\d+)$/i);
  if (dottedOrPathChapter) {
    const bookRaw = dottedOrPathChapter[1];
    const chapterRaw = dottedOrPathChapter[2];
    if (bookRaw && chapterRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw);
    }
  }

  const chapterOnly = normalized.match(/^(.+?)\s+(\d+)$/i);
  if (chapterOnly) {
    const bookRaw = chapterOnly[1];
    const chapterRaw = chapterOnly[2];
    if (bookRaw && chapterRaw) {
      return createNaturalPassagePart(bookRaw, chapterRaw);
    }
  }

  return null;
}

function normalizeNaturalPassage(input: string): string | null {
  const normalized = normalizeNaturalToken(input);
  if (!normalized) {
    return null;
  }

  const pieces = normalized.split(/\s*-\s*/);
  if (pieces.length === 2) {
    const leftRaw = pieces[0];
    const rightRaw = pieces[1];
    if (!leftRaw || !rightRaw) {
      return null;
    }

    const left = parseNaturalReference(leftRaw);
    if (!left) {
      return null;
    }

    const rightDigitsOnly = rightRaw.match(/^\d+$/);
    if (rightDigitsOnly) {
      if (hasVerse(left)) {
        return `${left.book}.${left.chapter}.${left.verse}-${rightRaw}`;
      }

      return `${left.book}.${left.chapter}-${rightRaw}`;
    }

    const rightChapterVerse = rightRaw.match(/^(\d+)\s*[:.]\s*(\d+)$/);
    if (rightChapterVerse) {
      const rightChapterRaw = rightChapterVerse[1];
      const rightVerseRaw = rightChapterVerse[2];
      if (!rightChapterRaw || !rightVerseRaw) {
        return null;
      }

      const right = parseReferenceToken(`${left.book}.${rightChapterRaw}.${rightVerseRaw}`);
      if (left.book === right.book && hasVerse(left) && hasVerse(right) && left.chapter === right.chapter) {
        return `${left.book}.${left.chapter}.${left.verse}-${right.verse}`;
      }

      return `${formatPart(left)}-${formatPart(right)}`;
    }

    const right = parseNaturalReference(rightRaw);
    if (!right) {
      return null;
    }

    if (left.book === right.book && hasVerse(left) && hasVerse(right) && left.chapter === right.chapter) {
      return `${left.book}.${left.chapter}.${left.verse}-${right.verse}`;
    }

    if (left.book === right.book && !hasVerse(left) && !hasVerse(right)) {
      return `${left.book}.${left.chapter}-${right.chapter}`;
    }

    return `${formatPart(left)}-${formatPart(right)}`;
  }

  if (pieces.length !== 1) {
    return null;
  }

  const singleRaw = pieces[0];
  if (!singleRaw) {
    return null;
  }

  const single = parseNaturalReference(singleRaw);
  if (!single) {
    return null;
  }

  return formatPart(single);
}

function normalizePassageInput(input: string): string {
  const naturalNormalized = normalizeNaturalPassage(input);
  if (naturalNormalized) {
    return normalizeToken(naturalNormalized);
  }

  return normalizeToken(input);
}

function compareForRange(start: PassagePart, end: PassagePart): number {
  const startBookOrder = getBookOrder(start.book);
  const endBookOrder = getBookOrder(end.book);
  if (startBookOrder === undefined || endBookOrder === undefined) {
    return 0;
  }

  if (startBookOrder !== endBookOrder) {
    return startBookOrder - endBookOrder;
  }

  if (start.chapter !== end.chapter) {
    return start.chapter - end.chapter;
  }

  const startVerse = hasVerse(start) ? start.verse : 0;
  const endVerse = hasVerse(end) ? end.verse : Number.MAX_SAFE_INTEGER;
  return startVerse - endVerse;
}

function canonicalize(start: PassagePart, end: PassagePart): { canonical: string; rangeType: ParsedPassage["rangeType"] } {
  const sameBook = start.book === end.book;
  const sameChapter = sameBook && start.chapter === end.chapter;
  const startHasVerse = hasVerse(start);
  const endHasVerse = hasVerse(end);

  if (sameChapter && startHasVerse && endHasVerse && start.verse === end.verse) {
    return {
      canonical: `${start.book}.${start.chapter}.${start.verse}`,
      rangeType: "single"
    };
  }

  if (sameChapter && !startHasVerse && !endHasVerse) {
    return {
      canonical: `${start.book}.${start.chapter}`,
      rangeType: "chapter"
    };
  }

  if (sameChapter && startHasVerse && endHasVerse) {
    return {
      canonical: `${start.book}.${start.chapter}.${start.verse}-${end.verse}`,
      rangeType: "same_chapter"
    };
  }

  if (sameBook && !startHasVerse && !endHasVerse) {
    return {
      canonical: `${start.book}.${start.chapter}-${end.chapter}`,
      rangeType: "chapter_range"
    };
  }

  return {
    canonical: `${formatPart(start)}-${formatPart(end)}`,
    rangeType: "cross_reference"
  };
}

export function parsePassage(input: string): ParsedPassage {
  if (!input?.trim()) {
    throw new PassageParseError("EMPTY", "Passage is required.");
  }

  const normalized = normalizePassageInput(input);
  if (!normalized) {
    throw new PassageParseError("EMPTY", "Passage is required.");
  }

  const pieces = normalized.split("-");
  if (pieces.length > 2 || pieces.some((piece) => piece.length === 0)) {
    throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
  }

  const startToken = pieces[0];
  if (!startToken) {
    throw new PassageParseError("INVALID_FORMAT", PASSAGE_FORMAT_ERROR_MESSAGE);
  }

  const start = parseReferenceToken(startToken);
  const endToken = pieces[1];

  let end: PassagePart;
  if (!endToken) {
    end = start;
  } else if (/^\d+$/.test(endToken)) {
    if (hasVerse(start)) {
      const endVerse = toPositiveInteger(endToken);
      const maxVerse = getMaxVerse(start.book, start.chapter);
      if (maxVerse !== null && endVerse > maxVerse) {
        throw new PassageParseError(
          "INVALID_FORMAT",
          verseCapMessage(start.book, start.chapter, maxVerse),
          createVerseCapDetails(start.book, start.chapter, maxVerse, endVerse)
        );
      }
      end = {
        book: start.book,
        chapter: start.chapter,
        verse: endVerse
      };
    } else {
      const endChapter = toPositiveInteger(endToken);
      const maxChapter = getMaxChapter(start.book);
      if (endChapter > maxChapter) {
        throw new PassageParseError(
          "INVALID_FORMAT",
          chapterCapMessage(start.book, maxChapter),
          createChapterCapDetails(start.book, maxChapter, endChapter)
        );
      }
      end = {
        book: start.book,
        chapter: endChapter
      };
    }
  } else {
    end = parseReferenceToken(endToken);
  }

  if (compareForRange(start, end) > 0) {
    throw new PassageParseError("REVERSED_RANGE", "Passage range end must be greater than or equal to start.");
  }

  const { canonical, rangeType } = canonicalize(start, end);

  return {
    input,
    canonical,
    start,
    end,
    rangeType
  };
}

export function tryParsePassage(input: string): { ok: true; value: ParsedPassage } | { ok: false; error: PassageParseError } {
  try {
    return { ok: true, value: parsePassage(input) };
  } catch (error) {
    if (error instanceof PassageParseError) {
      return { ok: false, error };
    }

    return {
      ok: false,
      error: new PassageParseError("INVALID_FORMAT", "Unable to parse passage.")
    };
  }
}
