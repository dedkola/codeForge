import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { headers } from "next/headers";
import { lessons, getLessonBySlug } from "@/data/lessons";
import TopBar from "@/components/TopBar";
import LessonPanel from "@/components/LessonPanel";
import ResizableLayout from "@/components/ResizableLayout";
import CodeServerPanel from "@/components/CodeServerPanel";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { ensureUserCodeServer } from "@/lib/code-server-manager";
import { generateProxyToken } from "@/lib/code-server-token";
import { buildUserCodeServerProxyUrl } from "@/lib/code-server-url";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);
  if (!lesson) return {};
  return {
    title: `${lesson.title} — CodeLearn`,
    description: lesson.description,
  };
}

export default async function LessonPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/lessons/${slug}`)}`);
  }

  const lesson = getLessonBySlug(slug);
  if (!lesson) notFound();
  await connection(); // opt into dynamic rendering for k8s API calls

  const instance = await ensureUserCodeServer(session.user.id);
  let codeServerUrl: string | undefined;
  if (instance.status === "ready") {
    const token = await generateProxyToken(session.user.id, instance.svcName);
    codeServerUrl = buildUserCodeServerProxyUrl(session.user.id, token);
  }

  return (
    <>
      <TopBar lessonTitle={lesson.title} codeServerUrl={codeServerUrl} />
      <ResizableLayout
        left={<LessonPanel lesson={lesson} />}
        right={
          <CodeServerPanel
            url={codeServerUrl}
            instanceStatus={instance.status}
          />
        }
      />
    </>
  );
}
