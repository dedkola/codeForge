import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserCodeServerStatus } from "@/lib/code-server-manager";
import { userSlug } from "@/lib/code-server-k8s";
import { buildCodeServerUrl } from "@/lib/code-server-config";
import { resolveLessonTemplateSlug } from "@/data/lessons";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lessonTemplateSlug = resolveLessonTemplateSlug(
    new URL(request.url).searchParams.get("lesson"),
  );

  const result = await getUserCodeServerStatus(session.user.id);

  let url: string | undefined;
  if (result.status === "ready") {
    url = buildCodeServerUrl(
      userSlug(session.user.id),
      result.resetCount,
      lessonTemplateSlug,
    );
  }

  return NextResponse.json({
    status: result.status,
    url,
  });
}
