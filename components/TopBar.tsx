"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopBarProps {
  lessonTitle?: string;
}

export default function TopBar({ lessonTitle }: TopBarProps) {
  const pathname = usePathname();
  const isLesson = pathname.startsWith("/lessons/");

  return (
    <header className="topbar">
      <Link
        href="/"
        className="topbar-logo"
        style={{ color: "var(--text-primary)", textDecoration: "none" }}
      >
        <span className="logo-icon">⚡</span>
        <span className="gradient-text">CodeLearn</span>
      </Link>

      {isLesson && lessonTitle && (
        <>
          <span style={{ color: "var(--border-default)", fontSize: 18 }}>
            /
          </span>
          <span
            style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}
          >
            {lessonTitle}
          </span>
        </>
      )}

      <div className="topbar-sep" />

      <Link href="/lessons">
        <button
          className="btn btn-ghost"
          style={{ padding: "5px 12px", fontSize: 12 }}
          id="nav-catalog-btn"
        >
          📚 All Lessons
        </button>
      </Link>

      <a
        href={process.env.NEXT_PUBLIC_CODE_SERVER_URL || "http://localhost:8080"}
        target="_blank"
        rel="noopener noreferrer"
      >
        <button
          className="btn btn-ghost"
          style={{ padding: "5px 12px", fontSize: 12 }}
          id="nav-open-vscode-btn"
        >
          ↗ Open in full screen
        </button>
      </a>
    </header>
  );
}
