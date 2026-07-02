# grab-bcv Agent Guide

## Purpose

Guidance for working inside the standalone `grab-bcv` repository.

## Package Role

`grab-bcv` parses and normalizes Bible references from natural text, OSIS strings, and shared links. It is a dependency-free TypeScript library published to npm and consumed by external apps.

## Architecture Snapshot

- Self-contained TypeScript parser/normalizer with no runtime dependencies.
- Produces dual ESM/CJS + type declarations via `tsup`.
- Public API surface is re-exported from `src/index.ts`.

## Source Modules

| File | Responsibility |
|---|---|
| `src/index.ts` | Public API barrel. All exports flow through here. |
| `src/parser.ts` | Core reference parser. Handles natural text ("John 3:16-18"), OSIS canonical ("JHN.3.16"), OSIS ranges ("JHN.3.16-JHN.4.2"), numbered books, cross-book ranges. Normalizes input (full-width punctuation, Unicode dashes, invisible characters). |
| `src/types.ts` | Type definitions (`ParsedPassage`, `PassagePart`, `PassageRangeType`, `PassageParseError`, `PassageCapErrorDetails`). |
| `src/books.ts` | Book metadata: OSIS codes, names, chapter/verse counts, alias resolution (exact + fuzzy), book ordering. |
| `src/share.ts` | Share-payload and any-passage parsing. URL parsing for Bible.com, BibleGateway, Logos, Enduring Word, Route Bible. `normalizeSharedPassage` / `normalizeAnyPassage` produce `NormalizedPassage`. |
| `src/helpers.ts` | Convenience wrappers: `parseToCanonicalRef`, `parseToDisplayRef`, `parseToResolverPath`, `parseToResolverUrl`, plus non-parsing equivalents. |
| `src/query.ts` | Resolver query types and helpers (`ResolverQuery`, `parseResolverQuery`, `serializeResolverQuery`, `normalizeResolverQuery`). |
| `src/format.ts` | `formatPassageForDisplay` -- converts `ParsedPassage` to human-readable string. |
| `src/autocomplete.ts` | Type-ahead autocomplete engine. Returns ranked book/chapter/verse/range suggestions. |
| `src/verse-context-expansion.ts` | Paragraph-aware verse context expansion (`getVerseContext`, `expandContext`, `formatContext`, `createParagraphStyles`). |
| `src/para-data.ts` | Client-side paragraph metadata accessor (`getParagraphData`, `hasParagraphData`). |
| `src/para-data.json` | Bundled paragraph data for all 66 books (278 KB). Styles: `p`, `m`, `q1`-`q4`, `li`, `d`, `sp`, etc. |
| `src/normalize-intake.ts` | Input normalization: NFKC, full-width punctuation, Unicode dash variants, invisible characters. Not exported from index (internal). |
| `src/parse.ts` | Sub-path entry for `/parse` -- re-exports `parsePassage`, `tryParsePassage`, `parseAnyPassage`, `tryParseAnyPassage`. |
| `src/find.ts` | Sub-path entry for `/find` -- re-exports `findAnyPassage`. |

## Key Types

- `ParsedPassage`: the central parse result with `canonical`, `start`, `end`, `rangeType`.
- `PassageParseError`: typed error with `code` (`EMPTY`, `INVALID_FORMAT`, `INVALID_BOOK`, `INVALID_NUMBER`, `REVERSED_RANGE`) and optional `details` for cap violations.
- `NormalizedPassage`: full normalization output with `canonical`, `display`, `slug`, `routePath`, `routeUrl`, `source`.
- `SharePayload`: `{ url?, text?, title? }` input shape for share-intent parsing.

## Parsing Pipeline

1. `normalizePassageIntakeText` (NFKC + full-width punctuation + dash normalization).
2. Try OSIS canonical regex (`/^[1-3]?[A-Z]{2,}\.\d+(\.\d+)?(-...)?$/`).
3. Try natural-language regex with book alias resolution (exact match first, then fuzzy).
4. For any-passage / share: extract candidate tokens from URLs and text, score by specificity, select best canonical.

## Navigation

- Source: `src/`
- Tests: `tests/` (vitest include glob) and legacy `test/`
- Release script: `scripts/deploy-npm.mjs`
- Build artifacts: `dist/` (generated)
- CI workflows: `.github/workflows/` (`ci.yml`, `publish.yml`)

## Command Matrix

- Build: `pnpm run build`
- Typecheck: `pnpm run typecheck`
- Tests: `pnpm run test`
- Full validation: `pnpm run check` (typecheck + tests)
- Publish (explicit request only): `pnpm run deploy:npm`

## Version Control Rules

- Preserve exported API stability unless breaking changes are explicitly requested.
- For behavior changes, add or update tests in the same change.
- Bump `package.json` version before publishing a release.
- The `index.ts` barrel is the source of truth for the public API. Do not export new functions without documenting them in `README.md`.

## Deploy and Release Guidance

- `deploy:npm` requires authenticated npm access; never run it by default.
- `prepack` enforces build + typecheck + tests before publish.
- Ensure `pnpm run check` passes before any release action.
- GitHub Actions publish workflow uses OIDC trusted publishing with `--provenance`. No `NPM_TOKEN` secret is needed; the `unset NODE_AUTH_TOKEN` line in the workflow is intentional.

## Done Checklist

- Run `pnpm run check`.
- Confirm public API compatibility for parser changes.
- Update `README.md` API section if exports change.
- Add or update tests for any behavior change.
