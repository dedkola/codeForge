import type { NextConfig } from "next";

const csDomain = process.env.CODE_SERVER_DOMAIN ?? "tkweb.site";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.192"],
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
              `frame-src https://cs-*.${csDomain}`,
              "connect-src 'self' ws: wss: http: https:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
