import Link from "next/link";
import TopBar from "@/components/TopBar";
import { lessons } from "@/data/lessons";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Lessons — CodeLearn",
  description:
    "Browse interactive coding lessons with a live VS Code environment.",
};

export default async function LessonsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/lessons")}`);
  }

  const codeServerUrl = process.env.CODE_SERVER_URL;

  return (
    <>
      <TopBar codeServerUrl={codeServerUrl} />
      <main className="catalog-page">
        {/* Hero */}
        <section className="catalog-hero">
          <p style={{ marginBottom: 12 }}>
            <span className="badge badge-purple">✦ Interactive</span>
          </p>
          <h1>
            Learn by <span className="gradient-text">doing</span>
          </h1>
          <p>
            Step-by-step lessons with a live VS Code environment right next to
            the instructions. No context switching. Just code.
          </p>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 32,
              marginTop: 40,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Lessons", value: lessons.length },
              {
                label: "Total Steps",
                value: lessons.reduce((a, l) => a + l.steps.length, 0),
              },
              { label: "Live Editor", value: "✓" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    background: "var(--accent-gradient)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="catalog-grid">
          {lessons.map((lesson, i) => (
            <Link
              key={lesson.slug}
              href={`/lessons/${lesson.slug}`}
              className="lesson-card animate-fadeUp"
              id={`lesson-card-${lesson.slug}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="lesson-card-icon">{lesson.icon}</div>
              <h3>{lesson.title}</h3>
              <p className="lesson-card-desc">{lesson.description}</p>
              <div className="lesson-card-footer">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span
                    className={`badge ${
                      lesson.difficulty === "Beginner"
                        ? "badge-green"
                        : lesson.difficulty === "Intermediate"
                          ? "badge-cyan"
                          : "badge-purple"
                    }`}
                  >
                    {lesson.difficulty}
                  </span>
                  <span className="lesson-duration">⏱ {lesson.duration}</span>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  {lesson.steps.length} steps →
                </span>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
