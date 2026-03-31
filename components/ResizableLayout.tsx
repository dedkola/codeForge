"use client";

import { useState, useCallback } from "react";

interface ResizableLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number; // percentage 20-80
}

export default function ResizableLayout({
  left,
  right,
  defaultLeftWidth = 38,
}: ResizableLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setDragging(true);

      const startX = e.clientX;
      const startWidth = leftWidth;
      const containerWidth = document.body.clientWidth;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newPct = startWidth + (delta / containerWidth) * 100;
        setLeftWidth(Math.min(75, Math.max(20, newPct)));
      };

      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [leftWidth]
  );

  return (
    <div
      className="panels-container"
      style={{ userSelect: dragging ? "none" : undefined }}
    >
      {/* Left — Lesson */}
      <div
        className="panel-lesson"
        style={{ width: `${leftWidth}%`, flexShrink: 0 }}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        className={`panel-resize-handle ${dragging ? "dragging" : ""}`}
        onMouseDown={startDrag}
        title="Drag to resize"
      />

      {/* Right — code-server */}
      <div className="panel-code-server">{right}</div>
    </div>
  );
}
