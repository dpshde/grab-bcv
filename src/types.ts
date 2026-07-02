import type { OsisBookCode } from "./books";

export type PassagePart = {
  book: OsisBookCode;
  chapter: number;
  verse?: number;
};

export type PassageRangeType = "single" | "chapter" | "same_chapter" | "chapter_range" | "cross_reference";

export type ParsedPassage = {
  input: string;
  canonical: string;
  start: PassagePart;
  end: PassagePart;
  rangeType: PassageRangeType;
};

export type PassageErrorCode =
  | "EMPTY"
  | "INVALID_FORMAT"
  | "INVALID_BOOK"
  | "INVALID_NUMBER"
  | "REVERSED_RANGE";

export type PassageCapErrorDetails =
  | {
      kind: "chapter_cap";
      book: OsisBookCode;
      bookName: string;
      maxChapter: number;
      attemptedChapter: number;
    }
  | {
      kind: "verse_cap";
      book: OsisBookCode;
      bookName: string;
      chapter: number;
      maxVerse: number;
      attemptedVerse: number;
    };

export class PassageParseError extends Error {
  readonly code: PassageErrorCode;
  readonly details?: PassageCapErrorDetails;

  constructor(code: PassageErrorCode, message: string, details?: PassageCapErrorDetails) {
    super(message);
    this.name = "PassageParseError";
    this.code = code;
    this.details = details;
  }
}
