import { NextRequest, NextResponse } from "next/server";
import { cleanupStaleInstances } from "@/lib/code-server-manager";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CS_PROXY_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaned = await cleanupStaleInstances(120);
  return NextResponse.json({ cleaned });
}
