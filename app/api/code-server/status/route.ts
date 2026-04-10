import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserCodeServerStatus } from "@/lib/code-server-manager";
import { userSlug } from "@/lib/code-server-k8s";
import { buildCodeServerUrl } from "@/lib/code-server-config";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getUserCodeServerStatus(session.user.id);

  let url: string | undefined;
  if (result.status === "ready") {
    url = buildCodeServerUrl(userSlug(session.user.id), result.resetCount);
  }

  return NextResponse.json({
    status: result.status,
    url,
  });
}
