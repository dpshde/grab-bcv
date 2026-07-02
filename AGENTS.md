<coding_guidelines>
# grab-bcv Agent Guide

## Purpose

Guidance for working inside the standalone `grab-bcv` repository.

## Package Role

`grab-bcv` parses and normalizes Bible references from natural text, OSIS strings, and shared links. It is a dependency-free TypeScript library published to npm and consumed by external apps.

## Architecture Snapshot

- Self-contained TypeScript parser/normalizer with no runtime dependencies.
- Produces dual ESM/CJS + type declarations via `tsup`.
- Public API surface is re-exported from `src/index.ts`.

## Navigation

- Source: `src/`
- Tests: `tests/` (vitest include glob) and legacy `test/`
- Release script: `scripts/deploy-npm.mjs`
- Build artifacts: `dist/` (generated)

## Command Matrix

- Build: `pnpm run build`
- Typecheck: `pnpm run typecheck`
- Tests: `pnpm run test`
- Full validation: `pnpm run check`
- Publish (explicit request only): `pnpm run deploy:npm`

## Version Control Rules

- Preserve exported API stability unless breaking changes are explicitly requested.
- For behavior changes, add or update tests in the same change.
- Bump `package.json` version before publishing a release.

## Deploy and Release Guidance

- `deploy:npm` requires authenticated npm access; never run it by default.
- `prepack` enforces build + typecheck + tests before publish.
- Ensure `pnpm run check` passes before any release action.

## Done Checklist

- Run `pnpm run check`.
- Confirm public API compatibility for parser changes.
</coding_guidelines>
