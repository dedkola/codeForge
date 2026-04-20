import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { resetUserWorkspace } from "@/lib/code-server-manager";
import { buildCodeServerUrl } from "@/lib/code-server-config";
import { userSlug } from "@/lib/code-server-k8s";
import { resolveLessonTemplateSlug } from "@/data/lessons";

interface ResetRequestBody {
  lessonSlug?: string;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ResetRequestBody = {};
  try {
    body = (await request.json()) as ResetRequestBody;
  } catch {
    // Allow empty body for backward compatibility
  }

  const lessonTemplateSlug = resolveLessonTemplateSlug(body.lessonSlug);

  try {
    const result = await resetUserWorkspace(session.user.id);
    const url =
      result.status === "error"
        ? undefined
        : buildCodeServerUrl(
            userSlug(session.user.id),
            result.resetCount,
            lessonTemplateSlug,
          );

    return NextResponse.json({
      status: result.status,
      url,
    });
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
