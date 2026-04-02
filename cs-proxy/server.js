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

/* ── Per-user password derivation (mirrors lib/code-server-password.ts) ── */

function derivePassword(slug) {
  return createHmac("sha256", RAW_SECRET)
    .update(`cs-pod-password:${slug}`)
    .digest("hex");
}

/* ── Transparent login to code-server (password auth) ── */

/** slug → code-server auth cookie pair (e.g. "code-server-session=..." or legacy "key=...") */
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

/**
 * POST /login on the code-server pod to obtain its session cookie.
 * Returns a cookie pair (name=value) or null on failure.
 */
function loginToCodeServer(svc, slug) {
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
      },
      (res) => {
        // Drain the response body
        res.resume();

        const setCookies = res.headers["set-cookie"] || [];
        resolve(extractCodeServerAuthCookie(setCookies));
      },
    );

    req.on("error", () => resolve(null));
    req.end(body);
  });
}

/**
 * Ensure we have a cached code-server auth cookie for the given slug.
 * Returns a cookie pair (name=value) or null.
 */
async function ensureCsSession(svc, slug) {
  let cookie = csSessionCache.get(slug);
  if (cookie) return cookie;

  cookie = await loginToCodeServer(svc, slug);
  if (cookie) csSessionCache.set(slug, cookie);
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
// the cached cookie is invalid (pod was restarted). Clear it so next
// request triggers a fresh transparent login.
proxy.on("proxyRes", (proxyRes, req) => {
  if (
    proxyRes.statusCode === 302 &&
    (proxyRes.headers.location || "").includes("/login")
  ) {
    const route = parseRoute(req.originalUrl || req.url || "/");
    if (route) {
      csSessionCache.delete(route.slug);
    }
  }
});

function expectedServiceForSlug(slug) {
  return `cs-svc-${slug}`;
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

async function resolveSession(req, route) {
  const rawQueryToken =
    typeof route.query.token === "string" ? route.query.token : null;
  const rawCookieToken = tokenFromCookie(req);
  const rawToken = rawQueryToken || rawCookieToken;
  if (!rawToken) return { status: "unauthorized" };

  const payload = await verifyToken(rawToken);
  if (!payload) return { status: "unauthorized" };

  if (payload.svc !== expectedServiceForSlug(route.slug)) {
    return { status: "forbidden" };
  }

  return {
    status: "ok",
    payload,
    fromQuery: Boolean(rawQueryToken),
  };
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
    `Path=/u/${slug}`,
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
  if (!route) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
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
  if (!route) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
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
