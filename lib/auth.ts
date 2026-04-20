import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";
import { pool } from "./db";

const envBaseUrl = process.env.BETTER_AUTH_URL;
const isDockerBuild = process.env.DOCKER_BUILD === "true";
const normalizedBaseUrl = envBaseUrl
  ? envBaseUrl.startsWith("http://") || envBaseUrl.startsWith("https://")
    ? envBaseUrl
    : `https://${envBaseUrl}`
  : isDockerBuild
    ? "http://localhost:3000"
    : undefined;

const authSecret =
  process.env.BETTER_AUTH_SECRET ||
  (isDockerBuild
    ? "docker-build-placeholder-secret-change-in-runtime"
    : undefined);

function normalizeOrigin(rawOrigin: string): string | null {
  const trimmed = rawOrigin.trim();
  if (!trimmed) return null;

  const looksLikeLocalHost =
    /^localhost(?::\d+)?$/i.test(trimmed) ||
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(trimmed) ||
    /^\[::1\](?::\d+)?$/.test(trimmed);

  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `${looksLikeLocalHost ? "http" : "https"}://${trimmed}`;

  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

function buildTrustedOrigins(): string[] {
  const configuredOrigins = (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
    process.env.ALLOWED_DEV_ORIGINS ??
    ""
  )
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => !!value);

  const baseOrigin = normalizedBaseUrl
    ? normalizeOrigin(normalizedBaseUrl)
    : null;

  return Array.from(
    new Set(
      baseOrigin ? [baseOrigin, ...configuredOrigins] : configuredOrigins,
    ),
  );
}

const trustedOrigins = buildTrustedOrigins();

export const auth = betterAuth({
  appName: "CodeForge",
  secret: authSecret,
  baseURL: normalizedBaseUrl,
  ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
  database: pool,
  advanced: {
    trustedProxyHeaders: true,
    ipAddress: {
      // For Cloudflare
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],

      // For Vercel
      // ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"],

      // For AWS/Generic
      // ipAddressHeaders: ["x-forwarded-for"],
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [dash()],
});
