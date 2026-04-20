import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureUserCodeServer } from "@/lib/code-server-manager";
import { buildCodeServerUrl } from "@/lib/code-server-config";
import { userSlug } from "@/lib/code-server-k8s";
import { resolveLessonTemplateSlug } from "@/data/lessons";

interface EnsureRequestBody {
  lessonSlug?: unknown;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: EnsureRequestBody = {};
  try {
    body = (await request.json()) as EnsureRequestBody;
  } catch {
    // Allow empty body for backward compatibility
  }

  const lessonSlug =
    typeof body.lessonSlug === "string" ? body.lessonSlug : undefined;
  const lessonTemplateSlug = resolveLessonTemplateSlug(lessonSlug);

  const result = await ensureUserCodeServer(session.user.id);
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
}
