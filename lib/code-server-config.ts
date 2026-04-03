function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const CODE_SERVER_IMAGE =
  process.env.CODE_SERVER_IMAGE ?? "ghcr.io/coder/code-server:4.105.2";

export const CODE_SERVER_STORAGE_CLASS =
  process.env.CODE_SERVER_STORAGE_CLASS ?? "local-path";

export const CODE_SERVER_PVC_SIZE = process.env.CODE_SERVER_PVC_SIZE ?? "1Gi";

export const CODE_SERVER_MAX_IDLE_MINUTES = parsePositiveInt(
  process.env.CODE_SERVER_MAX_IDLE_MINUTES,
  120,
);

export const CODE_SERVER_POD_READY_TIMEOUT_MS = parsePositiveInt(
  process.env.CODE_SERVER_POD_READY_TIMEOUT_MS,
  15000,
);

export const CODE_SERVER_DOMAIN =
  process.env.CODE_SERVER_DOMAIN ?? "tkweb.site";

export const CODE_SERVER_CLEANUP_SECRET =
  process.env.CODE_SERVER_CLEANUP_SECRET ?? "";

export function buildCodeServerUrl(slug: string): string {
  return `https://cs-${slug}.${CODE_SERVER_DOMAIN}`;
}
