import { NextRequest, NextResponse } from "next/server";
import { cleanupStaleInstances } from "@/lib/code-server-manager";
import {
  CODE_SERVER_MAX_IDLE_MINUTES,
  CODE_SERVER_CLEANUP_SECRET,
} from "@/lib/code-server-config";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !CODE_SERVER_CLEANUP_SECRET ||
    authHeader !== `Bearer ${CODE_SERVER_CLEANUP_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaned = await cleanupStaleInstances(CODE_SERVER_MAX_IDLE_MINUTES);
  return NextResponse.json({ cleaned });
}
