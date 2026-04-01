import { NextRequest, NextResponse } from "next/server";
import { cleanupStaleInstances } from "@/lib/code-server-manager";
import { CODE_SERVER_MAX_IDLE_MINUTES } from "@/lib/code-server-config";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CS_PROXY_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaned = await cleanupStaleInstances(CODE_SERVER_MAX_IDLE_MINUTES);
  return NextResponse.json({ cleaned });
}
