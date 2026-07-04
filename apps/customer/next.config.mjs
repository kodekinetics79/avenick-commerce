import createNextIntlPlugin from "next-intl/plugin";
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
      { protocol: "https", hostname: "*.avenick.com", pathname: "/**" },
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
    ],
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
