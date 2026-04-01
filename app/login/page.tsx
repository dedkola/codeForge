import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Log In — CodeLearn",
  description: "Sign in to access all CodeLearn lessons.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <AuthPanel mode="login" />
    </Suspense>
  );
}
