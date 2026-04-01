const http = require("http");
const httpProxy = require("http-proxy");
const { jwtVerify } = require("jose");
const { parse: parseUrl } = require("url");
const { parse: parseCookie } = require("./cookie");

const PORT = process.env.PORT || 8080;
const NAMESPACE = process.env.NAMESPACE || "codelearn";
const secret = new TextEncoder().encode(process.env.CS_PROXY_SECRET);

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("error", (err, req, res) => {
  console.error("Proxy error:", err.message);
  if (res.writeHead) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway");
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

  sanitizeRequestUrlForUpstream(req, route.suffix, route.query);
  proxy.ws(req, socket, head, { target: buildTarget(session.payload.svc) });
});

server.listen(PORT, () => {
  console.log(`cs-proxy listening on port ${PORT}`);
});
