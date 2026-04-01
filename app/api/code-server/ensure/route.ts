import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureUserCodeServer } from "@/lib/code-server-manager";
import { generateProxyToken } from "@/lib/code-server-token";
import { userSlug } from "@/lib/code-server-k8s";
import { getCodeServerProxyBaseUrl } from "@/lib/code-server-config";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensureUserCodeServer(session.user.id);

  let proxyUrl: string | undefined;
  if (result.status === "ready") {
    const token = await generateProxyToken(session.user.id, result.svcName);
    const proxyBase = getCodeServerProxyBaseUrl();
    const slug = userSlug(session.user.id);
    proxyUrl = `${proxyBase}/u/${slug}/?token=${token}`;
  }

  return NextResponse.json({
    status: result.status,
    proxyUrl,
  });
}
