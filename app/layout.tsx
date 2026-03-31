import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeLearn — Interactive Coding Lessons",
  description:
    "Step-by-step interactive coding lessons with a live VS Code environment powered by code-server.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
