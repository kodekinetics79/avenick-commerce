import createNextIntlPlugin from "next-intl/plugin";
import { securityHeadersRoute } from "@avenick/config/security-headers";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

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
      { protocol: "https", hostname: "*.avenick.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  // Baseline security headers for every route. Policy lives in
  // @avenick/config/security-headers so all three portals stay in step.
  async headers() {
    const backend = process.env.NEXT_PUBLIC_SELLER_BACKEND_URL?.trim();
    return [
      securityHeadersRoute({
        imgSrc: [],
        connectSrc: backend ? [backend] : [],
        isDev: process.env.NODE_ENV !== "production",
      }),
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
