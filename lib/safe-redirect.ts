const DEFAULT_REDIRECT_PATH = "/lessons";
const MAX_REDIRECT_PATH_LENGTH = 2048;

function isUnsafePrefixedPath(path: string): boolean {
  return path.startsWith("//") || path.startsWith("/\\");
}

function normalizeFallbackPath(fallback: string): string {
  if (!fallback.startsWith("/") || isUnsafePrefixedPath(fallback)) {
    return DEFAULT_REDIRECT_PATH;
  }

  return fallback;
}

export function sanitizeInternalRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT_PATH,
): string {
  const safeFallback = normalizeFallbackPath(fallback);

  if (!candidate) {
    return safeFallback;
  }

  const trimmed = candidate.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_REDIRECT_PATH_LENGTH ||
    trimmed.includes("\r") ||
    trimmed.includes("\n")
  ) {
    return safeFallback;
  }

  if (!trimmed.startsWith("/") || isUnsafePrefixedPath(trimmed)) {
    return safeFallback;
  }

  try {
    const parsed = new URL(trimmed, "https://codeforge.local");

    if (parsed.origin !== "https://codeforge.local") {
      return safeFallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}

export function buildAuthPath(
  authRoute: "/login" | "/signup",
  nextPath: string | null | undefined,
): string {
  const safeNextPath = sanitizeInternalRedirectPath(nextPath);
  return `${authRoute}?next=${encodeURIComponent(safeNextPath)}`;
}
