import type { NextConfig } from "next";

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "form-action 'self'",
  "frame-src https://www.youtube-nocookie.com https://drive.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Pacotes do workspace são publicados como TypeScript, sem passo de build.
  transpilePackages: ["@oficina/auth", "@oficina/config", "@oficina/db", "@oficina/domain"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
