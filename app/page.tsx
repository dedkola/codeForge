import Link from "next/link";
import { lessons } from "@/data/lessons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CodeLearn — Learn DevOps by Doing",
  description:
    "Interactive coding lessons with a live VS Code editor. Learn Git, Docker, Kubernetes and more — step by step.",
};

export default function LandingPage() {
  const previewLessons = lessons.slice(0, 3);

  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <Link href="/" className="landing-nav-logo">
          <span className="logo-icon">⚡</span>
          <span className="gradient-text">CodeLearn</span>
        </Link>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/login"
            className="btn btn-ghost"
            style={{ padding: "6px 18px", fontSize: 13 }}
          >
            Log In
          </Link>
          <Link
            href="/lessons"
            className="btn btn-primary"
            style={{ padding: "6px 18px", fontSize: 13 }}
          >
            Start Learning
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <p style={{ marginBottom: 16 }}>
          <span className="badge badge-purple">✦ Free &amp; Interactive</span>
        </p>
        <h1>
          Master DevOps by <span className="gradient-text">building</span>
        </h1>
        <p>
          Hands-on coding lessons with a live VS Code environment right in your
          browser. No setup, no context switching — just open and code.
        </p>
        <div className="landing-ctas">
          <Link
            href="/lessons"
            className="btn btn-primary"
            style={{ padding: "10px 28px", fontSize: 15 }}
          >
            Start Learning →
          </Link>
          <Link
            href="/lessons"
            className="btn btn-ghost"
            style={{ padding: "10px 28px", fontSize: 15 }}
          >
            Browse Lessons
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2>
          Everything you need to <span className="gradient-text">learn</span>
        </h2>
        <div className="landing-features-grid">
          {[
            {
              icon: "💻",
              title: "Live VS Code Editor",
              desc: "Write and run code in a real VS Code environment embedded right next to the lesson instructions.",
            },
            {
              icon: "📖",
              title: "Step-by-Step Lessons",
              desc: "Structured curriculum from beginner to advanced. Follow clear steps with progress tracking built in.",
            },
            {
              icon: "🚀",
              title: "No Setup Required",
              desc: "Everything runs in the browser. No installs, no configuration — just open a lesson and start coding.",
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="landing-feature-card animate-fadeUp"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="landing-feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lessons Preview */}
      <section className="landing-lessons-preview">
        <h2>
          Explore our <span className="gradient-text">lessons</span>
        </h2>
        <div className="landing-preview-grid">
          {previewLessons.map((lesson, i) => (
            <Link
              key={lesson.slug}
              href={`/lessons/${lesson.slug}`}
              className="lesson-card animate-fadeUp"
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
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {lesson.steps.length} steps →
                </span>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/lessons" className="landing-view-all">
          View all lessons →
        </Link>
      </section>

      {/* Bottom CTA */}
      <section className="landing-cta">
        <h2>
          Ready to start <span className="gradient-text">coding</span>?
        </h2>
        <p>Jump into your first lesson — it only takes a few minutes.</p>
        <Link
          href="/lessons"
          className="btn btn-primary"
          style={{ padding: "12px 32px", fontSize: 15 }}
        >
          Get Started →
        </Link>
      </section>
    </div>
  );
}
