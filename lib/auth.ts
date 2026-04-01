import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";
import { Pool } from "pg";

const envBaseUrl = process.env.BETTER_AUTH_URL;
const normalizedBaseUrl = envBaseUrl
  ? envBaseUrl.startsWith("http://") || envBaseUrl.startsWith("https://")
    ? envBaseUrl
    : `https://${envBaseUrl}`
  : undefined;

export const auth = betterAuth({
  baseURL: normalizedBaseUrl,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  advanced: {
    trustedProxyHeaders: true,
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [dash()],
});
