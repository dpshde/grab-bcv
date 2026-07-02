# grab-bcv

Parse and normalize Bible passage references from natural text, OSIS strings, and shared links. Zero runtime dependencies, dual ESM/CJS, full TypeScript types.

Supports natural language ("John 3:16-18"), OSIS canonical strings ("JHN.3.16"), Logos Bible references ("logosres:bible+niv.61.3.16"), Bible.com URLs, BibleGateway search URLs, Enduring Word commentary URLs, and arbitrary text containing embedded references.

## Install

```bash
pnpm add grab-bcv
# or
npm install grab-bcv
# or
yarn add grab-bcv
```

## Quick Start

```ts
import {
  parsePassage,
  formatPassageForDisplay,
  parseToCanonicalRef,
  parseToDisplayRef,
  parseToResolverPath,
  parseToResolverUrl,
  parseAnyPassage,
  findAnyPassage,
  tryParseAnyPassage,
  autocompletePassage,
} from "grab-bcv";

// Core parsing: natural text or OSIS to ParsedPassage
const parsed = parsePassage("John 3:16-18");
parsed.canonical;   // "JHN.3.16-18"
parsed.rangeType;   // "same_chapter"
parsed.start;       // { book: "JHN", chapter: 3, verse: 16 }
parsed.end;         // { book: "JHN", chapter: 3, verse: 18 }

formatPassageForDisplay(parsed); // "John 3:16-18"

// Convenience: parse input and convert in one call
parseToCanonicalRef("logosres:bible+niv.61.3.16"); // "JHN.3.16"
parseToDisplayRef("JHN.3.16-18");                   // "John 3:16-18"
parseToResolverPath("John 3:16-18");                // "/jhn.3.16-18"
parseToResolverUrl("https://www.route.bible", "John 3:16-18");
// "https://www.route.bible/jhn.3.16-18"

// Any-passage parsing: handles URLs, shared-link payloads, and free text
parseAnyPassage("https://www.bible.com/bible/111/JHN.3.16");
// ParsedPassage (throws PassageParseError on invalid input)

parseAnyPassage("Read John 3:16 and Romans 8:28", { multiple: true }).map((p) => p.canonical);
// ["JHN.3.16", "ROM.8.28"]

findAnyPassage("not a passage"); // null

tryParseAnyPassage("Read John 3:16 and Romans 8:28", { multiple: true });
// { ok: true, value: ParsedPassage[] }

// Autocomplete for type-ahead UI
autocompletePassage("john 3:1", { limit: 3 });
// [
//   { label: "John 3:1",  insertText: "John 3:1",  canonical: "JHN.3.1",  kind: "verse" },
//   { label: "John 3:10", insertText: "John 3:10", canonical: "JHN.3.10", kind: "verse" },
//   { label: "John 3:11", insertText: "John 3:11", canonical: "JHN.3.11", kind: "verse" },
// ]
```

## Types

### `ParsedPassage`

```ts
type ParsedPassage = {
  input: string;           // the original input string
  canonical: string;       // OSIS canonical form, e.g. "JHN.3.16-18"
  start: PassagePart;      // first verse in the range
  end: PassagePart;        // last verse in the range
  rangeType: PassageRangeType;
};

type PassagePart = {
  book: OsisBookCode;      // e.g. "JHN"
  chapter: number;
  verse?: number;          // omitted for chapter-only references
};

type PassageRangeType =
  | "single"          // single verse, e.g. John 3:16
  | "chapter"         // whole chapter, e.g. John 3
  | "same_chapter"    // verse range within one chapter, e.g. John 3:16-18
  | "chapter_range"   // chapter range, e.g. John 3-5
  | "cross_reference"; // range spanning chapters/books, e.g. John 3:16-John 4:2
```

### `PassageParseError`

```ts
class PassageParseError extends Error {
  readonly code: PassageErrorCode;
  readonly details?: PassageCapErrorDetails;
}

type PassageErrorCode =
  | "EMPTY"
  | "INVALID_FORMAT"
  | "INVALID_BOOK"
  | "INVALID_NUMBER"
  | "REVERSED_RANGE";

// details is present when code is "INVALID_NUMBER" and the error is a cap violation
type PassageCapErrorDetails =
  | { kind: "chapter_cap"; book: OsisBookCode; bookName: string; maxChapter: number; attemptedChapter: number }
  | { kind: "verse_cap"; book: OsisBookCode; bookName: string; chapter: number; maxVerse: number; attemptedVerse: number };
```

### `SharePayload`

```ts
type SharePayload = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
};
```

### `NormalizedPassage`

Returned by `normalizeSharedPassage` and `normalizeAnyPassage`. Contains everything needed for display and routing in a single object.

```ts
type NormalizedPassage = {
  input: string;
  canonical: string;       // OSIS canonical
  display: string;         // human-readable, e.g. "John 3:16-18"
  slug: string;            // lowercase OSIS, e.g. "jhn.3.16-18"
  routePath: string;       // "/jhn.3.16-18"
  routeUrl: string;        // full URL with routeBaseUrl
  start: PassagePart;
  end: PassagePart;
  rangeType: PassageRangeType;
  source: {
    kind: "url" | "text" | "title" | "input";
    value: string;
  };
};
```

### `ResolverQuery`

```ts
type ResolverQuery = {
  translation?: string;    // e.g. "NIV"
  lang?: string;
  app?: string;
  src?: string;
  mode?: "auto" | "launcher" | "web";
};
```

### Verse Context Types

```ts
type VerseRef = { book: OsisBookCode; chapter: number; verse: number };

type ContextSelection = {
  target: VerseRef;
  before: VerseRef[];
  after: VerseRef[];
  totalVerses: number;
};

type ContextOptions = {
  maxBefore?: number;            // default: 3
  maxAfter?: number;             // default: 3
  respectBoundaries?: boolean;   // default: true (stop at chapter edges)
  detectPoetry?: boolean;        // default: true
  allowCrossChapter?: boolean;   // default: false
  crossChapterLimit?: number;    // default: 2
  respectParagraphs?: boolean;   // default: true
  paragraphStyles?: Map<string, ParagraphStyle>;
};

type ParagraphStyle =
  | "p" | "m" | "mi" | "pc" | "pmo" | "pmc" | "pmr"
  | "pi" | "pi1" | "pi2" | "pi3"
  | "q" | "q1" | "q2" | "q3" | "q4" | "qc" | "qr" | "d" | "sp"
  | "li" | "li1" | "li2" | "li3" | "li4"
  | "b" | "nb";
```

## API

### Parsing

#### `parsePassage(input: string): ParsedPassage`

Parse a single Bible reference. Accepts natural text ("John 3:16-18"), OSIS canonical ("JHN.3.16"), or OSIS with ranges ("JHN.3.16-JHN.4.2"). Throws `PassageParseError` on invalid input.

#### `tryParsePassage(input: string): { ok: true; value: ParsedPassage } | { ok: false; error: PassageParseError }`

Same as `parsePassage` but returns a discriminated union instead of throwing.

#### `parseAnyPassage(input: string, options?: { multiple?: boolean }): ParsedPassage | ParsedPassage[]`

Parse a passage from any supported source: URLs (Bible.com, BibleGateway, Logos, Enduring Word), OSIS strings, natural text, or free text with embedded references. When `multiple: true`, returns all references found. Throws `PassageParseError` on invalid input.

#### `findAnyPassage(input: string, options?: { multiple?: boolean }): ParsedPassage | ParsedPassage[] | null`

Like `parseAnyPassage` but returns `null` instead of throwing when no passage is found.

#### `tryParseAnyPassage(input: string, options?: { multiple?: boolean }): { ok: true; value: ParsedPassage | ParsedPassage[] } | { ok: false; error: PassageParseError }`

Same as `parseAnyPassage` but returns a discriminated union instead of throwing.

### Share Payload Parsing

#### `extractSharedCanonical(payload: SharePayload): string | null`

Extract an OSIS canonical string from a share payload (checks `url`, `text`, and `title` fields). Returns `null` if no passage is found.

#### `parseSharedPassage(payload: SharePayload): ParsedPassage | null`

Extract and parse a passage from a share payload. Returns `null` if not found.

#### `tryParseSharedPassage(payload: SharePayload): { ok: true; value: ParsedPassage } | { ok: false; error: PassageParseError }`

Same as `parseSharedPassage` but returns a discriminated union.

#### `normalizeSharedPassage(payload: SharePayload, options?: NormalizePassageOptions): NormalizedPassage | null`

Full normalization of a share payload. Returns a `NormalizedPassage` with display string, slug, route path, route URL, and source attribution. Options:

```ts
type NormalizePassageOptions = {
  routeBaseUrl?: string | URL; // default: "https://route.bible"
};
```

#### `normalizeAnyPassage(input: string, options?: NormalizePassageOptions): NormalizedPassage | null`

Like `normalizeSharedPassage` but takes a raw string input.

### Formatting and Conversion

#### `formatPassageForDisplay(parsed: ParsedPassage): string`

Convert a `ParsedPassage` to a human-readable display string (e.g. "John 3:16-18").

#### `toCanonicalRef(parsed: ParsedPassage): string`

Return the OSIS canonical string.

#### `toDisplayRef(parsed: ParsedPassage): string`

Alias for `formatPassageForDisplay`.

#### `toResolverPath(parsed: ParsedPassage, options?: ResolverPathOptions): string`

Generate a resolver path (e.g. "/jhn.3.16-18"). Options:

```ts
type ResolverPathOptions = {
  suffix?: "launcher" | "web";
};
```

#### `toResolverUrl(baseUrl: string | URL, parsed: ParsedPassage, options?: ResolverUrlOptions): string`

Generate a full resolver URL. Options:

```ts
type ResolverUrlOptions = ResolverPathOptions & {
  query?: ResolverQuery;
};
```

#### `parseToCanonicalRef(input: string | ParsedPassage): string`

Parse input (if string) and return the OSIS canonical. Accepts a pre-parsed `ParsedPassage` directly.

#### `parseToDisplayRef(input: string | ParsedPassage): string`

Parse input (if string) and return the display string.

#### `parseToResolverPath(input: string | ParsedPassage, options?: ResolverPathOptions): string`

Parse input (if string) and return a resolver path.

#### `parseToResolverUrl(baseUrl: string | URL, input: string | ParsedPassage, options?: ResolverUrlOptions): string`

Parse input (if string) and return a full resolver URL.

### Resolver Query Helpers

#### `ALLOWED_QUERY_KEYS`

Readonly array: `["translation", "lang", "app", "src", "mode"]`.

#### `normalizeResolverQuery(query: ResolverQuery): ResolverQuery`

Normalize a `ResolverQuery` (trims whitespace, uppercases translation, validates mode).

#### `parseResolverQuery(searchParams: URLSearchParams): ResolverQuery`

Parse a `URLSearchParams` into a `ResolverQuery`.

#### `serializeResolverQuery(query: ResolverQuery): string`

Serialize a `ResolverQuery` into a query string starting with `?` (or empty string).

#### `toQueryString(query: ResolverQuery): string`

Alias for `serializeResolverQuery` without the leading `?`.

### Autocomplete

#### `autocompletePassage(input: string, options?: AutocompletePassageOptions): AutocompletePassageSuggestion[]`

Type-ahead autocomplete for Bible references. Returns ranked suggestions for books, chapters, verses, and ranges.

```ts
type AutocompletePassageOptions = {
  limit?: number; // default: 8, max: 50
};

type AutocompletePassageSuggestion = {
  label: string;      // display label
  insertText: string; // text to insert
  canonical: string;  // OSIS canonical
  kind: "book" | "chapter" | "verse" | "range";
};
```

### Book Utilities

#### `resolveBookAlias(input: string): OsisBookCode | null`

Resolve a book name or alias to an OSIS book code. Handles abbreviations, common misspellings (fuzzy matching), and case-insensitive input. Returns `null` for ambiguous short aliases.

#### `getChapterCount(book: OsisBookCode): number`

Return the number of chapters in a book.

#### `getVerseCount(book: OsisBookCode, chapter: number): number | null`

Return the number of verses in a specific chapter. Returns `null` if the chapter is out of range.

#### `getMaxChapter(book: OsisBookCode): number`

Alias for `getChapterCount`.

#### `getMaxVerse(book: OsisBookCode, chapter: number): number | null`

Alias for `getVerseCount`.

#### `getBookOrder(book: OsisBookCode): number`

Return the 1-based canonical order index of a book (Genesis = 1, Revelation = 66).

#### `isOsisBookCode(value: string): value is OsisBookCode`

Type guard for OSIS book codes.

### Book Data Constants

#### `OSIS_BOOK_CODES: OsisBookCode[]`

Array of all 66 OSIS book codes in canonical order (e.g. `["GEN", "EXO", ..., "REV"]`).

#### `OSIS_BOOK_CODE_SET: Set<OsisBookCode>`

Set of all OSIS book codes for fast lookup.

#### `OSIS_BOOK_ORDER: ReadonlyMap<OsisBookCode, number>`

Map from OSIS book code to 1-based canonical order.

#### `OSIS_BOOK_NAMES: Readonly<Record<OsisBookCode, string>>`

Map from OSIS book code to display name (e.g. `JHN` -> "John").

#### `BOOK_CHAPTER_COUNTS: Readonly<Record<OsisBookCode, number>>`

Map from OSIS book code to chapter count.

#### `BOOK_VERSE_COUNTS: Readonly<Record<OsisBookCode, number[]>>`

Map from OSIS book code to an array of verse counts per chapter (1-indexed).

#### `BOOK_ALIAS_TO_OSIS: ReadonlyMap<string, OsisBookCode>`

Map of aliases (including fuzzy variants) to OSIS book codes.

### Verse Context Expansion

Paragraph-aware verse context expansion for "expand around target verse" UI features.

#### `getVerseContext(ref: VerseRef, options?: ContextOptions): ContextSelection`

Get surrounding verses for a target reference. When paragraph style data is provided, context boundaries respect paragraph breaks instead of using fixed verse counts.

```ts
import { getVerseContext, getParagraphData, createParagraphStyles } from "grab-bcv";

const styles = createParagraphStyles(getParagraphData("JHN", 3));
const context = getVerseContext(
  { book: "JHN", chapter: 3, verse: 16 },
  { paragraphStyles: styles }
);
```

#### `expandContext(parsed: ParsedPassage, options?: ContextOptions): VerseWithPara[]`

Expand a `ParsedPassage` into an array of individual verses with paragraph style metadata.

#### `formatContext(verses: VerseWithPara[]): string`

Format an array of verses into a display string.

#### `createParagraphStyles(entries: ParagraphEntry[]): Map<string, ParagraphStyle>`

Convert `ParagraphEntry[]` (from `getParagraphData`) into a `Map` suitable for `ContextOptions.paragraphStyles`.

### Paragraph Data

Client-side paragraph metadata for all Bible chapters. Zero network calls.

#### `getParagraphData(book: string, chapter: number): ParagraphEntry[]`

Return paragraph style entries for a book/chapter. Empty array if not found.

```ts
type ParagraphEntry = { v: number; s: string };
```

#### `hasParagraphData(book: string, chapter: number): boolean`

Check whether paragraph data exists for a book/chapter.

## Supported URL Formats

- Bible.com: `https://www.bible.com/bible/111/JHN.3.16`
- BibleGateway: `https://www.biblegateway.com/passage/?search=John+3:16-18`
- Logos: `https://logos.com/bible/niv/john%203:16` or `logosres:bible+niv.61.3.16`
- Enduring Word: `https://enduringword.com/bible-commentary/john-3/`
- Route Bible: `https://route.bible/jhn.3.16`
- Any URL with a recognizable OSIS reference in the path, hash, or query parameters

## Supported Reference Formats

- Natural text: `John 3:16-18`, `1 Corinthians 13`, `Song of Solomon 1:3`
- OSIS canonical: `JHN.3.16`, `JHN.3.16-18`, `JHN.3.16-JHN.4.2`
- Chapter-only: `John 3`, `JHN.3`
- Cross-book ranges: `John 3:16-Revelation 1:1`
- Numbered books: `1 John 1:1`, `3 John 1:14`

Input normalization handles full-width punctuation, Unicode dash variants, invisible formatting characters, and flexible spacing.

## Sub-path Imports

Each module can be imported individually:

```ts
import { parsePassage } from "grab-bcv/parse";
import { OSIS_BOOK_CODES } from "grab-bcv/books";
import { findAnyPassage } from "grab-bcv/find";
import { autocompletePassage } from "grab-bcv/autocomplete";
```

Available sub-paths: `/books`, `/parse`, `/find`, `/autocomplete`.

## Support

- [Buy me a coffee](https://ko-fi.com/dpshade)

## Local Development

```bash
pnpm install
pnpm build      # build dist/ via tsup
pnpm test       # run vitest
pnpm typecheck  # tsc --noEmit
pnpm check      # typecheck + tests
```

## Production Readiness

- Node.js `18+` is required.
- Zero runtime dependencies.
- Dual ESM/CJS output with full TypeScript declarations.
- CI runs on push via GitHub Actions.
- `prepack` enforces build + typecheck + tests before publish.
- npm publishing uses OIDC trusted publishing with provenance.

## Deploy

1. Bump `version` in `package.json`.
2. Push to `main` (or tag `v<version>`).
3. The Publish workflow auto-publishes to npm with provenance.

For local publishing:

```bash
pnpm run deploy:npm
```

- Runs `prepack` first, bumps patch only when local matches npm latest, then publishes.
- If publish fails after an automatic bump, the bump is reverted.
- For npm accounts with 2FA `auth-and-writes` and passkeys, use a token with `bypass_2fa=true`:
  - `NPM_TOKEN=... pnpm run deploy:npm`
- OTP fallback:
  - `NPM_OTP=123456 pnpm run deploy:npm`

## Trusted Publishing

- GitHub Actions workflow: `.github/workflows/publish.yml`
- npm Trusted Publisher settings should point to:
  - Owner: `dpshde`
  - Repository: `grab-bcv`
  - Workflow filename: `publish.yml`
- Tag-based releases use `v<package.json version>`, for example `v0.1.7`.
- Pushes to `master`/`main` also auto-publish when `package.json` is newer than npm.
- The workflow also supports manual `workflow_dispatch`; if the current version is already on npm it exits cleanly without republishing.

## Notes

- Book aliases use exact matching first, then conservative fuzzy fallback for common misspellings.
- Ambiguous short aliases return `null`.
- Input normalization handles full-width punctuation, Unicode dash variants, invisible characters, and flexible whitespace.
- Paragraph data covers all 66 books and is bundled in the package (zero network calls at runtime).
