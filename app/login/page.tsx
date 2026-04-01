import type { Metadata } from "next";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Log In — CodeLearn",
  description: "Sign in to access all CodeLearn lessons.",
};

export default function LoginPage() {
  return <AuthPanel mode="login" />;
}
