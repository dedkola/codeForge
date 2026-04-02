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

  const status = await getUserCodeServerStatus(session.user.id);

  let url: string | undefined;
  if (status === "ready") {
    url = buildCodeServerUrl(userSlug(session.user.id));
  }

  return NextResponse.json({ status, url });
}
