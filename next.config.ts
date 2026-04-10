import type { NextConfig } from "next";

const csDomain = process.env.CODE_SERVER_DOMAIN;

const allowedOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((o) => o.trim())
  : [];

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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              `frame-src https://*.${csDomain}`,
              "connect-src 'self' ws: wss: http: https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
