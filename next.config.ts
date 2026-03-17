import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production"
const scriptSrcDirectives = ["'self'"]

if (isDevelopment) {
  scriptSrcDirectives.push("'unsafe-inline'", "'unsafe-eval'")
} else {
  const allowUnsafeScriptInline = process.env.CSP_ALLOW_UNSAFE_SCRIPT_INLINE === "true"
  if (allowUnsafeScriptInline) {
    scriptSrcDirectives.push("'unsafe-inline'")
  }
}

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `script-src ${scriptSrcDirectives.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://docs.google.com https://script.google.com",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/vault",
        destination: "/partners",
        permanent: true,
      },
      {
        source: "/vault/sites",
        destination: "/domains",
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
