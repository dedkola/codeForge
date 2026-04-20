function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function requirePositiveInt(name: string): number {
  const raw = requireEnv(name);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Env var ${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const CODE_SERVER_IMAGE = requireEnv("CODE_SERVER_IMAGE");
export const CODE_SERVER_IMAGE_PULL_SECRET = optionalEnv(
  "CODE_SERVER_IMAGE_PULL_SECRET",
);
export const CODE_SERVER_STORAGE_CLASS = requireEnv(
  "CODE_SERVER_STORAGE_CLASS",
);
export const CODE_SERVER_PVC_SIZE = requireEnv("CODE_SERVER_PVC_SIZE");
export const CODE_SERVER_MAX_IDLE_MINUTES = requirePositiveInt(
  "CODE_SERVER_MAX_IDLE_MINUTES",
);
export const CODE_SERVER_POD_READY_TIMEOUT_MS = requirePositiveInt(
  "CODE_SERVER_POD_READY_TIMEOUT_MS",
);
export const CODE_SERVER_PORT = requirePositiveInt("CODE_SERVER_PORT");
export const CODE_SERVER_DOMAIN = requireEnv("CODE_SERVER_DOMAIN");
export const CODE_SERVER_TLS_SECRET = requireEnv("CODE_SERVER_TLS_SECRET");
export const CODE_SERVER_INGRESS_CLASS = requireEnv(
  "CODE_SERVER_INGRESS_CLASS",
);
export const CODE_SERVER_CLUSTER_ISSUER = requireEnv(
  "CODE_SERVER_CLUSTER_ISSUER",
);
export const CODE_SERVER_MEMORY_REQUEST = requireEnv(
  "CODE_SERVER_MEMORY_REQUEST",
);
export const CODE_SERVER_CPU_REQUEST = requireEnv("CODE_SERVER_CPU_REQUEST");
export const CODE_SERVER_MEMORY_LIMIT = requireEnv("CODE_SERVER_MEMORY_LIMIT");
export const CODE_SERVER_CPU_LIMIT = requireEnv("CODE_SERVER_CPU_LIMIT");
export const CODE_SERVER_CLEANUP_SECRET = requireEnv(
  "CODE_SERVER_CLEANUP_SECRET",
);

const LESSON_SLUG_RE = /^[a-z0-9-]+$/;

export function buildCodeServerHost(slug: string): string {
  return `${slug}.${CODE_SERVER_DOMAIN}`;
}

function normalizeLessonSlug(lessonSlug?: string): string | undefined {
  if (!lessonSlug) return undefined;
  if (!LESSON_SLUG_RE.test(lessonSlug)) return undefined;
  return lessonSlug;
}

export function buildWorkspaceFolder(
  resetCount: number = 0,
  lessonSlug?: string,
): string {
  const workspaceRoot = `/home/coder/ws-${resetCount}`;
  const normalizedLessonSlug = normalizeLessonSlug(lessonSlug);

  if (!normalizedLessonSlug) {
    return workspaceRoot;
  }

  return `${workspaceRoot}/lessons/${normalizedLessonSlug}`;
}

export function buildCodeServerUrl(
  slug: string,
  resetCount: number = 0,
  lessonSlug?: string,
): string {
  const params = new URLSearchParams({
    folder: buildWorkspaceFolder(resetCount, lessonSlug),
  });

  return `https://${buildCodeServerHost(slug)}/?${params.toString()}`;
}
