import createNextIntlPlugin from "next-intl/plugin";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const spatialCommerceCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.avenick.com https://placehold.co",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'none'",
  "child-src 'none'",
  "frame-src 'none'",
  "media-src 'none'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const spatialCommerceHeaders = [
  { key: "Content-Security-Policy", value: spatialCommerceCsp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=(), serial=(), payment=()" },
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig = {
  transpilePackages: ["@avenick/ui", "@avenick/utils", "@avenick/auth", "@avenick/types", "@avenick/database", "@avenick/observability"],
  // instrumentationHook: runs src/instrumentation.ts once at startup (OTel +
  // rate-limit store). serverComponentsExternalPackages: keep OpenTelemetry out
  // of the webpack bundle so the Node SDK loads as a real module at runtime.
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@opentelemetry/api", "@opentelemetry/sdk-node", "@vercel/otel"],
  },
  // Lint is run as a separate `pnpm lint` step, not during the production build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.avenick.com", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
    ],
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{
      source: "/b2b/spatial-commerce/:path*",
      headers: spatialCommerceHeaders,
    }];
  },
  // Copies the Prisma query engine into the serverless bundle (pnpm monorepo).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
