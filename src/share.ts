import { OSIS_BOOK_CODES, OSIS_BOOK_NAMES, type OsisBookCode } from "./books";
import { formatPassageForDisplay } from "./format";
import { parsePassage } from "./parser";
import { PassageParseError, type ParsedPassage } from "./types";

export type SharePayload = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
};

export type AnyPassageParseOptions = {
  multiple?: boolean;
};

export type NormalizePassageOptions = {
  routeBaseUrl?: string | URL;
};

export type NormalizedPassageSourceKind = "url" | "text" | "title" | "input";

export type NormalizedPassage = {
  input: string;
  canonical: string;
  display: string;
  slug: string;
  routePath: string;
  routeUrl: string;
  start: ParsedPassage["start"];
  end: ParsedPassage["end"];
  rangeType: ParsedPassage["rangeType"];
  source: {
    kind: NormalizedPassageSourceKind;
    value: string;
  };
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PassageParseError };

type PassageResult = ParseResult<ParsedPassage>;
type PassagesResult = ParseResult<ParsedPassage[]>;
type CandidateMatch = {
  token: string;
  index: number;
  priority: number;
};

const SHARE_QUERY_KEYS = ["reference", "passage", "search", "q", "ref", "scripture", "verse"];
const LOGOS_NEW_TESTAMENT_OFFSET = 21;
const URL_TOKEN_PATTERN = "(?:https?:\\/\\/|[a-z][a-z0-9+.-]*:\\/\\/|www\\.)[^\\s)]+";
const REFERENCE_TOKEN_PATTERN =
  "[1-3]?[A-Za-z]{2,}\\.\\d+(?:\\.\\d+)?(?:-[1-3]?[A-Za-z]{2,}\\.\\d+\\.\\d+|-\\d+)?(?:\\.[A-Za-z0-9]{2,8})?|(?:[1-3]\\s*)?[A-Za-z]+(?:\\s+of\\s+[A-Za-z]+)?\\s+\\d+(?:(?::|\\s)\\d+(?:-\\d+)?)?";
const LEADING_WRAPPER_REGEX = /^[([{"'`]+/;
const TRAILING_WRAPPER_REGEX = /[)\]}",;.!?'`]+$/;
const DEFAULT_ROUTE_BASE_URL = "https://route.bible";

const ENDURING_WORD_OVERRIDES: Partial<Record<OsisBookCode, string>> = {
  PSA: "psalm",
  SNG: "song-of-solomon"
};

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/['".,()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ENDURING_WORD_SLUG_TO_BOOK = new Map<string, OsisBookCode>(
  OSIS_BOOK_CODES.map((book) => [ENDURING_WORD_OVERRIDES[book] ?? toSlug(OSIS_BOOK_NAMES[book]), book])
);

function tryDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const token = value.trim();
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    out.push(token);
  }
  return out;
}

function toRouteBaseUrl(input: string | URL | undefined): URL {
  try {
    return new URL(input ?? DEFAULT_ROUTE_BASE_URL);
  } catch {
    return new URL(DEFAULT_ROUTE_BASE_URL);
  }
}

function toNormalizedPassage(
  parsed: ParsedPassage,
  source: { kind: NormalizedPassageSourceKind; value: string },
  options: NormalizePassageOptions = {}
): NormalizedPassage {
  const slug = parsed.canonical.toLowerCase();
  const routePath = `/${encodeURIComponent(slug)}`;
  const baseUrl = toRouteBaseUrl(options.routeBaseUrl);
  const routeUrl = new URL(routePath, baseUrl).toString();

  return {
    input: parsed.input,
    canonical: parsed.canonical,
    display: formatPassageForDisplay(parsed),
    slug,
    routePath,
    routeUrl,
    start: { ...parsed.start },
    end: { ...parsed.end },
    rangeType: parsed.rangeType,
    source,
  };
}

function stripTranslationSuffix(value: string): string {
  const cleaned = value.trim().replace(/^[/#?]+|[/#?]+$/g, "");
  const match = cleaned.match(
    /^([1-3]?[A-Za-z]{2,}\.\d+(?:\.\d+)?(?:-[1-3]?[A-Za-z]{2,}\.\d+\.\d+|-\d+)?)(?:\.[A-Za-z0-9]{2,8})$/
  );
  if (match?.[1]) {
    return match[1];
  }
  return cleaned;
}

function resolveLogosBook(bookNumberRaw: string): OsisBookCode | null {
  const bookNumber = Number.parseInt(bookNumberRaw, 10);
  if (!Number.isInteger(bookNumber) || bookNumber <= 0) {
    return null;
  }

  if (bookNumber >= 61 && bookNumber <= 87) {
    const shiftedNumber = bookNumber - LOGOS_NEW_TESTAMENT_OFFSET;
    if (shiftedNumber >= 40 && shiftedNumber <= OSIS_BOOK_CODES.length) {
      return OSIS_BOOK_CODES[shiftedNumber - 1] ?? null;
    }
  }

  return OSIS_BOOK_CODES[bookNumber - 1] ?? null;
}

function parseLogosReference(value: string): string | null {
  const decoded = tryDecode(value).trim().replace(/^[/#?]+|[/#?]+$/g, "");
  if (!decoded) {
    return null;
  }

  const segment = decoded.split("/").filter(Boolean).pop() ?? decoded;
  const match = segment.match(
    /^bible(?:\+[a-z0-9_-]+)?\.(\d+)\.(\d+)(?:\.(\d+))?(?:-(\d+))?(?:\.[a-z][a-z0-9_-]*)*$/i
  );
  if (!match) {
    return null;
  }

  const [, bookNumberRaw, chapterRaw, verseRaw, rangeEndRaw] = match;
  if (!bookNumberRaw || !chapterRaw) {
    return null;
  }

  const book = resolveLogosBook(bookNumberRaw);
  if (!book) {
    return null;
  }

  const chapter = Number.parseInt(chapterRaw, 10);
  if (!Number.isInteger(chapter) || chapter <= 0) {
    return null;
  }

  if (!verseRaw) {
    return `${book}.${chapter}`;
  }

  const verse = Number.parseInt(verseRaw, 10);
  if (!Number.isInteger(verse) || verse <= 0) {
    return null;
  }

  if (!rangeEndRaw) {
    return `${book}.${chapter}.${verse}`;
  }

  const rangeEnd = Number.parseInt(rangeEndRaw, 10);
  if (!Number.isInteger(rangeEnd) || rangeEnd < verse) {
    return null;
  }

  return `${book}.${chapter}.${verse}-${rangeEnd}`;
}

function candidateVariants(value: string): string[] {
  const decoded = tryDecode(value);
  const normalized = decoded.replace(/_/g, " ");
  const stripped = normalized.replace(/^["'`]+|["'`]+$/g, "");
  const withoutTranslation = stripTranslationSuffix(stripped);

  return unique([value, decoded, normalized, stripped, withoutTranslation]);
}

function tryCanonicalFromCandidate(value: string): string | null {
  const logosCanonical = parseLogosReference(value);
  if (logosCanonical) {
    return logosCanonical;
  }

  for (const candidate of candidateVariants(value)) {
    const logosVariantCanonical = parseLogosReference(candidate);
    if (logosVariantCanonical) {
      return logosVariantCanonical;
    }

    try {
      return parsePassage(candidate).canonical;
    } catch {
      continue;
    }
  }

  return null;
}

function tryParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    if (raw.startsWith("www.")) {
      try {
        return new URL(`https://${raw}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseEnduringWordPath(pathname: string): string | null {
  const match = pathname.match(/\/bible-commentary\/([a-z0-9-]+)-(\d+)\/?$/i);
  const slug = match?.[1]?.toLowerCase();
  const chapter = match?.[2];
  if (!slug || !chapter) {
    return null;
  }

  const book = ENDURING_WORD_SLUG_TO_BOOK.get(slug);
  if (!book) {
    return null;
  }

  return `${book}.${chapter}`;
}

function extractBibleSegmentReference(segments: string[]): string | null {
  const bibleIndex = segments.findIndex((segment) => segment.toLowerCase() === "bible");
  if (bibleIndex < 0) {
    return null;
  }

  const next = segments[bibleIndex + 1];
  if (!next) {
    return null;
  }

  if (/^\d+$/.test(next)) {
    return segments[bibleIndex + 2] ?? null;
  }

  return next;
}

function parseVerseAnchor(hash: string): string | null {
  const cleaned = hash.trim().replace(/^[/#?]+|[/#?]+$/g, "");
  const match = cleaned.match(/^(?:v(?:erse)?[=:.-]?)?(\d+)(?:-(\d+))?$/i);
  if (!match?.[1]) {
    return null;
  }

  const start = Number.parseInt(match[1], 10);
  if (!Number.isInteger(start) || start <= 0) {
    return null;
  }

  const endRaw = match[2];
  if (!endRaw) {
    return `${start}`;
  }

  const end = Number.parseInt(endRaw, 10);
  if (!Number.isInteger(end) || end < start) {
    return null;
  }

  return `${start}-${end}`;
}

function extractUrlTokens(text: string): string[] {
  return text.match(new RegExp(URL_TOKEN_PATTERN, "gi")) ?? [];
}

function extractReferenceTokens(text: string): string[] {
  return unique(text.match(new RegExp(REFERENCE_TOKEN_PATTERN, "gi")) ?? []);
}

function normalizeCandidateToken(raw: string): string {
  return raw
    .trim()
    .replace(LEADING_WRAPPER_REGEX, "")
    .replace(TRAILING_WRAPPER_REGEX, "")
    .trim();
}

function collectCandidateMatches(input: string): CandidateMatch[] {
  const byToken = new Map<string, CandidateMatch>();
  const addCandidate = (rawToken: string, index: number, priority: number): void => {
    const token = normalizeCandidateToken(rawToken);
    if (!token) {
      return;
    }

    const existing = byToken.get(token);
    if (!existing || index < existing.index || (index === existing.index && priority > existing.priority)) {
      byToken.set(token, { token, index, priority });
    }
  };

  for (const match of input.matchAll(new RegExp(URL_TOKEN_PATTERN, "gi"))) {
    if (!match[0]) {
      continue;
    }
    addCandidate(match[0], match.index ?? 0, 3);
  }

  for (const match of input.matchAll(new RegExp(REFERENCE_TOKEN_PATTERN, "gi"))) {
    if (!match[0]) {
      continue;
    }
    addCandidate(match[0], match.index ?? 0, 2);
  }

  return Array.from(byToken.values()).sort((a, b) => a.index - b.index || b.priority - a.priority || b.token.length - a.token.length);
}

function tryParseCanonical(canonical: string): ParsedPassage | null {
  try {
    return parsePassage(canonical);
  } catch {
    return null;
  }
}

function normalizeUrlSurface(text: string): string {
  return tryDecode(text)
    .replace(/[_./?&#=+%-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReferenceWindows(text: string): string[] {
  const tokens = text.match(/[A-Za-z0-9]+/g) ?? [];
  const cappedTokens = tokens.slice(0, 80);
  const out: string[] = [];

  for (let start = 0; start < cappedTokens.length; start += 1) {
    for (let length = 2; length <= 6 && start + length <= cappedTokens.length; length += 1) {
      const slice = cappedTokens.slice(start, start + length);
      const hasLetter = slice.some((token) => /[a-z]/i.test(token));
      const hasDigit = slice.some((token) => /\d/.test(token));
      if (!hasLetter || !hasDigit) {
        continue;
      }

      out.push(slice.join(" "));

      const lastTwo = slice.slice(-2);
      if (/^\d+$/.test(lastTwo[0] ?? "") && /^\d+$/.test(lastTwo[1] ?? "")) {
        const bookTokens = slice.slice(0, -2);
        if (bookTokens.length > 0) {
          out.push(`${bookTokens.join(" ")} ${lastTwo[0]}:${lastTwo[1]}`);
        }
      }

      const lastThree = slice.slice(-3);
      if (lastThree.length === 3 && lastThree.every((token) => /^\d+$/.test(token))) {
        const bookTokens = slice.slice(0, -3);
        if (bookTokens.length > 0) {
          out.push(`${bookTokens.join(" ")} ${lastThree[0]}:${lastThree[1]}-${lastThree[2]}`);
        }
      }
    }
  }

  return unique(out);
}

function canonicalSpecificityScore(canonical: string): number {
  try {
    const parsed = parsePassage(canonical);
    switch (parsed.rangeType) {
      case "cross_reference":
        return 140;
      case "same_chapter":
        return 130;
      case "single":
        return 120;
      case "chapter_range":
        return 60;
      case "chapter":
        return 40;
      default:
        return 10;
    }
  } catch {
    return 0;
  }
}

function selectBestCanonical(candidates: string[]): string | null {
  let best: { canonical: string; score: number; candidateLength: number } | null = null;

  for (const candidate of unique(candidates)) {
    const canonical = tryCanonicalFromCandidate(candidate);
    if (!canonical) {
      continue;
    }

    const score = canonicalSpecificityScore(canonical);
    const candidateLength = candidate.length;
    if (!best) {
      best = { canonical, score, candidateLength };
      continue;
    }

    if (score > best.score) {
      best = { canonical, score, candidateLength };
      continue;
    }

    if (score === best.score && candidateLength < best.candidateLength) {
      best = { canonical, score, candidateLength };
    }
  }

  return best?.canonical ?? null;
}

function parseFromUrl(raw: string): string | null {
  const parsed = tryParseUrl(raw);
  if (!parsed) {
    return null;
  }

  const candidates: string[] = [];
  const chapterContextCandidates: string[] = [];
  const pathname = tryDecode(parsed.pathname);
  const segments = pathname.split("/").filter(Boolean).map((segment) => tryDecode(segment));
  const addChapterContextCandidate = (candidate: string | undefined): void => {
    if (!candidate) {
      return;
    }
    candidates.push(candidate);
    chapterContextCandidates.push(candidate);
  };

  if (segments[0] === "v1" && segments[1] === "p" && segments[2]) {
    addChapterContextCandidate(segments[2]);
  }

  addChapterContextCandidate(extractBibleSegmentReference(segments) ?? undefined);

  for (const segment of segments) {
    if (/\d/.test(segment)) {
      candidates.push(segment);
    }
  }

  if (parsed.hostname.includes("logos.com")) {
    const bibleIndex = segments.findIndex((segment) => segment.toLowerCase() === "bible");
    const logosReference = bibleIndex >= 0 ? segments[bibleIndex + 1] : undefined;
    if (logosReference) {
      candidates.push(logosReference);
    }

    const referencesIndex = segments.findIndex((segment) => segment.toLowerCase() === "references");
    const logosDataReference = referencesIndex >= 0 ? segments[referencesIndex + 1] : undefined;
    if (logosDataReference) {
      candidates.push(logosDataReference);
    }
  }

  if (parsed.hostname.includes("biblegateway.com")) {
    const search = parsed.searchParams.get("search");
    if (search) {
      candidates.push(search);
    }
  }

  for (const value of parsed.searchParams.values()) {
    if (value) {
      candidates.push(value);
    }
  }

  const enduringWord = parseEnduringWordPath(pathname);
  if (enduringWord) {
    candidates.push(enduringWord);
  }

  for (const key of SHARE_QUERY_KEYS) {
    const value = parsed.searchParams.get(key);
    if (value) {
      candidates.push(value);
    }
  }

  if (parsed.hash) {
    const hash = tryDecode(parsed.hash.slice(1));
    if (hash) {
      candidates.push(hash);
      const hashParams = new URLSearchParams(hash);
      for (const key of SHARE_QUERY_KEYS) {
        const value = hashParams.get(key);
        if (value) {
          candidates.push(value);
        }
      }

      for (const value of hashParams.values()) {
        if (value) {
          candidates.push(value);
        }
      }

      const verseAnchor = parseVerseAnchor(hash);
      if (verseAnchor) {
        for (const chapterContext of unique(chapterContextCandidates)) {
          const canonical = tryCanonicalFromCandidate(chapterContext);
          if (!canonical) {
            continue;
          }

          try {
            const parsedCanonical = parsePassage(canonical);
            if (parsedCanonical.rangeType !== "chapter") {
              continue;
            }
          } catch {
            continue;
          }

          candidates.push(`${canonical}.${verseAnchor}`);
        }
      }
    }
  }

  const structuralCanonical = selectBestCanonical(candidates);
  if (structuralCanonical) {
    return structuralCanonical;
  }

  const genericSources = unique([
    parsed.hostname,
    pathname,
    ...segments,
    tryDecode(parsed.search),
    tryDecode(parsed.hash),
    tryDecode(`${parsed.hostname}${parsed.pathname}${parsed.search}${parsed.hash}`)
  ]);

  for (const source of genericSources) {
    const normalized = normalizeUrlSurface(source);
    if (!normalized) {
      continue;
    }

    candidates.push(normalized);
    candidates.push(...extractReferenceTokens(normalized));
    candidates.push(...extractReferenceWindows(normalized));
  }

  return selectBestCanonical(candidates);
}

function parseFromText(raw: string): string | null {
  const direct = tryCanonicalFromCandidate(raw);
  if (direct) {
    return direct;
  }

  for (const token of extractUrlTokens(raw)) {
    const canonical = parseFromUrl(token);
    if (canonical) {
      return canonical;
    }
  }

  for (const token of extractReferenceTokens(raw)) {
    const canonical = tryCanonicalFromCandidate(token);
    if (canonical) {
      return canonical;
    }
  }

  return null;
}

function parseCandidateCanonical(candidate: string): string | null {
  return parseFromUrl(candidate) ?? tryCanonicalFromCandidate(candidate) ?? parseFromText(candidate);
}

function findMultipleAnyPassages(input: string): ParsedPassage[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const passages: ParsedPassage[] = [];
  const seenCanonical = new Set<string>();
  const addPassage = (parsed: ParsedPassage | null): void => {
    if (!parsed || seenCanonical.has(parsed.canonical)) {
      return;
    }

    seenCanonical.add(parsed.canonical);
    passages.push(parsed);
  };

  for (const candidate of collectCandidateMatches(trimmed)) {
    const canonical = parseCandidateCanonical(candidate.token);
    if (!canonical) {
      continue;
    }

    addPassage(tryParseCanonical(canonical));
  }

  if (passages.length > 0) {
    return passages;
  }

  addPassage(findSingleAnyPassage(trimmed));
  return passages;
}

export function extractSharedCanonical(payload: SharePayload): string | null {
  const values = [payload.url, payload.text, payload.title]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const value of values) {
    const fromUrl = parseFromUrl(value);
    if (fromUrl) {
      return fromUrl;
    }

    const fromText = parseFromText(value);
    if (fromText) {
      return fromText;
    }
  }

  return null;
}

export function normalizeSharedPassage(
  payload: SharePayload,
  options: NormalizePassageOptions = {}
): NormalizedPassage | null {
  const candidates: Array<{ kind: NormalizedPassageSourceKind; value: string }> = [];
  const addCandidate = (
    kind: NormalizedPassageSourceKind,
    value: string | null | undefined,
  ): void => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return;
    }

    candidates.push({ kind, value: trimmed });
  };

  addCandidate("url", payload.url);
  addCandidate("text", payload.text);
  addCandidate("title", payload.title);

  for (const candidate of candidates) {
    const canonical = parseCandidateCanonical(candidate.value);
    if (!canonical) {
      continue;
    }

    const parsed = tryParseCanonical(canonical);
    if (!parsed) {
      continue;
    }

    return toNormalizedPassage(parsed, candidate, options);
  }

  return null;
}

export function parseSharedPassage(payload: SharePayload): ParsedPassage | null {
  const normalized = normalizeSharedPassage(payload);
  if (!normalized) {
    return null;
  }

  return tryParseCanonical(normalized.canonical);
}

export function tryParseSharedPassage(payload: SharePayload): PassageResult {
  const canonical = extractSharedCanonical(payload);
  if (!canonical) {
    return { ok: false, error: new PassageParseError("EMPTY", "Passage is required.") };
  }

  try {
    return { ok: true, value: parsePassage(canonical) };
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

function getAnyPassageCandidate(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const sharedCanonical = extractSharedCanonical({
    title: value,
    text: value,
    url: value,
  });

  return sharedCanonical ?? value;
}

function findSingleAnyPassage(input: string): ParsedPassage | null {
  const candidate = getAnyPassageCandidate(input);
  if (!candidate) {
    return null;
  }

  try {
    return parsePassage(candidate);
  } catch {
    return null;
  }
}

export function normalizeAnyPassage(
  input: string,
  options: NormalizePassageOptions = {}
): NormalizedPassage | null {
  const parsed = findSingleAnyPassage(input);
  if (!parsed) {
    return null;
  }

  return toNormalizedPassage(parsed, { kind: "input", value: input }, options);
}

function tryParseSingleAnyPassage(input: string): PassageResult {
  const candidate = getAnyPassageCandidate(input);
  if (!candidate) {
    return { ok: false, error: new PassageParseError("EMPTY", "Passage is required.") };
  }

  try {
    return { ok: true, value: parsePassage(candidate) };
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

export function parseAnyPassage(input: string): ParsedPassage;
export function parseAnyPassage(input: string, options: { multiple: true }): ParsedPassage[];
export function parseAnyPassage(input: string, options: AnyPassageParseOptions = {}): ParsedPassage | ParsedPassage[] {
  const result = options.multiple ? tryParseAnyPassage(input, { multiple: true }) : tryParseAnyPassage(input);
  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}

export function findAnyPassage(input: string): ParsedPassage | null;
export function findAnyPassage(input: string, options: { multiple: true }): ParsedPassage[];
export function findAnyPassage(
  input: string,
  options: AnyPassageParseOptions = {}
): ParsedPassage | ParsedPassage[] | null {
  if (options.multiple) {
    return findMultipleAnyPassages(input);
  }

  return findSingleAnyPassage(input);
}

export function tryParseAnyPassage(input: string): PassageResult;
export function tryParseAnyPassage(input: string, options: { multiple: true }): PassagesResult;
export function tryParseAnyPassage(
  input: string,
  options: AnyPassageParseOptions = {}
): PassageResult | PassagesResult {
  if (options.multiple) {
    const passages = findMultipleAnyPassages(input);
    if (passages.length > 0) {
      return { ok: true, value: passages };
    }

    const fallback = tryParseSingleAnyPassage(input);
    if (!fallback.ok) {
      return fallback;
    }

    return { ok: true, value: [fallback.value] };
  }

  return tryParseSingleAnyPassage(input);
}
