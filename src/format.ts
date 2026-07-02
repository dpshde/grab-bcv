import { OSIS_BOOK_NAMES } from "./books";
import type { ParsedPassage, PassagePart } from "./types";

function hasVerse(part: PassagePart): part is PassagePart & { verse: number } {
  return typeof part.verse === "number" && Number.isFinite(part.verse);
}

function formatPart(part: PassagePart, includeBook: boolean): string {
  const bookName = OSIS_BOOK_NAMES[part.book] ?? part.book;
  const chapterVerse = hasVerse(part) ? `${part.chapter}:${part.verse}` : `${part.chapter}`;
  return includeBook ? `${bookName} ${chapterVerse}` : chapterVerse;
}

export function formatPassageForDisplay(parsed: ParsedPassage): string {
  const start = parsed.start;
  const end = parsed.end;

  const startHasVerse = hasVerse(start);
  const endHasVerse = hasVerse(end);
  const sameBook = start.book === end.book;
  const sameChapter = sameBook && start.chapter === end.chapter;
  const bookName = OSIS_BOOK_NAMES[start.book] ?? start.book;

  if (sameChapter && startHasVerse && endHasVerse && start.verse === end.verse) {
    return `${bookName} ${start.chapter}:${start.verse}`;
  }

  if (sameChapter && !startHasVerse && !endHasVerse) {
    return `${bookName} ${start.chapter}`;
  }

  if (sameChapter && startHasVerse && endHasVerse) {
    return `${bookName} ${start.chapter}:${start.verse}-${end.verse}`;
  }

  if (sameBook && !startHasVerse && !endHasVerse) {
    return `${bookName} ${start.chapter}-${end.chapter}`;
  }

  if (sameBook) {
    return `${bookName} ${formatPart(start, false)}-${formatPart(end, false)}`;
  }

  return `${formatPart(start, true)}-${formatPart(end, true)}`;
}
