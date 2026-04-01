import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserCodeServerStatus } from "@/lib/code-server-manager";
import { generateProxyToken } from "@/lib/code-server-token";
import { resourceNames, userSlug } from "@/lib/code-server-k8s";
import { getCodeServerProxyBaseUrl } from "@/lib/code-server-config";

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
    const proxyBase = getCodeServerProxyBaseUrl();
    const slug = userSlug(session.user.id);
    proxyUrl = `${proxyBase}/u/${slug}/?token=${token}`;
  }

  return NextResponse.json({ status, proxyUrl });
}
