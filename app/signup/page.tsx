import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Sign Up — CodeLearn",
  description: "Create your CodeLearn account and unlock all lessons.",
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <AuthPanel mode="signup" />
    </Suspense>
  );
}
