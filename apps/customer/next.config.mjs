import createNextIntlPlugin from "next-intl/plugin";
import { securityHeadersRoute } from "@avenick/config/security-headers";
import { imageOriginsFrom, objectStorageRemotePatterns } from "@avenick/config/image-hosts";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const spatialCommerceCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "script-src-attr 'none'",
  // fonts.googleapis.com serves the @font-face STYLESHEET and fonts.gstatic.com
  // serves the font FILES it points at — two origins, two directives, and both
  // are required. Without them this policy silently blocked every typeface the
  // design system declares (Inter, IBM Plex Sans Arabic, IBM Plex Mono, Source
  // Serif 4, Noto Kufi/Naskh) and the product rendered in system fallbacks,
  // which is a whole visual identity lost to a header nobody was looking at.
  // The failure is invisible in a screenshot — a fallback face is still a face
  // — and shows up only as one CSP violation in the console.
  //
  // These two hosts are allowed for stylesheets and font files ONLY. They are
  // deliberately absent from script-src and connect-src, so this widens the
  // policy exactly as far as typography needs and no further.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.avenick.com https://placehold.co",
  "font-src 'self' data: https://fonts.gstatic.com",
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

/**
 * The image hosts this portal serves, declared ONCE.
 *
 * next/image needs them as remotePatterns; the Content-Security-Policy needs
 * them as `img-src` origins. When those were two hand-kept lists they drifted,
 * and the browser blocked images the config had already allowed. `imageOriginsFrom`
 * derives the second from the first so they cannot disagree again.
 */
const remoteImagePatterns = [
  // Uploaded media (S3/MinIO/R2), resolved from env at build time.
  ...objectStorageRemotePatterns(),
  { protocol: "https", hostname: "*.avenick.com", pathname: "/**" },
  { protocol: "http", hostname: "localhost", pathname: "/**" },
  { protocol: "https", hostname: "placehold.co", pathname: "/**" },
  // Official manufacturer media used by the isolated, source-attributed
  // demo enrichment. Commercial price/stock never comes from this host.
  { protocol: "https", hostname: "www.mennekes.org", pathname: "/fileadmin/products_media/**" },
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
    remotePatterns: remoteImagePatterns,
  },
  // Baseline security headers for every route. Policy lives in
  // @avenick/config/security-headers so all three portals stay in step.
  async headers() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
    return [
      securityHeadersRoute({
        imgSrc: imageOriginsFrom(remoteImagePatterns, { isDev: process.env.NODE_ENV !== "production" }),
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
