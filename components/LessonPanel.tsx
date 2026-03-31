"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Lesson, LessonStep } from "@/data/lessons";

interface LessonPanelProps {
  lesson: Lesson;
}

export default function LessonPanel({ lesson }: LessonPanelProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const totalSteps = lesson.steps.length;
  const currentStep: LessonStep = lesson.steps[currentStepIndex];

  const goNext = () => {
    setCompleted((prev) => new Set([...prev, currentStepIndex]));
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) setCurrentStepIndex((i) => i - 1);
  };

  const goToStep = (idx: number) => setCurrentStepIndex(idx);

  const completedCount = completed.size;
  const isLastStep = currentStepIndex === totalSteps - 1;
  const allDone = completedCount === totalSteps;

  return (
    <>
      {/* Header */}
      <div className="lesson-header">
        <div className="lesson-title">{lesson.title}</div>
        <div className="lesson-meta">
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
          <span className="badge badge-purple">⏱ {lesson.duration}</span>
          {lesson.tags.map((t) => (
            <span key={t} className="badge" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="lesson-progress-bar-wrap">
        <div className="lesson-progress-label">
          <span>Progress</span>
          <span>{completedCount}/{totalSteps} steps done</span>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${(completedCount / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step navigator */}
      <div className="lesson-steps-nav">
        {lesson.steps.map((step, idx) => (
          <button
            key={step.id}
            id={`step-nav-${step.id}`}
            className={`step-item ${idx === currentStepIndex ? "active" : ""} ${
              completed.has(idx) ? "completed" : ""
            }`}
            onClick={() => goToStep(idx)}
            style={{
              background: "none",
              border: "none",
              textAlign: "left",
              width: "100%",
              cursor: "pointer",
            }}
          >
            <span className="step-dot">
              {completed.has(idx) ? "✓" : idx + 1}
            </span>
            <span style={{ fontWeight: idx === currentStepIndex ? 600 : 400 }}>
              {step.title}
            </span>
          </button>
        ))}
      </div>

      {/* MDX Content */}
      <div className="lesson-content">
        <div
          key={currentStep.id}
          className="mdx-content"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {currentStep.content}
          </ReactMarkdown>
        </div>

        {allDone && isLastStep && (
          <div
            style={{
              marginTop: 24,
              padding: "20px",
              background: "rgba(61,214,140,0.08)",
              border: "1px solid rgba(61,214,140,0.25)",
              borderRadius: "var(--radius-md)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>
              Lesson Complete!
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              You&apos;ve completed all {totalSteps} steps of {lesson.title}.
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="lesson-footer">
        <button
          id="lesson-prev-btn"
          className="btn btn-ghost"
          onClick={goPrev}
          disabled={currentStepIndex === 0}
        >
          ← Prev
        </button>

        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Step {currentStepIndex + 1} of {totalSteps}
        </span>

        <button
          id="lesson-next-btn"
          className="btn btn-primary"
          onClick={goNext}
          disabled={isLastStep && completed.has(currentStepIndex)}
        >
          {isLastStep ? (completed.has(currentStepIndex) ? "Done ✓" : "Complete ✓") : "Next →"}
        </button>
      </div>
    </>
  );
}
