const http = require("http");
const { createHmac } = require("crypto");
const httpProxy = require("http-proxy");
const { jwtVerify } = require("jose");
const { parse: parseUrl } = require("url");
const { parse: parseCookie } = require("./cookie");

const PORT = process.env.PORT || 8080;
const NAMESPACE = process.env.NAMESPACE || "codelearn";
const RAW_SECRET = process.env.CS_PROXY_SECRET;
const secret = new TextEncoder().encode(RAW_SECRET);

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (matches JWT expiry)
const CS_COOKIE_TTL_MS = 10 * 60 * 1000; // 10 min TTL for code-server session cookies
const LOGIN_RETRY_COUNT = 3;
const LOGIN_RETRY_DELAY_MS = 1000;

/* ── Per-user password derivation (mirrors lib/code-server-password.ts) ── */

function derivePassword(slug) {
  return createHmac("sha256", RAW_SECRET)
    .update(`cs-pod-password:${slug}`)
    .digest("hex");
}

/* ── In-memory session store (fallback when third-party cookies are blocked) ── */

/**
 * slug → { svc, userId, rawToken, expiresAt }
 * Used when the browser blocks the cs_session cookie (cross-origin iframe).
 */
const activeSessions = new Map();

function upsertActiveSession(slug, payload) {
  activeSessions.set(slug, {
    svc: payload.svc,
    userId: payload.userId,
    rawToken: payload.rawToken,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

function getActiveSession(slug) {
  const entry = activeSessions.get(slug);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    activeSessions.delete(slug);
    return null;
  }
  return entry;
}

// Periodically clean expired sessions (every 5 min)
setInterval(
  () => {
    const now = Date.now();
    for (const [slug, entry] of activeSessions) {
      if (now > entry.expiresAt) activeSessions.delete(slug);
    }
  },
  5 * 60 * 1000,
).unref();

/* ── Transparent login to code-server (password auth) ── */

/**
 * slug → { cookie, expiresAt }
 * code-server auth cookie pair (e.g. "code-server-session=..." or legacy "key=...")
 * TTL prevents forwarding stale cookies after pod restarts.
 */
const csSessionCache = new Map();

function extractCodeServerAuthCookie(setCookies) {
  if (!Array.isArray(setCookies)) return null;

  // Prefer modern cookie name, then fallback to legacy key.
  const names = ["code-server-session", "key"];
  for (const name of names) {
    const prefix = `${name}=`;
    const match = setCookies.find(
      (sc) => typeof sc === "string" && sc.startsWith(prefix),
    );
    if (!match) continue;
    const pair = match.split(";", 1)[0];
    if (pair) return pair;
  }

  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * POST /login on the code-server pod to obtain its session cookie.
 * Returns a cookie pair (name=value) or null on failure.
 */
function loginToCodeServerOnce(svc, slug) {
  return new Promise((resolve) => {
    const password = derivePassword(slug);
    const body = `password=${encodeURIComponent(password)}`;
    const target = `${svc}.${NAMESPACE}.svc.cluster.local`;

    const req = http.request(
      {
        hostname: target,
        port: 80,
        path: "/login",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 5000,
      },
      (res) => {
        // Drain the response body
        res.resume();

        const setCookies = res.headers["set-cookie"] || [];
        resolve(extractCodeServerAuthCookie(setCookies));
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
    req.end(body);
  });
}

/**
 * Login with retries to handle slow pod starts.
 */
async function loginToCodeServer(svc, slug) {
  for (let attempt = 0; attempt < LOGIN_RETRY_COUNT; attempt++) {
    const cookie = await loginToCodeServerOnce(svc, slug);
    if (cookie) return cookie;
    if (attempt < LOGIN_RETRY_COUNT - 1) await sleep(LOGIN_RETRY_DELAY_MS);
  }
  return null;
}

/**
 * Ensure we have a cached code-server auth cookie for the given slug.
 * Returns a cookie pair (name=value) or null.
 */
async function ensureCsSession(svc, slug) {
  const cached = csSessionCache.get(slug);
  if (cached && Date.now() < cached.expiresAt) return cached.cookie;

  // Expired or missing — re-login
  csSessionCache.delete(slug);
  const cookie = await loginToCodeServer(svc, slug);
  if (cookie) {
    csSessionCache.set(slug, {
      cookie,
      expiresAt: Date.now() + CS_COOKIE_TTL_MS,
    });
  }
  return cookie;
}

/**
 * Inject the code-server auth cookie pair into the request headers.
 */
function injectCsSessionCookie(req, csCookie) {
  const existing = req.headers.cookie || "";
  req.headers.cookie = existing ? `${existing}; ${csCookie}` : csCookie;
}

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("error", (err, req, res) => {
  console.error("Proxy error:", err.message);
  if (typeof res.writeHead === "function") {
    // HTTP response
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway");
  } else {
    // WebSocket socket — destroy so the browser gets a clean close instead of 1006
    res.destroy();
  }
});

// Detect stale code-server session: if code-server redirects to /login,
// the cached cookie is invalid (pod was restarted). Clear it so the next
// request performs a fresh transparent login.
proxy.on("proxyRes", (proxyRes, req) => {
  if (
    proxyRes.statusCode === 302 &&
    (proxyRes.headers.location || "").includes("/login")
  ) {
    const route = parseRoute(req.originalUrl || req.url || "/");
    const slug = route ? route.slug : req._csSlug;
    if (slug) {
      csSessionCache.delete(slug);
    }
  }
});

function expectedServiceForSlug(slug) {
  return `cs-svc-${slug}`;
}

function slugFromSvc(svc) {
  return svc.replace(/^cs-svc-/, "");
}

function parseRoute(url) {
  const { pathname = "/", query } = parseUrl(url, true);
  const match = pathname.match(/^\/u\/([a-f0-9]{12})(\/.*)?$/);
  if (!match) return null;

  const slug = match[1];
  const suffix = match[2] || "/";
  return { slug, suffix, pathname, query };
}

function buildTarget(svc) {
  return `http://${svc}.${NAMESPACE}.svc.cluster.local:80`;
}

function sanitizeRequestUrlForUpstream(req, suffix, queryWithoutToken) {
  const cleanQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(queryWithoutToken)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) cleanQuery.append(key, String(item));
      continue;
    }
    cleanQuery.append(key, String(value));
  }
  const qs = cleanQuery.toString();
  req.url = qs ? `${suffix}?${qs}` : suffix;
}

function tokenFromCookie(req) {
  const cookies = parseCookie(req.headers.cookie || "");
  return cookies.cs_session || null;
}

async function verifyToken(rawToken) {
  try {
    const { payload } = await jwtVerify(rawToken, secret);
    if (typeof payload.sub !== "string" || typeof payload.svc !== "string") {
      return null;
    }
    return { userId: payload.sub, svc: payload.svc, rawToken };
  } catch {
    return null;
  }
}

/**
 * Resolve the user session from (in order):
 * 1. ?token= query parameter (initial iframe load)
 * 2. cs_session cookie (works when third-party cookies are allowed)
 * 3. In-memory activeSessions map (fallback when cookies are blocked)
 */
async function resolveSession(req, route) {
  const rawQueryToken =
    typeof route.query.token === "string" ? route.query.token : null;
  const rawCookieToken = tokenFromCookie(req);

  // Try query token first, then cookie token
  const rawToken = rawQueryToken || rawCookieToken;
  if (rawToken) {
    const payload = await verifyToken(rawToken);
    if (payload) {
      if (payload.svc !== expectedServiceForSlug(route.slug)) {
        return { status: "forbidden" };
      }
      // Persist in memory so subsequent requests without cookies still work
      upsertActiveSession(route.slug, payload);
      return {
        status: "ok",
        payload,
        fromQuery: Boolean(rawQueryToken),
      };
    }
  }

  // Fallback: check in-memory session store (for when cookies are blocked)
  const memSession = getActiveSession(route.slug);
  if (memSession) {
    // Re-verify the stored token is still valid
    const payload = await verifyToken(memSession.rawToken);
    if (payload && payload.svc === expectedServiceForSlug(route.slug)) {
      return {
        status: "ok",
        payload,
        fromQuery: false,
      };
    }
    // Token expired or invalid — remove stale entry
    activeSessions.delete(route.slug);
  }

  return { status: "unauthorized" };
}

/**
 * Resolve session from cookie alone (for non-/u/<slug>/ paths).
 * Used for code-server sub-resources and WebSocket connections
 * that don't include the /u/<slug>/ prefix in their URL.
 */
async function resolveSessionFromCookie(req) {
  const rawToken = tokenFromCookie(req);
  if (!rawToken) return { status: "unauthorized" };

  const payload = await verifyToken(rawToken);
  if (!payload) return { status: "unauthorized" };

  return { status: "ok", payload };
}

function sendHttpAuthError(res, status) {
  const code = status === "forbidden" ? 403 : 401;
  const body = status === "forbidden" ? "Forbidden" : "Unauthorized";
  res.writeHead(code, { "Content-Type": "text/plain" });
  res.end(body);
}

function sendWsAuthError(socket, status) {
  const code = status === "forbidden" ? 403 : 401;
  const body = status === "forbidden" ? "Forbidden" : "Unauthorized";
  socket.write(`HTTP/1.1 ${code} ${body}\r\n\r\n`);
  socket.destroy();
}

function buildSessionCookie(slug, token) {
  const parts = [
    `cs_session=${token}`,
    `Path=/`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Max-Age=28800",
  ];

  // Improves iframe cookie behavior in modern browsers that support CHIPS.
  parts.push("Partitioned");

  return parts.join("; ");
}

const server = http.createServer(async (req, res) => {
  const route = parseRoute(req.url || "/");

  // Fallback for non-/u/<slug>/ paths (code-server sub-resources & API calls).
  // code-server doesn't support --base-path, so the browser fetches static
  // assets and opens WebSockets at root-relative paths like /static/... or /?...
  if (!route) {
    const session = await resolveSessionFromCookie(req);
    if (session.status !== "ok") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const { payload } = session;
    const slug = slugFromSvc(payload.svc);

    const csCookie = await ensureCsSession(payload.svc, slug);
    if (csCookie) injectCsSessionCookie(req, csCookie);

    // Tag request so proxyRes stale-session handler can clear the cache
    req._csSlug = slug;

    proxy.web(req, res, { target: buildTarget(payload.svc) });
    return;
  }

  const session = await resolveSession(req, route);
  if (session.status !== "ok") {
    sendHttpAuthError(res, session.status);
    return;
  }

  const { payload, fromQuery } = session;

  // Preserve original URL for the proxyRes stale-session handler
  req.originalUrl = req.url;

  // Transparent login: inject code-server session cookie so the pod accepts the request
  const csCookie = await ensureCsSession(payload.svc, route.slug);
  if (csCookie) injectCsSessionCookie(req, csCookie);

  if (fromQuery) {
    const queryWithoutToken = { ...route.query };
    delete queryWithoutToken.token;
    sanitizeRequestUrlForUpstream(req, route.suffix, queryWithoutToken);
    res.setHeader(
      "Set-Cookie",
      buildSessionCookie(route.slug, payload.rawToken),
    );
    proxy.web(req, res, { target: buildTarget(payload.svc) });
    return;
  }

  sanitizeRequestUrlForUpstream(req, route.suffix, route.query);
  proxy.web(req, res, { target: buildTarget(payload.svc) });
});

server.on("upgrade", async (req, socket, head) => {
  const route = parseRoute(req.url || "/");

  // Fallback for WebSocket connections without /u/<slug>/ prefix.
  // code-server opens its main WebSocket at wss://host/?reconnectionToken=...
  if (!route) {
    const session = await resolveSessionFromCookie(req);
    if (session.status !== "ok") {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const { payload } = session;
    const slug = slugFromSvc(payload.svc);

    const wsCsCookie = await ensureCsSession(payload.svc, slug);
    if (wsCsCookie) injectCsSessionCookie(req, wsCsCookie);

    proxy.ws(req, socket, head, { target: buildTarget(payload.svc) });
    return;
  }

  const session = await resolveSession(req, route);
  if (session.status !== "ok") {
    sendWsAuthError(socket, session.status);
    return;
  }

  // Transparent login: inject code-server session cookie for WebSocket
  const wsCsCookie = await ensureCsSession(session.payload.svc, route.slug);
  if (wsCsCookie) injectCsSessionCookie(req, wsCsCookie);

  sanitizeRequestUrlForUpstream(req, route.suffix, route.query);
  proxy.ws(req, socket, head, { target: buildTarget(session.payload.svc) });
});

server.listen(PORT, () => {
  console.log(`cs-proxy listening on port ${PORT}`);
});
