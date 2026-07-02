import type { OsisBookCode } from "./books";
import { BOOK_VERSE_COUNTS, getMaxVerse, OSIS_BOOK_ORDER, OSIS_BOOK_NAMES } from "./books";
import type { ParsedPassage, PassagePart } from "./types";

export type VerseRef = {
  book: OsisBookCode;
  chapter: number;
  verse: number;
};

export type ContextSelection = {
  target: VerseRef;
  before: VerseRef[];
  after: VerseRef[];
  totalVerses: number;
};

export type ParagraphStyle = 
  // Standard prose paragraphs
  | "p" | "m" | "mi" | "pc" | "pmo" | "pmc" | "pmr"
  // Indented paragraphs (tab levels)
  | "pi" | "pi1" | "pi2" | "pi3"
  // Poetry (indentation levels = tab depth)
  | "q" | "q1" | "q2" | "q3" | "q4"
  // Poetry centering/speakers
  | "qc" | "qr" | "d" | "sp"
  // List items (hierarchical)
  | "li" | "li1" | "li2" | "li3" | "li4"
  // Breaks
  | "b" | "nb";

export type VerseWithPara = VerseRef & { para?: ParagraphStyle };

export type ContextOptions = {
  /** Maximum verses to include before target */
  maxBefore?: number;
  /** Maximum verses to include after target */
  maxAfter?: number;
  /** Whether to stop at chapter boundaries (default: true) */
  respectBoundaries?: boolean;
  /** Whether to detect poetry patterns and expand context (default: true) */
  detectPoetry?: boolean;
  /** Whether to allow cross-chapter context (default: false) */
  allowCrossChapter?: boolean;
  /** Maximum verses from adjacent chapters (default: 2) */
  crossChapterLimit?: number;
  /** Whether to respect paragraph boundaries (default: true) */
  respectParagraphs?: boolean;
  /** Optional paragraph style data for paragraph-aware context */
  paragraphStyles?: Map<string, ParagraphStyle>;
};

const DEFAULT_OPTIONS: Required<ContextOptions> = {
  maxBefore: 3,
  maxAfter: 3,
  respectBoundaries: true,
  detectPoetry: true,
  allowCrossChapter: false,
  crossChapterLimit: 2,
  respectParagraphs: true,
  paragraphStyles: new Map(),
};

// When paragraph data is available, use generous limits that let paragraph boundaries dominate
const PARAGRAPH_AWARE_LIMITS = { maxBefore: 10, maxAfter: 10 };

function hasVerse(part: PassagePart): part is PassagePart & { verse: number } {
  return typeof part.verse === "number" && Number.isFinite(part.verse);
}

function toVerseRef(part: PassagePart): VerseRef | null {
  if (!hasVerse(part)) {
    return null;
  }
  return {
    book: part.book,
    chapter: part.chapter,
    verse: part.verse,
  };
}

function toVerseKey(ref: VerseRef): string {
  return `${ref.book}.${ref.chapter}.${ref.verse}`;
}

function getPreviousVerse(ref: VerseRef): VerseRef | null {
  if (ref.verse > 1) {
    return { ...ref, verse: ref.verse - 1 };
  }

  if (ref.chapter > 1) {
    const prevChapter = ref.chapter - 1;
    const lastVerse = getMaxVerse(ref.book, prevChapter);
    if (lastVerse !== null) {
      return { book: ref.book, chapter: prevChapter, verse: lastVerse };
    }
  }

  const bookOrder = OSIS_BOOK_ORDER.get(ref.book);
  if (bookOrder === undefined || bookOrder <= 0) {
    return null;
  }

  const prevBookEntry = Array.from(OSIS_BOOK_ORDER.entries()).find(([, order]) => order === bookOrder - 1);
  if (!prevBookEntry) return null;

  const prevBook = prevBookEntry[0];
  const chapterCount = BOOK_VERSE_COUNTS[prevBook];
  if (!chapterCount) return null;

  const lastChapter = Math.max(...Object.keys(chapterCount).map(Number));
  const lastVerse = chapterCount[lastChapter];

  return { book: prevBook, chapter: lastChapter, verse: lastVerse ?? 1 };
}

function getNextVerse(ref: VerseRef): VerseRef | null {
  const maxVerse = getMaxVerse(ref.book, ref.chapter);
  if (maxVerse === null) return null;

  if (ref.verse < maxVerse) {
    return { ...ref, verse: ref.verse + 1 };
  }

  const chapterCount = Object.keys(BOOK_VERSE_COUNTS[ref.book] || {}).length;
  if (ref.chapter < chapterCount) {
    return { book: ref.book, chapter: ref.chapter + 1, verse: 1 };
  }

  const bookOrder = OSIS_BOOK_ORDER.get(ref.book);
  if (bookOrder === undefined) return null;

  const nextBookEntry = Array.from(OSIS_BOOK_ORDER.entries()).find(([, order]) => order === bookOrder + 1);
  if (!nextBookEntry) return null;

  return { book: nextBookEntry[0], chapter: 1, verse: 1 };
}

/**
 * Checks if a paragraph style is poetry (q1, q2, q3, q4, d, sp)
 */
function isPoetryStyle(style?: ParagraphStyle): boolean {
  if (!style) return false;
  return style.startsWith("q") || style === "d" || style === "sp";
}

/**
 * Checks if two paragraph styles are part of the same discourse unit
 * Respects indentation/tab levels within poetic sections
 */
function sameDiscourseUnit(style1?: ParagraphStyle, style2?: ParagraphStyle): boolean {
  if (!style1 || !style2) return false;
  
  // Both poetry = same unit (q/q1/q2/q3 mix within a poetic section)
  // Different indentation levels (tabs) don't break discourse
  if (isPoetryStyle(style1) && isPoetryStyle(style2)) return true;
  
  // Indented paragraphs (pi/pi1/pi2/pi3) continue together
  // Different tab levels don't break the flow
  if (isIndentedPara(style1) && isIndentedPara(style2)) return true;
  
  // Standard prose variants continue together
  // (p, m, mi, pc are all prose paragraphs)
  if (isProseStyle(style1) && isProseStyle(style2)) return true;
  
  // Same style = same unit (fallback)
  if (style1 === style2) return true;
  
  // List items continue together across levels
  if (style1.startsWith("li") && style2.startsWith("li")) return true;
  
  return false;
}

/**
 * Checks if style is an indented paragraph (pi, pi1, pi2, pi3)
 */
function isIndentedPara(style?: ParagraphStyle): boolean {
  if (!style) return false;
  return style === "pi" || style.startsWith("pi");
}

/**
 * Checks if style is standard prose (p, m, mi, pc variants)
 */
function isProseStyle(style?: ParagraphStyle): boolean {
  if (!style) return false;
  return style === "p" || style === "m" || style === "mi" || 
         style === "pc" || style === "pmo" || style === "pmc" || style === "pmr";
}

/**
 * Finds the effective paragraph style for a verse by looking backward
 * to find which paragraph it belongs to
 */
function findParagraphStyle(
  ref: VerseRef,
  paraStyles: Map<string, ParagraphStyle>,
  direction: "before" | "after"
): ParagraphStyle | undefined {
  // Check if this verse has an explicit style
  const key = toVerseKey(ref);
  const explicitStyle = paraStyles.get(key);
  if (explicitStyle) return explicitStyle;
  
  // Look backward to find paragraph start
  let current = ref;
  const maxLookback = 20; // Safety limit
  
  for (let i = 0; i < maxLookback; i++) {
    const prev = getPreviousVerse(current);
    if (!prev || prev.chapter !== ref.chapter) break;
    
    const prevKey = toVerseKey(prev);
    const prevStyle = paraStyles.get(prevKey);
    if (prevStyle) return prevStyle; // Found paragraph start
    
    current = prev;
  }
  
  return undefined;
}

/**
 * Paragraph-aware verse collection - respects USFM paragraph boundaries
 */
function collectVersesParagraphAware(
  target: VerseRef,
  count: number,
  direction: "before" | "after",
  paraStyles: Map<string, ParagraphStyle>,
  respectBoundaries: boolean,
  allowCrossChapter: boolean,
  crossChapterLimit: number
): VerseRef[] {
  const result: VerseRef[] = [];
  let current = target;
  let crossChapterCount = 0;
  
  // Find the paragraph style that governs our target verse
  const targetStyle = findParagraphStyle(target, paraStyles, "before");
  const inPoetry = isPoetryStyle(targetStyle);
  
  while (result.length < count) {
    const nextVerse = direction === "before" ? getPreviousVerse(current) : getNextVerse(current);
    if (!nextVerse) break;

    // Check chapter boundary
    if (nextVerse.chapter !== current.chapter) {
      if (respectBoundaries && !allowCrossChapter) break;
      if (allowCrossChapter && crossChapterCount >= crossChapterLimit) break;
      crossChapterCount++;
    }

    const nextKey = toVerseKey(nextVerse);
    const nextExplicitStyle = paraStyles.get(nextKey);
    
    // Check if next verse starts a new paragraph (has explicit style)
    if (nextExplicitStyle) {
      // Going forward: explicit style = new paragraph = stop
      // Going backward: explicit style = paragraph start = include it, then stop
      if (direction === "after") {
        // Next verse starts a new paragraph going forward
        if (targetStyle) {
          if (!sameDiscourseUnit(targetStyle, nextExplicitStyle)) {
            break; // Different discourse type
          }
          // Same discourse but new paragraph marker - stop for prose
          if (!isPoetryStyle(targetStyle) && !isIndentedPara(targetStyle)) {
            break;
          }
          // Poetry variants continue
        } else {
          break; // Target has no style, next starts para
        }
      } else {
        // Going backward: found paragraph start - include it then stop
        result.push(nextVerse);
        break; // Stop at paragraph start going backward
      }
    }
    
    // Also check if we're entering a completely different paragraph type
    const nextEffectiveStyle = findParagraphStyle(nextVerse, paraStyles, direction);
    if (targetStyle && nextEffectiveStyle && !sameDiscourseUnit(targetStyle, nextEffectiveStyle)) {
      break; // Hit different discourse type
    }

    result.push(nextVerse);
    current = nextVerse;
  }

  return direction === "before" ? result.reverse() : result;
}

/**
 * Fallback to count-based collection when no paragraph data
 */
function collectVersesByCount(
  target: VerseRef,
  count: number,
  direction: "before" | "after",
  respectBoundaries: boolean,
  allowCrossChapter: boolean,
  crossChapterLimit: number
): VerseRef[] {
  const result: VerseRef[] = [];
  let current = target;
  let crossChapterCount = 0;

  while (result.length < count) {
    const nextVerse = direction === "before" ? getPreviousVerse(current) : getNextVerse(current);
    if (!nextVerse) break;

    if (nextVerse.chapter !== current.chapter) {
      if (respectBoundaries && !allowCrossChapter) break;
      if (allowCrossChapter && crossChapterCount >= crossChapterLimit) break;
      crossChapterCount++;
    }

    result.push(nextVerse);
    current = nextVerse;
  }

  return direction === "before" ? result.reverse() : result;
}

/**
 * Detects passage type for default context sizing when no para data
 */
function detectPassageType(ref: VerseRef): "poetry" | "narrative" | "epistle" | "teaching" {
  const poetryBooks: OsisBookCode[] = ["PSA", "PRO", "ECC", "SNG", "LAM"];
  if (poetryBooks.includes(ref.book)) return "poetry";

  const wisdomBooks: OsisBookCode[] = ["JOB"];
  if (wisdomBooks.includes(ref.book)) return "poetry";

  const epistleBooks: OsisBookCode[] = [
    "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL",
    "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB",
    "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD"
  ];
  if (epistleBooks.includes(ref.book)) return "epistle";

  const gospels: OsisBookCode[] = ["MAT", "MRK", "LUK", "JHN"];
  if (gospels.includes(ref.book)) {
    const isTeaching = 
      (ref.book === "MAT" && ref.chapter >= 5 && ref.chapter <= 7) ||
      (ref.book === "LUK" && ref.chapter >= 6 && ref.chapter <= 7) ||
      (ref.book === "JHN" && ref.chapter >= 13 && ref.chapter <= 17);
    return isTeaching ? "teaching" : "narrative";
  }

  const narrativeBooks: OsisBookCode[] = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT",
    "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH",
    "EST", "ACT"
  ];
  if (narrativeBooks.includes(ref.book)) return "narrative";

  const propheticBooks: OsisBookCode[] = [
    "ISA", "JER", "EZK", "DAN", "HOS", "JOL", "AMO", "OBA",
    "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"
  ];
  if (propheticBooks.includes(ref.book)) return "poetry";

  if (ref.book === "REV") return "narrative";
  return "narrative";
}

function getDefaultContextSize(type: ReturnType<typeof detectPassageType>): { before: number; after: number } {
  switch (type) {
    case "poetry": return { before: 4, after: 4 };
    case "teaching": return { before: 3, after: 4 };
    case "epistle": return { before: 3, after: 3 };
    case "narrative": return { before: 2, after: 3 };
    default: return { before: 3, after: 3 };
  }
}

/**
 * Gets neighboring verse context for a parsed passage.
 * Uses paragraph formatting data when available, falls back to count-based detection.
 */
export function getVerseContext(
  passage: ParsedPassage,
  options: ContextOptions = {}
): ContextSelection | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const target = toVerseRef(passage.start);
  if (!target) return null;

  const endRef = toVerseRef(passage.end);
  const isSingleVerse = !endRef ||
    (passage.start.book === passage.end.book &&
     passage.start.chapter === passage.end.chapter &&
     passage.start.verse === passage.end.verse);

  if (!isSingleVerse) {
    return { target, before: [], after: [], totalVerses: 1 };
  }

  const hasParaData = opts.paragraphStyles && opts.paragraphStyles.size > 0;
  
  if (hasParaData && opts.respectParagraphs) {
    // Use paragraph-aware collection with generous limits
    // Paragraph boundaries are the primary stop condition
    // If user provided a number, use it; otherwise use paragraph-aware defaults
    const maxBefore = typeof opts.maxBefore === "number"
      ? opts.maxBefore 
      : PARAGRAPH_AWARE_LIMITS.maxBefore;
    const maxAfter = typeof opts.maxAfter === "number"
      ? opts.maxAfter 
      : PARAGRAPH_AWARE_LIMITS.maxAfter;
    
    const before = collectVersesParagraphAware(
      target, maxBefore, "before", opts.paragraphStyles!,
      opts.respectBoundaries, opts.allowCrossChapter, opts.crossChapterLimit
    );
    const after = collectVersesParagraphAware(
      target, maxAfter, "after", opts.paragraphStyles!,
      opts.respectBoundaries, opts.allowCrossChapter, opts.crossChapterLimit
    );
    return { target, before, after, totalVerses: 1 + before.length + after.length };
  }

  // Fall back to type-based defaults when no paragraph data
  const passageType = detectPassageType(target);
  const sizes = getDefaultContextSize(passageType);
  const maxBefore = opts.maxBefore !== DEFAULT_OPTIONS.maxBefore ? opts.maxBefore : sizes.before;
  const maxAfter = opts.maxAfter !== DEFAULT_OPTIONS.maxAfter ? opts.maxAfter : sizes.after;

  const before = collectVersesByCount(
    target, maxBefore, "before",
    opts.respectBoundaries, opts.allowCrossChapter, opts.crossChapterLimit
  );
  const after = collectVersesByCount(
    target, maxAfter, "after",
    opts.respectBoundaries, opts.allowCrossChapter, opts.crossChapterLimit
  );

  return { target, before, after, totalVerses: 1 + before.length + after.length };
}

/**
 * Alias for getVerseContext
 */
export function expandContext(
  passage: ParsedPassage,
  options?: ContextOptions
): ContextSelection | null {
  return getVerseContext(passage, options);
}

function compressVerseRanges(verses: VerseRef[]): string[] {
  if (verses.length === 0) return [];
  
  const sorted = [...verses].sort((a, b) => {
    const bookOrderA = OSIS_BOOK_ORDER.get(a.book) ?? 0;
    const bookOrderB = OSIS_BOOK_ORDER.get(b.book) ?? 0;
    if (bookOrderA !== bookOrderB) return bookOrderA - bookOrderB;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });

  const ranges: string[] = [];
  let currentStart = sorted[0]!;
  let currentEnd = sorted[0]!;

  for (let i = 1; i < sorted.length; i++) {
    const verse = sorted[i]!;
    const isConsecutive = 
      verse.book === currentEnd.book &&
      verse.chapter === currentEnd.chapter &&
      verse.verse === currentEnd.verse + 1;

    if (isConsecutive) {
      currentEnd = verse;
    } else {
      if (currentStart.book === currentEnd.book && 
          currentStart.chapter === currentEnd.chapter &&
          currentStart.verse === currentEnd.verse) {
        ranges.push(`${currentStart.book}.${currentStart.chapter}.${currentStart.verse}`);
      } else if (currentStart.book === currentEnd.book && 
                 currentStart.chapter === currentEnd.chapter) {
        ranges.push(`${currentStart.book}.${currentStart.chapter}.${currentStart.verse}-${currentEnd.verse}`);
      } else {
        ranges.push(`${currentStart.book}.${currentStart.chapter}.${currentStart.verse}-${currentEnd.book}.${currentEnd.chapter}.${currentEnd.verse}`);
      }
      currentStart = verse;
      currentEnd = verse;
    }
  }

  if (currentStart.book === currentEnd.book && 
      currentStart.chapter === currentEnd.chapter &&
      currentStart.verse === currentEnd.verse) {
    ranges.push(`${currentStart.book}.${currentStart.chapter}.${currentStart.verse}`);
  } else if (currentStart.book === currentEnd.book && 
             currentStart.chapter === currentEnd.chapter) {
    ranges.push(`${currentStart.book}.${currentStart.chapter}.${currentStart.verse}-${currentEnd.verse}`);
  } else {
    ranges.push(`${currentStart.book}.${currentStart.chapter}.${currentStart.verse}-${currentEnd.book}.${currentEnd.chapter}.${currentEnd.verse}`);
  }

  return ranges;
}

/**
 * Formats context selection for display or processing.
 */
export function formatContext(
  context: ContextSelection,
  format: "osis" | "display" = "osis"
): string {
  const allVerses = [...context.before, context.target, ...context.after];
  if (allVerses.length === 0) return "";

  if (format === "osis") {
    return compressVerseRanges(allVerses).join(", ");
  }

  return compressVerseRanges(allVerses).map(range => {
    const singleMatch = range.match(/^([A-Z0-9]+)\.(\d+)\.(\d+)$/);
    if (singleMatch) {
      const [, book, chapter, verse] = singleMatch;
      return `${OSIS_BOOK_NAMES[book as OsisBookCode] ?? book} ${chapter}:${verse}`;
    }
    
    const sameChapterRange = range.match(/^([A-Z0-9]+)\.(\d+)\.(\d+)-(\d+)$/);
    if (sameChapterRange) {
      const [, book, chapter, start, end] = sameChapterRange;
      return `${OSIS_BOOK_NAMES[book as OsisBookCode] ?? book} ${chapter}:${start}-${end}`;
    }
    
    const crossChapterRange = range.match(/^([A-Z0-9]+)\.(\d+)\.(\d+)-[A-Z0-9]+\.(\d+)\.(\d+)$/);
    if (crossChapterRange) {
      const [, book, startChapter, startVerse, endChapter, endVerse] = crossChapterRange;
      return `${OSIS_BOOK_NAMES[book as OsisBookCode] ?? book} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`;
    }
    
    return range;
  }).join("; ");
}

/**
 * Creates a paragraph styles map from verse data.
 * Input: array of { book, chapter, verse, paraStyle }
 */
export function createParagraphStyles(
  verses: Array<{ book: string; chapter: number; verse: number; paraStyle?: string }>
): Map<string, ParagraphStyle> {
  const styles = new Map<string, ParagraphStyle>();
  
  for (const v of verses) {
    if (v.paraStyle) {
      const key = `${v.book}.${v.chapter}.${v.verse}`;
      const style = v.paraStyle as ParagraphStyle;
      styles.set(key, style);
    }
  }
  
  return styles;
}
