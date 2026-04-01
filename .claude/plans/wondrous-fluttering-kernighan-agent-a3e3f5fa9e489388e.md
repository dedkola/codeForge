# Implementation Plan: Password Protection for Code-Server Pods

## Problem Statement

Code-server pods run with `--auth=none`. If someone bypasses cs-proxy (e.g., via the k3s node IP at `k3s.tkweb.site`, a misconfigured default ingress backend, or because flannel does not enforce NetworkPolicy), they get unauthenticated shell access to every user pod.

## Chosen Approach: Deterministic Per-User Password + Transparent Proxy Login

**Option B** from the design considerations: derive a per-user password deterministically from `CS_PROXY_SECRET` and the user slug using HMAC. The proxy performs a one-time transparent login to code-server on the user's behalf, caches the session cookie, and injects it into all subsequent proxied requests.

### Why this approach

- **No additional storage**: passwords are derived from existing secret material and the slug.
- **Per-user granularity**: compromising one password does not unlock other users' pods.
- **Reliable**: performs the real code-server login flow rather than reverse-engineering internal session cookie formats that may change across code-server versions.
- **Defense-in-depth**: even if the proxy is bypassed entirely, the attacker faces a password prompt.

---

## Step-by-Step Implementation

### Step 1: Add password derivation utility

**File to create**: `lib/code-server-password.ts`

```typescript
import { createHmac } from "crypto";

/**
 * Derive a deterministic password for a code-server pod.
 * password = HMAC-SHA256(CS_PROXY_SECRET, "cs-pod-password:" + slug), hex-encoded.
 */
export function deriveCodeServerPassword(slug: string): string {
  const secret = process.env.CS_PROXY_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("CS_PROXY_SECRET or BETTER_AUTH_SECRET must be set");
  return createHmac("sha256", secret)
    .update(`cs-pod-password:${slug}`)
    .digest("hex");
}
```

This gives a 64-character hex string per user -- strong enough, deterministic, and derived from the existing `CS_PROXY_SECRET`.

---

### Step 2: Modify pod creation to enable password auth

**File to modify**: `/Users/kolasokol/Code/codeForge/lib/code-server-k8s.ts`

Changes in `createPod()`:

1. Import `deriveCodeServerPassword` from the new utility.
2. Change `--auth=none` to `--auth=password` on line 87.
3. Add a `PASSWORD` environment variable to the container spec, set to `deriveCodeServerPassword(slug)`.

The container spec `args` array becomes:
```
["--bind-addr=0.0.0.0:80", "--auth=password", "--disable-telemetry", "/home/coder/project"]
```

The `env` array becomes:
```
[
  { name: "HOME", value: "/home/coder" },
  { name: "PASSWORD", value: deriveCodeServerPassword(slug) },
]
```

**Important consideration**: The password is set at pod creation time. Since `createPod` short-circuits if the pod already exists (line 66-68), existing pods will keep `--auth=none` until they are recycled. This is acceptable -- the cleanup CronJob will eventually stop stale pods, and new pods get the password. For an immediate fix on running pods, a one-time rollout script could delete and recreate all user pods.

---

### Step 3: Add transparent login logic to cs-proxy

**File to modify**: `/Users/kolasokol/Code/codeForge/cs-proxy/server.js`

This is the most complex change. The proxy needs to:

1. **Derive the same password** for each slug (duplicate the HMAC logic in plain Node.js since cs-proxy is a CommonJS Node app, not TypeScript).
2. **On first proxied request for a slug**, POST to the code-server pod's `/login` endpoint with the password, capture the `key` session cookie from the response.
3. **Cache the cookie** in a Map keyed by slug.
4. **Inject the cookie** into all subsequent proxied requests for that slug.
5. **Handle cookie expiry**: if code-server returns 401/302-to-login, clear the cached cookie and re-login.

#### Detailed changes to `server.js`:

**A. Add crypto import and password derivation at the top:**

```javascript
const crypto = require("crypto");

function deriveCodeServerPassword(slug) {
  const raw = process.env.CS_PROXY_SECRET;
  if (!raw) throw new Error("CS_PROXY_SECRET must be set");
  return crypto.createHmac("sha256", raw)
    .update(`cs-pod-password:${slug}`)
    .digest("hex");
}
```

**B. Add a cookie cache and login function:**

```javascript
// Map<slug, string> -- cached "key=<value>" cookie strings
const csSessionCache = new Map();

/**
 * Perform a transparent login to code-server and return the session cookie.
 * POST /login with password as form data.
 * code-server expects: Content-Type: application/x-www-form-urlencoded
 *                      body: password=<password>
 * On success: 302 redirect with Set-Cookie: key=<value>
 */
async function loginToCodeServer(slug, svc) {
  const password = deriveCodeServerPassword(slug);
  const target = buildTarget(svc);
  const body = `password=${encodeURIComponent(password)}`;

  return new Promise((resolve, reject) => {
    const url = new URL(`${target}/login`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: "/login",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      const setCookieHeaders = res.headers["set-cookie"] || [];
      for (const header of setCookieHeaders) {
        const match = header.match(/^key=([^;]+)/);
        if (match) {
          const cookie = `key=${match[1]}`;
          csSessionCache.set(slug, cookie);
          resolve(cookie);
          return;
        }
      }
      // Consume body to free socket
      res.resume();
      reject(new Error(`Login to code-server failed: status ${res.statusCode}`));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
```

**C. Add a helper to ensure a valid session cookie exists:**

```javascript
async function ensureCsSession(slug, svc) {
  let cookie = csSessionCache.get(slug);
  if (cookie) return cookie;
  return loginToCodeServer(slug, svc);
}
```

**D. Modify the HTTP request handler (lines 125-154) to inject the cookie:**

In the `server.on("request", ...)` handler, after JWT validation succeeds and before calling `proxy.web()`, inject the code-server session cookie:

```javascript
// After resolveSession succeeds and sanitizeRequestUrlForUpstream is called:
try {
  const csCookie = await ensureCsSession(route.slug, payload.svc);
  // Append code-server session cookie to existing cookies
  const existingCookies = req.headers.cookie || "";
  req.headers.cookie = existingCookies
    ? `${existingCookies}; ${csCookie}`
    : csCookie;
} catch (err) {
  console.error(`Failed to login to code-server for slug ${route.slug}:`, err.message);
  // Fall through -- code-server will show its own login page as last resort
}
```

**E. Modify the WebSocket upgrade handler (lines 156-172) similarly:**

WebSocket connections also need the cookie injected. Same pattern: call `ensureCsSession`, inject into `req.headers.cookie`.

**F. Handle session invalidation:**

Add a `proxyRes` event listener to detect when code-server rejects the cached cookie (e.g., pod was restarted and the session is gone):

```javascript
proxy.on("proxyRes", (proxyRes, req) => {
  // If code-server redirects to /login, the cached session is stale
  if (proxyRes.statusCode === 302) {
    const location = proxyRes.headers.location || "";
    if (location.includes("/login")) {
      // Extract slug from the original request
      const route = parseRoute(req.originalUrl || req.url);
      if (route) {
        csSessionCache.delete(route.slug);
      }
    }
  }
});
```

Note: `req.url` is already rewritten by `sanitizeRequestUrlForUpstream`, so we need to store the original URL. Add `req.originalUrl = req.url;` before sanitization.

---

### Step 4: Handle pod restarts and readiness

When a code-server pod restarts, it gets a new in-memory session store, invalidating cached cookies. The `proxyRes` handler in Step 3F handles this by clearing the cache on redirect-to-login. The next request will trigger a fresh transparent login.

Additionally, code-server's `/healthz` endpoint does not require authentication, so readiness/liveness probes in the pod spec (lines 100-108 of code-server-k8s.ts) continue to work unchanged.

---

### Step 5: Configuration changes

**No new environment variables needed**. The password is derived from the existing `CS_PROXY_SECRET`, which is already available to both the Next.js app and cs-proxy.

**Files to verify/update**:
- `/Users/kolasokol/Code/codeForge/.env.local.example` -- add a comment noting CS_PROXY_SECRET is now also used for code-server pod passwords
- `/Users/kolasokol/Code/codeForge/k8s/base/cs-proxy/deployment.yaml` -- no changes needed, CS_PROXY_SECRET already passed to cs-proxy

---

### Step 6: Rebuild and deploy

1. Rebuild the cs-proxy Docker image (includes modified `server.js`).
2. Update the image tag in `k8s/base/cs-proxy/deployment.yaml`.
3. Deploy. New code-server pods will be created with `--auth=password`. Existing pods remain on `--auth=none` until recycled.
4. To force-rotate all pods immediately (optional): delete all user pods so they get recreated with password auth on next access.

---

## Testing Plan

### Unit / Local Testing

1. **Password derivation consistency**: Write a test that calls `deriveCodeServerPassword("abc123def456")` with a known `CS_PROXY_SECRET` and asserts the output matches the same HMAC computed independently. Verify the TypeScript and JavaScript implementations produce identical output.

2. **Pod spec generation**: Mock `coreV1Api.createNamespacedPod` and verify that `createPod()` now includes `--auth=password` in args and `PASSWORD` in env.

### Integration Testing (against a local k3s or kind cluster)

3. **Direct access blocked**: Start a code-server pod with the new config. Port-forward to it directly (bypassing cs-proxy). Verify it shows the password login page, not the IDE.

4. **Correct password works**: Submit the derived password to the login form on the port-forwarded pod. Verify access is granted.

5. **Wrong password rejected**: Submit an incorrect password. Verify access is denied.

6. **Proxy transparent login**: Access via cs-proxy with a valid JWT. Verify:
   - The IDE loads without any password prompt (seamless experience).
   - The proxy makes a POST to `/login` on first access.
   - Subsequent requests reuse the cached cookie (check proxy logs or add debug logging).

7. **WebSocket works**: Open a terminal in code-server through the proxy. Verify the terminal session works (WebSocket upgrade carries the session cookie).

8. **Pod restart recovery**: Delete the user's code-server pod while cs-proxy is running. Wait for it to be recreated. Access via cs-proxy again. Verify the proxy detects the stale cookie, re-logs in, and the IDE loads successfully.

### Security Testing

9. **Bypass scenario**: Access code-server at `k3s.tkweb.site` (the direct node IP route that currently works unauthenticated). Verify a password prompt is displayed.

10. **Cross-user isolation**: Derive the password for user A's slug and try it against user B's pod. Verify it fails (each pod has a unique password).

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Existing running pods still have `--auth=none` | The cleanup CronJob recycles stale pods. For immediate fix, manually delete all user pods. |
| code-server changes its login flow in a future version | Pin the image version (`codercom/code-server:4.105.2` is already pinned in config). Test login flow on version upgrades. |
| Transparent login adds latency on first request | The POST to `/login` is to localhost within the cluster (sub-millisecond network). Cookie is cached, so only first request per slug is affected. |
| `CS_PROXY_SECRET` rotation breaks derived passwords | Already an issue for JWT tokens. Document that secret rotation requires pod recreation. |
| code-server session cookie expires | The `proxyRes` handler detects redirect-to-login and re-authenticates automatically. |

---

## File Change Summary

| File | Change Type | Description |
|------|------------|-------------|
| `lib/code-server-password.ts` | **New file** | HMAC-based password derivation utility |
| `lib/code-server-k8s.ts` | Modify | Change `--auth=none` to `--auth=password`, add `PASSWORD` env var |
| `cs-proxy/server.js` | Modify | Add password derivation, transparent login, cookie injection, session cache |
| `.env.local.example` | Modify | Add comment about CS_PROXY_SECRET dual use |

