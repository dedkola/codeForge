"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  buildAuthPath,
  sanitizeInternalRedirectPath,
} from "@/lib/safe-redirect";

type AuthMode = "login" | "signup";

interface AuthPanelProps {
  mode: AuthMode;
}

export default function AuthPanel({ mode }: AuthPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextUrl = useMemo(() => {
    return sanitizeInternalRedirectPath(searchParams.get("next"));
  }, [searchParams]);

  const submitLabel = mode === "login" ? "Log In" : "Create Account";

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: nextUrl,
        });

        if (error) {
          setErrorMessage(error.message || "Unable to sign in.");
          return;
        }
      } else {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: nextUrl,
        });

        if (error) {
          setErrorMessage(error.message || "Unable to sign up.");
          return;
        }
      }

      router.replace(nextUrl);
      router.refresh();
    } catch {
      setErrorMessage("Authentication request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "github") => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: nextUrl,
      });

      if (error) {
        setErrorMessage(
          error.message || `Unable to authenticate with ${provider}.`,
        );
      }
    } catch {
      setErrorMessage(`Authentication with ${provider} failed.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };

  if (sessionPending) {
    return (
      <div
        className="landing-page"
        style={{ display: "grid", placeItems: "center", padding: 24 }}
      >
        <p style={{ color: "var(--text-secondary)" }}>Checking session...</p>
      </div>
    );
  }

  return (
    <div className="landing-page" style={{ overflow: "auto" }}>
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "80px 20px",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(124,106,247,0.15) 0%, transparent 70%)",
        }}
      >
        <div
          className="glass"
          style={{
            width: "100%",
            maxWidth: 460,
            borderRadius: "var(--radius-lg)",
            padding: 28,
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <Link
              href="/"
              className="landing-nav-logo"
              style={{ marginBottom: 14, display: "inline-flex" }}
            >
              <span className="logo-icon">⚡</span>
              <span className="gradient-text">CodeLearn</span>
            </Link>
            <h1 style={{ fontSize: 28, marginBottom: 8 }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p style={{ color: "var(--text-secondary)" }}>
              {mode === "login"
                ? "Sign in to access interactive lessons and your coding workspace."
                : "Sign up to unlock all lessons and code directly in your browser."}
            </p>
          </div>

          {session ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ color: "var(--text-secondary)" }}>
                You are signed in as{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {session.user.email}
                </strong>
                .
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={nextUrl}>
                  <button className="btn btn-primary" type="button">
                    Continue
                  </button>
                </Link>
                <button
                  className="btn btn-ghost"
                  onClick={handleLogout}
                  type="button"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <>
              <form
                onSubmit={handleEmailAuth}
                style={{ display: "grid", gap: 10 }}
              >
                {mode === "signup" && (
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Name"
                    required
                    className="glass"
                    style={{
                      borderRadius: 10,
                      padding: "10px 12px",
                      border: "1px solid var(--border-default)",
                    }}
                  />
                )}
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  required
                  className="glass"
                  style={{
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border-default)",
                  }}
                />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  required
                  className="glass"
                  style={{
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border-default)",
                  }}
                />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {submitLabel}
                </button>
              </form>

              <div
                style={{
                  margin: "14px 0",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 12,
                }}
              >
                or continue with
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleSocialAuth("google");
                  }}
                >
                  Google
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleSocialAuth("github");
                  }}
                >
                  GitHub
                </button>
              </div>

              <p
                style={{
                  marginTop: 14,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                }}
              >
                {mode === "login" ? (
                  <>
                    No account yet?{" "}
                    <Link href={buildAuthPath("/signup", nextUrl)}>
                      Create one
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Link href={buildAuthPath("/login", nextUrl)}>Log in</Link>
                  </>
                )}
              </p>

              {errorMessage && (
                <p style={{ marginTop: 10, color: "var(--red)", fontSize: 13 }}>
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
