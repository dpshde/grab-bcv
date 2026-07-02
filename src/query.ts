export type ResolverMode = "auto" | "launcher" | "web";

export type ResolverQuery = {
  translation?: string;
  lang?: string;
  app?: string;
  src?: string;
  mode?: ResolverMode;
};

export const ALLOWED_QUERY_KEYS = ["translation", "lang", "app", "src", "mode"] as const;

const MODE_SET = new Set<ResolverMode>(["auto", "launcher", "web"]);

function compactFromSearch(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function compactFromQuery(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeResolverMode(mode: string | undefined): ResolverMode | undefined {
  return mode && MODE_SET.has(mode as ResolverMode) ? (mode as ResolverMode) : undefined;
}

function normalizeResolverQueryInput(query: ResolverQuery): ResolverQuery {
  const mode = compactFromQuery(query.mode);

  return {
    translation: compactFromQuery(query.translation)?.toUpperCase(),
    lang: compactFromQuery(query.lang),
    app: compactFromQuery(query.app),
    src: compactFromQuery(query.src),
    mode: normalizeResolverMode(mode)
  };
}

export function parseResolverQuery(searchParams: URLSearchParams): ResolverQuery {
  const mode = compactFromSearch(searchParams.get("mode"));

  return {
    translation: compactFromSearch(searchParams.get("translation"))?.toUpperCase(),
    lang: compactFromSearch(searchParams.get("lang")),
    app: compactFromSearch(searchParams.get("app")),
    src: compactFromSearch(searchParams.get("src")),
    mode: normalizeResolverMode(mode)
  };
}

export function normalizeResolverQuery(searchParams: URLSearchParams): ResolverQuery {
  return parseResolverQuery(searchParams);
}

export function serializeResolverQuery(query: ResolverQuery): string {
  const normalized = normalizeResolverQueryInput(query);
  const params = new URLSearchParams();
  if (normalized.translation) {
    params.set("translation", normalized.translation);
  }
  if (normalized.lang) {
    params.set("lang", normalized.lang);
  }
  if (normalized.app) {
    params.set("app", normalized.app);
  }
  if (normalized.src) {
    params.set("src", normalized.src);
  }
  if (normalized.mode && normalized.mode !== "auto") {
    params.set("mode", normalized.mode);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function toQueryString(query: ResolverQuery): string {
  return serializeResolverQuery(query);
}
