import { NAMESPACE } from "./k8s";
import { CODE_SERVER_DOMAIN } from "./code-server-config";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const CLOUDFLARE_TUNNEL_ID = process.env.CLOUDFLARE_TUNNEL_ID ?? "";

interface IngressRule {
  hostname?: string;
  service: string;
  path?: string;
  originRequest?: Record<string, unknown>;
}

interface TunnelConfig {
  ingress: IngressRule[];
  originRequest?: Record<string, unknown>;
  "warp-routing"?: { enabled: boolean };
}

interface TunnelConfigResponse {
  success: boolean;
  result?: {
    config?: TunnelConfig;
  };
  errors?: Array<{ code: number; message: string }>;
}

function cfHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function configUrl(): string {
  return `${CF_API_BASE}/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations`;
}

/** Build the hostname for a code-server instance. */
export function tunnelHostname(slug: string): string {
  return `cs-${slug}.${CODE_SERVER_DOMAIN}`;
}

/** Build the in-cluster service URL that cloudflared routes to. */
function serviceUrl(slug: string): string {
  return `http://cs-svc-${slug}.${NAMESPACE}.svc.cluster.local:80`;
}

/** Fetch the current tunnel configuration from Cloudflare API. */
async function getTunnelConfig(): Promise<TunnelConfig> {
  const res = await fetch(configUrl(), {
    method: "GET",
    headers: cfHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Cloudflare GET tunnel config failed (${res.status}): ${body}`,
    );
  }

  const data: TunnelConfigResponse = await res.json();
  if (!data.success || !data.result?.config) {
    throw new Error(
      `Cloudflare GET tunnel config error: ${JSON.stringify(data.errors)}`,
    );
  }

  return data.result.config;
}

/** Replace the entire tunnel configuration via Cloudflare API. */
async function putTunnelConfig(config: TunnelConfig): Promise<void> {
  const res = await fetch(configUrl(), {
    method: "PUT",
    headers: cfHeaders(),
    body: JSON.stringify({ config }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Cloudflare PUT tunnel config failed (${res.status}): ${body}`,
    );
  }

  const data: TunnelConfigResponse = await res.json();
  if (!data.success) {
    throw new Error(
      `Cloudflare PUT tunnel config error: ${JSON.stringify(data.errors)}`,
    );
  }
}

/**
 * Add a tunnel route for a code-server instance.
 * Idempotent — if the hostname already exists, this is a no-op.
 */
export async function addTunnelRoute(slug: string): Promise<void> {
  const hostname = tunnelHostname(slug);
  const config = await getTunnelConfig();

  // Check if route already exists
  if (config.ingress.some((r) => r.hostname === hostname)) {
    return;
  }

  // The last rule must always be the catch-all (no hostname).
  // Insert the new route before the catch-all.
  const catchAll = config.ingress.findIndex((r) => !r.hostname);
  const newRule: IngressRule = {
    hostname,
    service: serviceUrl(slug),
    originRequest: {
      // WebSocket support for code-server terminal & editor
      noTLSVerify: false,
    },
  };

  if (catchAll >= 0) {
    config.ingress.splice(catchAll, 0, newRule);
  } else {
    // No catch-all found — append rule then add a catch-all
    config.ingress.push(newRule);
    config.ingress.push({ service: "http_status:404" });
  }

  await putTunnelConfig(config);
}

/**
 * Remove a tunnel route for a code-server instance.
 * Idempotent — if the hostname doesn't exist, this is a no-op.
 */
export async function removeTunnelRoute(slug: string): Promise<void> {
  const hostname = tunnelHostname(slug);
  const config = await getTunnelConfig();

  const idx = config.ingress.findIndex((r) => r.hostname === hostname);
  if (idx < 0) {
    return; // already gone
  }

  config.ingress.splice(idx, 1);
  await putTunnelConfig(config);
}
