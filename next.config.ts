import type { NextConfig } from "next";

const csDomain = process.env.CODE_SERVER_DOMAIN;
const isDev = process.env.NODE_ENV !== "production";

const allowedOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [];

const frameSrcDirective = csDomain
  ? `frame-src https://*.${csDomain}`
  : "frame-src 'self'";

const scriptSrcDirective = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedOrigins,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "form-action 'self'",
              scriptSrcDirective,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              frameSrcDirective,
              "connect-src 'self' ws: wss: http: https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
