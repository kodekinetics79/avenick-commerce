import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig = {
  transpilePackages: ["@manzil/ui", "@manzil/utils", "@manzil/auth", "@manzil/types", "@manzil/database"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.manzil.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default withNextIntl(nextConfig);
