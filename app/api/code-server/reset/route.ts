import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resetUserWorkspace } from "@/lib/code-server-manager";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resetUserWorkspace(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error(
      `Failed to reset workspace for user ${session.user.id}:`,
      err,
    );
    return NextResponse.json(
      { error: "Failed to reset workspace" },
      { status: 500 },
    );
  }
}
