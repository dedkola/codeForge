import { notFound } from "next/navigation";
import { lessons, getLessonBySlug } from "@/data/lessons";
import TopBar from "@/components/TopBar";
import LessonPanel from "@/components/LessonPanel";
import ResizableLayout from "@/components/ResizableLayout";
import CodeServerPanel from "@/components/CodeServerPanel";
import type { Metadata } from "next";

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
  const lesson = getLessonBySlug(slug);
  if (!lesson) notFound();
  const codeServerUrl = process.env.CODE_SERVER_URL || "http://localhost:8080";

  return (
    <>
      <TopBar lessonTitle={lesson.title} codeServerUrl={codeServerUrl} />
      <ResizableLayout
        left={<LessonPanel lesson={lesson} />}
        right={<CodeServerPanel url={codeServerUrl} />}
      />
    </>
  );
}
