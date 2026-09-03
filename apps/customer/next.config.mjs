import createNextIntlPlugin from "next-intl/plugin";
import { securityHeadersRoute } from "@avenick/config/security-headers";
import { objectStorageRemotePatterns } from "@avenick/config/image-hosts";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

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


const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
      // Uploaded media (S3/MinIO/R2), resolved from env at build time.
      ...objectStorageRemotePatterns(),
      { protocol: "https", hostname: "*.avenick.com", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      // Official manufacturer media used by the isolated, source-attributed
      // demo enrichment. Commercial price/stock never comes from this host.
      { protocol: "https", hostname: "www.mennekes.org", pathname: "/fileadmin/products_media/**" },
    ],
  },
  // Baseline security headers for every route. Policy lives in
  // @avenick/config/security-headers so all three portals stay in step.
  async headers() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
    return [
      securityHeadersRoute({
        imgSrc: ["https://www.mennekes.org"],
        connectSrc: backend ? [backend] : [],
        isDev: process.env.NODE_ENV !== "production",
      }),
      // The spatial-commerce shell is stricter than the baseline: it renders a
      // WebGL canvas behind an authenticated route, so it pins its own CSP and
      // is never cached or framed. Route rules are additive in Next, and the
      // more specific source wins for the headers it names.
      ...(process.env.NODE_ENV === "production"
        ? [{ source: "/b2b/spatial-commerce/:path*", headers: spatialCommerceHeaders }]
        : []),
    ];
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
