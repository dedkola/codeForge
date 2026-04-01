import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserCodeServerStatus } from "@/lib/code-server-manager";
import { generateProxyToken } from "@/lib/code-server-token";
import { resourceNames, userSlug } from "@/lib/code-server-k8s";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getUserCodeServerStatus(session.user.id);

  let proxyUrl: string | undefined;
  if (status === "ready") {
    const { svc } = resourceNames(session.user.id);
    const token = await generateProxyToken(session.user.id, svc);
    const baseUrl = process.env.CS_PROXY_URL ?? "https://cs-proxy.tkweb.site";
    // Use per-user subdomain so each user's cs_session cookie is isolated to
    // their own hostname — prevents cookie collision between concurrent users.
    const slug = userSlug(session.user.id);
    const proxyBase = baseUrl.replace("://", `://${slug}.`);
    proxyUrl = `${proxyBase}/?token=${token}`;
  }

  return NextResponse.json({ status, proxyUrl });
}
