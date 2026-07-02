import { formatPassageForDisplay } from "./format";
import { parseAnyPassage } from "./share";
import { serializeResolverQuery, type ResolverQuery } from "./query";
import type { ParsedPassage } from "./types";

export type ResolverPathOptions = {
  suffix?: "launcher" | "web";
};

export type ResolverUrlOptions = ResolverPathOptions & {
  query?: ResolverQuery;
};

function parseInput(input: string | ParsedPassage): ParsedPassage {
  if (typeof input === "string") {
    return parseAnyPassage(input);
  }

  return input;
}

export function toCanonicalRef(parsed: ParsedPassage): string {
  return parsed.canonical;
}

export function toDisplayRef(parsed: ParsedPassage): string {
  return formatPassageForDisplay(parsed);
}

export function toResolverPath(parsed: ParsedPassage, options: ResolverPathOptions = {}): string {
  const canonical = toCanonicalRef(parsed);
  const routeCanonical = canonical.toLowerCase();
  const suffix = options.suffix ? `/${options.suffix}` : "";
  return `/${encodeURIComponent(routeCanonical)}${suffix}`;
}

export function toResolverUrl(baseUrl: string | URL, parsed: ParsedPassage, options: ResolverUrlOptions = {}): string {
  const path = toResolverPath(parsed, { suffix: options.suffix });
  const url = new URL(path, baseUrl);
  const query = serializeResolverQuery(options.query ?? {});
  if (query) {
    url.search = query.slice(1);
  }

  return url.toString();
}

export function parseToCanonicalRef(input: string | ParsedPassage): string {
  return toCanonicalRef(parseInput(input));
}

export function parseToDisplayRef(input: string | ParsedPassage): string {
  return toDisplayRef(parseInput(input));
}

export function parseToResolverPath(input: string | ParsedPassage, options: ResolverPathOptions = {}): string {
  return toResolverPath(parseInput(input), options);
}

export function parseToResolverUrl(baseUrl: string | URL, input: string | ParsedPassage, options: ResolverUrlOptions = {}): string {
  return toResolverUrl(baseUrl, parseInput(input), options);
}
