# grab-bcv

Parse and normalize Bible passage references from natural text, OSIS strings, and shared links.

## Install

```bash
pnpm add grab-bcv
```

## Usage

```ts
import {
  parseToCanonicalRef,
  parseToDisplayRef,
  parseToResolverPath,
  parseToResolverUrl,
  findAnyPassage,
  parsePassage,
  parseAnyPassage,
  tryParseAnyPassage,
  formatPassageForDisplay,
  autocompletePassage
} from "grab-bcv";

const parsed = parsePassage("John 3:16-18");
parsed.canonical; // "JHN.3.16-18"
parsed.rangeType; // "same_chapter"

formatPassageForDisplay(parsed); // "John 3:16-18"

parseToCanonicalRef("logosres:bible+niv.61.3.16"); // "JHN.3.16"
parseToDisplayRef("JHN.3.16-18"); // "John 3:16-18"
parseToResolverPath("John 3:16-18"); // "/jhn.3.16-18"
parseToResolverUrl("https://www.route.bible", "John 3:16-18"); // "https://www.route.bible/jhn.3.16-18"

parseAnyPassage("https://www.bible.com/bible/111/JHN.3.16");
// ParsedPassage (throws PassageParseError on invalid input)

parseAnyPassage("Read John 3:16 and Romans 8:28", { multiple: true }).map((p) => p.canonical);
// ["JHN.3.16", "ROM.8.28"]

findAnyPassage("not a passage");
// null

tryParseAnyPassage("Read John 3:16 and Romans 8:28", { multiple: true });
// { ok: true, value: ParsedPassage[] }

autocompletePassage("john 3:1", { limit: 3 });
// [
//   { label: "John 3:1", insertText: "John 3:1", canonical: "JHN.3.1", kind: "verse" },
//   { label: "John 3:10", insertText: "John 3:10", canonical: "JHN.3.10", kind: "verse" },
//   { label: "John 3:11", insertText: "John 3:11", canonical: "JHN.3.11", kind: "verse" }
// ]
```

## API

- `parsePassage(input: string): ParsedPassage`
- `tryParsePassage(input: string): { ok: true; value: ParsedPassage } | { ok: false; error: PassageParseError }`
- `parseAnyPassage(input: string, options?: { multiple?: boolean }): ParsedPassage | ParsedPassage[]`
- `findAnyPassage(input: string, options?: { multiple?: boolean }): ParsedPassage | ParsedPassage[] | null`
- `tryParseAnyPassage(input: string, options?: { multiple?: boolean }): { ok: true; value: ParsedPassage | ParsedPassage[] } | { ok: false; error: PassageParseError }`
- `extractSharedCanonical(payload: SharePayload): string | null`
- `parseSharedPassage(payload: SharePayload): ParsedPassage | null`
- `tryParseSharedPassage(payload: SharePayload): { ok: true; value: ParsedPassage } | { ok: false; error: PassageParseError }`
- `formatPassageForDisplay(parsed: ParsedPassage): string`
- `toCanonicalRef(parsed: ParsedPassage): string`
- `toDisplayRef(parsed: ParsedPassage): string`
- `toResolverPath(parsed: ParsedPassage, options?): string`
- `toResolverUrl(baseUrl: string | URL, parsed: ParsedPassage, options?): string`
- `parseToCanonicalRef(input: string | ParsedPassage): string`
- `parseToDisplayRef(input: string | ParsedPassage): string`
- `parseToResolverPath(input: string | ParsedPassage, options?): string`
- `parseToResolverUrl(baseUrl: string | URL, input: string | ParsedPassage, options?): string`
- `autocompletePassage(input: string, options?: { limit?: number }): Array<{ label: string; insertText: string; canonical: string; kind: "book" | "chapter" | "verse" | "range" }>`
- `resolveBookAlias(input: string): OsisBookCode | null`
- `getChapterCount(book: OsisBookCode): number`
- `getVerseCount(book: OsisBookCode, chapter: number): number | null`
- `OSIS_BOOK_CODES`, `OSIS_BOOK_NAMES`, `BOOK_CHAPTER_COUNTS`, `BOOK_VERSE_COUNTS`

## Support

- [Buy me a coffee](https://ko-fi.com/dpshade)

## Local Development

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Production Readiness

- Node.js `18+` is required.
- CI runs on push and pull requests via GitHub Actions.
- `prepack` enforces build + typecheck + tests before publish.
- npm publishing supports both local deploy scripts and GitHub Actions (with provenance).

## Deploy

1. Publish npm package: `pnpm run deploy:npm`.
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
- Tag-based releases use `v<package.json version>`, for example `v0.1.5`.
- Pushes to `master`/`main` also auto-publish when `package.json` is newer than npm.
- The workflow also supports manual `workflow_dispatch`; if the current version is already on npm it exits cleanly without republishing.

## Notes

- Book aliases use exact matching first, then conservative fuzzy fallback for common misspellings.
- Ambiguous short aliases return `null`.
