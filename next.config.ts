import type { NextConfig } from "next";

export function createContentSecurityPolicy(
  nodeEnvironment = process.env.NODE_ENV,
) {
  const scriptSource =
    nodeEnvironment === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSource,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self' blob:",
    "media-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
  ].join("; ");
}

export function createApplicationHeaders(
  nodeEnvironment = process.env.NODE_ENV,
) {
  return [
    {
      key: "Cache-Control",
      value: "no-store, max-age=0",
    },
    {
      key: "Pragma",
      value: "no-cache",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Content-Security-Policy",
      value: createContentSecurityPolicy(nodeEnvironment),
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), geolocation=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-origin",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
    ...(nodeEnvironment === "production"
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]
      : []),
  ];
}

export const applicationHeaders = createApplicationHeaders();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: applicationHeaders,
      },
    ];
  },
  experimental: {
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
