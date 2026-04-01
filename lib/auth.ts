import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";
import { Pool } from "pg";

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

export const auth = betterAuth({
  appName: "CodeForge",
  secret: authSecret,
  baseURL: normalizedBaseUrl,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
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
