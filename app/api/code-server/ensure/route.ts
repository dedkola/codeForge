import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureUserCodeServer } from "@/lib/code-server-manager";
import { generateProxyToken } from "@/lib/code-server-token";
import { userSlug } from "@/lib/code-server-k8s";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensureUserCodeServer(session.user.id);

  let proxyUrl: string | undefined;
  if (result.status === "ready") {
    const token = await generateProxyToken(session.user.id, result.svcName);
    const baseUrl = process.env.CS_PROXY_URL ?? "https://cs-proxy.tkweb.site";
    // Use per-user subdomain so each user's cs_session cookie is isolated to
    // their own hostname — prevents cookie collision between concurrent users.
    const slug = userSlug(session.user.id);
    const proxyBase = baseUrl.replace("://", `://${slug}.`);
    proxyUrl = `${proxyBase}/?token=${token}`;
  }

  return NextResponse.json({
    status: result.status,
    proxyUrl,
  });
}
