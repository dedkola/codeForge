import { createHmac } from "crypto";

function getRawSecret(): string {
  const secret = process.env.CS_PROXY_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret)
    throw new Error("CS_PROXY_SECRET or BETTER_AUTH_SECRET must be set");
  return secret;
}

/**
 * Derive a deterministic per-user password for code-server.
 * Result is a 64-char hex string (SHA-256 HMAC).
 */
export function deriveCodeServerPassword(slug: string): string {
  return createHmac("sha256", getRawSecret())
    .update(`cs-pod-password:${slug}`)
    .digest("hex");
}
