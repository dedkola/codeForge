import type { Metadata } from "next";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Sign Up — CodeLearn",
  description: "Create your CodeLearn account and unlock all lessons.",
};

export default function SignUpPage() {
  return <AuthPanel mode="signup" />;
}
