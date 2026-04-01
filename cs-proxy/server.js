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

async function extractPayload(req) {
  // Try query param first
  const { query } = parseUrl(req.url, true);
  if (query.token) {
    try {
      const { payload } = await jwtVerify(query.token, secret);
      if (payload.sub && payload.svc) {
        return { userId: payload.sub, svc: payload.svc, rawToken: query.token };
      }
    } catch {
      return null;
    }
  }

  // Fall back to cookie
  const cookies = parseCookie(req.headers.cookie || "");
  const cookieToken = cookies.cs_session;
  if (cookieToken) {
    try {
      const { payload } = await jwtVerify(cookieToken, secret);
      if (payload.sub && payload.svc) {
        return { userId: payload.sub, svc: payload.svc, rawToken: cookieToken };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function buildTarget(svc) {
  return `http://${svc}.${NAMESPACE}.svc.cluster.local:80`;
}

const server = http.createServer(async (req, res) => {
  const payload = await extractPayload(req);
  if (!payload) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  const target = buildTarget(payload.svc);

  // If token came from query param, set cookie and redirect to clean URL
  const { query } = parseUrl(req.url, true);
  if (query.token) {
    res.writeHead(302, {
      Location: "/",
      "Set-Cookie": `cs_session=${payload.rawToken}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=28800`,
    });
    res.end();
    return;
  }

  proxy.web(req, res, { target });
});

// WebSocket upgrade
server.on("upgrade", async (req, socket, head) => {
  const payload = await extractPayload(req);
  if (!payload) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const target = buildTarget(payload.svc);
  proxy.ws(req, socket, head, { target });
});

server.listen(PORT, () => {
  console.log(`cs-proxy listening on port ${PORT}`);
});
