# grab-bcv

A TypeScript library for parsing, normalizing, and routing Bible passage references. Turn messy user input, app share payloads, and Bible app URLs into clean, canonical references your app can act on.

**Zero runtime dependencies. Dual ESM/CJS. Full type declarations.**

## Who is this for?

Anyone building an app that touches Bible references and is tired of writing regex for "what does `1 cor 13` mean?" or "how do I parse a Bible.com share link?" Specifically:

- **Bible app developers** who need to accept user input like "John 3:16" or "jn3.16" and route to the right passage
- **Share-extension / deep-link builders** who receive URLs from Bible.com, BibleGateway, Logos, or Enduring Word and need to extract the reference
- **Search / autocomplete UI builders** who want type-ahead suggestions as the user types a reference
- **Reading-plan or study-tool authors** who need to expand a verse into its surrounding context, respecting paragraph boundaries

## Install

```bash
pnpm add grab-bcv
npm install grab-bcv
yarn add grab-bcv
```

## The five things you'll reach for

### 1. Parse a reference

The bread and butter. Give it natural text or an OSIS string, get back a structured `ParsedPassage`.

```ts
import { parsePassage, formatPassageForDisplay } from "grab-bcv";

const parsed = parsePassage("John 3:16-18");

parsed.canonical;   // "JHN.3.16-18"
parsed.rangeType;   // "same_chapter"
parsed.start;       // { book: "JHN", chapter: 3, verse: 16 }
parsed.end;         // { book: "JHN", chapter: 3, verse: 18 }

formatPassageForDisplay(parsed); // "John 3:16-18"
```

Accepts: `John 3:16-18`, `1 Corinthians 13`, `Song of Solomon 1:3`, `JHN.3.16`, `JHN.3.16-JHN.4.2`, `John 3`, `1 John 1:1`, and more. Input is normalized automatically (full-width punctuation, Unicode dash variants, invisible characters, flexible spacing).

Throws `PassageParseError` (with a typed `code`) on invalid input, or use `tryParsePassage` for a discriminated-union return.

### 2. Parse anything (URLs, share payloads, free text)

`parseAnyPassage` is the Swiss-army parser. It handles URLs from major Bible apps, OSIS strings, natural text, and free text with embedded references.

```ts
import { parseAnyPassage, findAnyPassage, tryParseAnyPassage } from "grab-bcv";

// Bible.com URL
parseAnyPassage("https://www.bible.com/bible/111/JHN.3.16");

// Logos deep link
parseAnyPassage("logosres:bible+niv.61.3.16"); // -> JHN.3.16

// Free text with multiple references
parseAnyPassage("Read John 3:16 and Romans 8:28", { multiple: true }).map((p) => p.canonical);
// ["JHN.3.16", "ROM.8.28"]

// Prefer null over exceptions?
findAnyPassage("not a passage"); // null

// Or get a Result-style return
tryParseAnyPassage("Read John 3:16 and Romans 8:28", { multiple: true });
// { ok: true, value: ParsedPassage[] }
```

Supported URL sources: Bible.com, BibleGateway, Logos (`logos.com` and `logosres:`), Enduring Word, Route Bible, and any URL with a recognizable OSIS reference in the path, hash, or query params.

### 3. Build a deep link

Generate router paths or full URLs from any parsed reference. Great for "open in Bible app" buttons or internal routing.

```ts
import { parseToResolverUrl, parseToResolverPath } from "grab-bcv";

parseToResolverPath("John 3:16-18");
// "/jhn.3.16-18"

parseToResolverUrl("https://www.route.bible", "John 3:16-18");
// "https://www.route.bible/jhn.3.16-18"

// With query params (translation, language, app mode, etc.)
parseToResolverUrl("https://route.bible", "John 3:16-18", {
  query: { translation: "NIV", mode: "web" }
});
// "https://route.bible/jhn.3.16-18?translation=NIV&mode=web"
```

### 4. Power an autocomplete box

`autocompletePassage` gives you ranked, type-ahead suggestions as the user types. Returns books, chapters, verses, and ranges with display labels and insert text.

```ts
import { autocompletePassage } from "grab-bcv";

autocompletePassage("john 3:1", { limit: 3 });
// [
//   { label: "John 3:1",  insertText: "John 3:1",  canonical: "JHN.3.1",  kind: "verse" },
//   { label: "John 3:10", insertText: "John 3:10", canonical: "JHN.3.10", kind: "verse" },
//   { label: "John 3:11", insertText: "John 3:11", canonical: "JHN.3.11", kind: "verse" },
// ]

autocompletePassage("rom");
// [ { label: "Romans", insertText: "Romans ", canonical: "ROM", kind: "book" }, ... ]
```

### 5. Normalize a share intent

When a user shares a Bible passage into your app from another app, you get a `{ url, text, title }` payload. `normalizeSharedPassage` turns it into a single object with everything you need: display string, slug, route path, route URL, and where the reference was found.

```ts
import { normalizeSharedPassage } from "grab-bcv";

const result = normalizeSharedPassage({
  url: "https://www.bible.com/bible/111/JHN.3.16",
  text: "Check out John 3:16!",
  title: "John 3:16"
});

// {
//   canonical: "JHN.3.16",
//   display: "John 3:16",
//   slug: "jhn.3.16",
//   routePath: "/jhn.3.16",
//   routeUrl: "https://route.bible/jhn.3.16",
//   source: { kind: "url", value: "https://www.bible.com/bible/111/JHN.3.16" },
//   ...
// }
```

For a plain string input (not a share payload), use `normalizeAnyPassage` instead.

## Bonus: verse context expansion

If your app shows a verse and lets users "expand context" to see surrounding verses, the verse-context module respects paragraph boundaries so you don't cut a sentence in half.

```ts
import { getVerseContext, getParagraphData, createParagraphStyles } from "grab-bcv";

const styles = createParagraphStyles(getParagraphData("JHN", 3));
const context = getVerseContext(
  { book: "JHN", chapter: 3, verse: 16 },
  { paragraphStyles: styles }
);
// context.before  -> verses before, stopping at the paragraph break
// context.after   -> verses after, stopping at the paragraph break
// context.target  -> { book: "JHN", chapter: 3, verse: 16 }
```

Paragraph data is bundled in the package for all 66 books. Zero network calls at runtime.

## Sub-path imports

Prefer smaller bundles? Import from sub-paths:

```ts
import { parsePassage } from "grab-bcv/parse";
import { OSIS_BOOK_CODES } from "grab-bcv/books";
import { findAnyPassage } from "grab-bcv/find";
import { autocompletePassage } from "grab-bcv/autocomplete";
```

Available: `/books`, `/parse`, `/find`, `/autocomplete`.

## Reference

### `ParsedPassage`

The central parse result.

```ts
type ParsedPassage = {
  input: string;           // original input
  canonical: string;       // OSIS form, e.g. "JHN.3.16-18"
  start: PassagePart;      // first verse in range
  end: PassagePart;        // last verse in range
  rangeType: PassageRangeType;
};

type PassagePart = {
  book: OsisBookCode;      // e.g. "JHN"
  chapter: number;
  verse?: number;          // omitted for chapter-only refs
};

type PassageRangeType =
  | "single"          // one verse
  | "chapter"         // whole chapter
  | "same_chapter"    // verse range in one chapter
  | "chapter_range"   // chapter range
  | "cross_reference"; // spans chapters or books
```

### `PassageParseError`

```ts
class PassageParseError extends Error {
  readonly code: PassageErrorCode;
  readonly details?: PassageCapErrorDetails;
}

type PassageErrorCode =
  | "EMPTY" | "INVALID_FORMAT" | "INVALID_BOOK"
  | "INVALID_NUMBER" | "REVERSED_RANGE";
```

`details` is present when `code` is `"INVALID_NUMBER"` and the error is a cap violation (e.g. "John 3:99" when John 3 has 36 verses). It tells you the book, the attempted value, and the actual max.

### Full function list

**Parsing**

| Function | Returns | Notes |
|---|---|---|
| `parsePassage(input)` | `ParsedPassage` | Throws on invalid. |
| `tryParsePassage(input)` | `Result<ParsedPassage>` | Discriminated union. |
| `parseAnyPassage(input, opts?)` | `ParsedPassage \| ParsedPassage[]` | URLs, text, share payloads. `multiple: true` for all refs. |
| `findAnyPassage(input, opts?)` | `ParsedPassage \| ParsedPassage[] \| null` | Null instead of throw. |
| `tryParseAnyPassage(input, opts?)` | `Result<ParsedPassage \| ParsedPassage[]>` | Discriminated union. |

**Share payloads**

| Function | Returns | Notes |
|---|---|---|
| `extractSharedCanonical(payload)` | `string \| null` | OSIS canonical only. |
| `parseSharedPassage(payload)` | `ParsedPassage \| null` | |
| `tryParseSharedPassage(payload)` | `Result<ParsedPassage>` | |
| `normalizeSharedPassage(payload, opts?)` | `NormalizedPassage \| null` | Full normalization with route URL. |
| `normalizeAnyPassage(input, opts?)` | `NormalizedPassage \| null` | String input variant. |

**Formatting and routing**

| Function | Returns | Notes |
|---|---|---|
| `formatPassageForDisplay(parsed)` | `string` | e.g. "John 3:16-18" |
| `toCanonicalRef(parsed)` | `string` | OSIS canonical. |
| `toDisplayRef(parsed)` | `string` | Alias of `formatPassageForDisplay`. |
| `toResolverPath(parsed, opts?)` | `string` | e.g. "/jhn.3.16-18" |
| `toResolverUrl(baseUrl, parsed, opts?)` | `string` | Full URL. |
| `parseToCanonicalRef(input)` | `string` | Parse + convert in one call. |
| `parseToDisplayRef(input)` | `string` | |
| `parseToResolverPath(input, opts?)` | `string` | |
| `parseToResolverUrl(baseUrl, input, opts?)` | `string` | |

**Resolver query helpers**

| Function | Returns | Notes |
|---|---|---|
| `normalizeResolverQuery(query)` | `ResolverQuery` | Trims, uppercases translation, validates mode. |
| `parseResolverQuery(searchParams)` | `ResolverQuery` | From `URLSearchParams`. |
| `serializeResolverQuery(query)` | `string` | Query string with leading `?`. |
| `toQueryString(query)` | `string` | Without leading `?`. |
| `ALLOWED_QUERY_KEYS` | `readonly string[]` | `["translation", "lang", "app", "src", "mode"]` |

**Autocomplete**

| Function | Returns | Notes |
|---|---|---|
| `autocompletePassage(input, opts?)` | `AutocompletePassageSuggestion[]` | `limit` default 8, max 50. |

**Book utilities**

| Function | Returns | Notes |
|---|---|---|
| `resolveBookAlias(input)` | `OsisBookCode \| null` | Exact + fuzzy. `null` for ambiguous. |
| `getChapterCount(book)` | `number` | |
| `getVerseCount(book, chapter)` | `number \| null` | |
| `getMaxChapter(book)` | `number` | Alias of `getChapterCount`. |
| `getMaxVerse(book, chapter)` | `number \| null` | Alias of `getVerseCount`. |
| `getBookOrder(book)` | `number` | Genesis = 1, Revelation = 66. |
| `isOsisBookCode(value)` | `value is OsisBookCode` | Type guard. |

**Book data constants**

| Export | Type | Notes |
|---|---|---|
| `OSIS_BOOK_CODES` | `OsisBookCode[]` | 66 codes in order. |
| `OSIS_BOOK_CODE_SET` | `Set<OsisBookCode>` | Fast lookup. |
| `OSIS_BOOK_ORDER` | `ReadonlyMap<OsisBookCode, number>` | 1-based order. |
| `OSIS_BOOK_NAMES` | `Record<OsisBookCode, string>` | Code to display name. |
| `BOOK_CHAPTER_COUNTS` | `Record<OsisBookCode, number>` | |
| `BOOK_VERSE_COUNTS` | `Record<OsisBookCode, number[]>` | Per chapter, 1-indexed. |
| `BOOK_ALIAS_TO_OSIS` | `ReadonlyMap<string, OsisBookCode>` | All aliases incl. fuzzy. |

**Verse context expansion**

| Function | Returns | Notes |
|---|---|---|
| `getVerseContext(ref, opts?)` | `ContextSelection` | Surrounding verses, paragraph-aware. |
| `expandContext(parsed, opts?)` | `VerseWithPara[]` | All verses in a range with para styles. |
| `formatContext(verses)` | `string` | Display string from verse array. |
| `createParagraphStyles(entries)` | `Map<string, ParagraphStyle>` | For `ContextOptions.paragraphStyles`. |

**Paragraph data**

| Function | Returns | Notes |
|---|---|---|
| `getParagraphData(book, chapter)` | `ParagraphEntry[]` | `{ v, s }` per verse. |
| `hasParagraphData(book, chapter)` | `boolean` | |

### Types

<details>
<summary>Full type definitions</summary>

```ts
type OsisBookCode = "GEN" | "EXO" | ... | "REV"; // 66 codes

type SharePayload = {
  url?: string | null;
  text?: string | null;
  title?: string | null;
};

type NormalizedPassage = {
  input: string;
  canonical: string;
  display: string;
  slug: string;
  routePath: string;
  routeUrl: string;
  start: PassagePart;
  end: PassagePart;
  rangeType: PassageRangeType;
  source: { kind: "url" | "text" | "title" | "input"; value: string };
};

type ResolverQuery = {
  translation?: string;
  lang?: string;
  app?: string;
  src?: string;
  mode?: "auto" | "launcher" | "web";
};

type VerseRef = { book: OsisBookCode; chapter: number; verse: number };

type ContextSelection = {
  target: VerseRef;
  before: VerseRef[];
  after: VerseRef[];
  totalVerses: number;
};

type ContextOptions = {
  maxBefore?: number;            // default 3
  maxAfter?: number;             // default 3
  respectBoundaries?: boolean;   // default true
  detectPoetry?: boolean;        // default true
  allowCrossChapter?: boolean;   // default false
  crossChapterLimit?: number;    // default 2
  respectParagraphs?: boolean;   // default true
  paragraphStyles?: Map<string, ParagraphStyle>;
};

type ParagraphStyle =
  | "p" | "m" | "mi" | "pc" | "pmo" | "pmc" | "pmr"
  | "pi" | "pi1" | "pi2" | "pi3"
  | "q" | "q1" | "q2" | "q3" | "q4" | "qc" | "qr" | "d" | "sp"
  | "li" | "li1" | "li2" | "li3" | "li4"
  | "b" | "nb";

type VerseWithPara = VerseRef & { para?: ParagraphStyle };
type ParagraphEntry = { v: number; s: string };

type AutocompletePassageOptions = { limit?: number };
type AutocompletePassageSuggestion = {
  label: string;
  insertText: string;
  canonical: string;
  kind: "book" | "chapter" | "verse" | "range";
};
```

</details>

## Support

- [Buy me a coffee](https://ko-fi.com/dpshade)

## Local development

```bash
pnpm install
pnpm build      # build dist/ via tsup
pnpm test       # run vitest
pnpm typecheck  # tsc --noEmit
pnpm check      # typecheck + tests
```

Node.js 18+ required. Zero runtime dependencies. Dual ESM/CJS output with full TypeScript declarations. CI runs on every push. `prepack` enforces build + typecheck + tests before publish.

## Publishing

Push to `main` (or tag `v<version>`) and the Publish workflow auto-publishes to npm with OIDC provenance. No `NPM_TOKEN` secret needed.

For local publishing:

```bash
pnpm run deploy:npm
```

Runs `prepack` first, bumps patch only when local matches npm latest, then publishes. If publish fails after an automatic bump, the bump is reverted.

2FA accounts: `NPM_TOKEN=... pnpm run deploy:npm` (token with `bypass_2fa=true`), or `NPM_OTP=123456 pnpm run deploy:npm`.

## Notes

- Book aliases use exact matching first, then conservative fuzzy fallback for common misspellings.
- Ambiguous short aliases return `null` rather than guessing.
- Input normalization handles full-width punctuation, Unicode dash variants, invisible characters, and flexible whitespace.
- Paragraph data covers all 66 books and is bundled in the package (zero network calls at runtime).
