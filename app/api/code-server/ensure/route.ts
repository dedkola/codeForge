import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureUserCodeServer } from "@/lib/code-server-manager";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await ensureUserCodeServer(session.user.id);

  return NextResponse.json({
    status: result.status,
    url: result.status === "ready" ? result.url : undefined,
  });
}
