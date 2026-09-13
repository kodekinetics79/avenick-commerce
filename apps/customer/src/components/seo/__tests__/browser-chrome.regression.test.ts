import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@avenick/utils/portal-config", () => ({ platformName: () => "Storefront" }));

import manifest from "@/app/manifest";
import { APP_ICON_SIZES, appIconPath } from "../app-icons";

interface CustomerNextConfig {
  poweredByHeader?: boolean;
  rewrites?: () => Promise<Array<{ source: string; destination: string }>>;
}

// The config is plain .mjs with no declaration file. The specifier is widened to
// `string` so tsc does not try to type the module; vitest still resolves the
// literal path at runtime.
const { default: nextConfig } = (await import("../../../../next.config.mjs" as string)) as { default: CustomerNextConfig };

/**
 * Three gaps between what the storefront's browser-facing files said they did
 * and what a browser received: the manifest carried no icon larger than 180px,
 * so Chrome would not offer an install; /favicon.ico answered 404 with an HTML
 * document; and every response advertised `x-powered-by: Next.js`.
 */
describe("the storefront's browser chrome", () => {
  it("gives the manifest the 192px and 512px icons an install needs, each served by a real route", async () => {
    const { icons = [] } = await manifest();
    for (const px of [192, 512] as const) {
      const icon = icons.find((entry) => entry.sizes === `${px}x${px}`);
      expect(icon, `no ${px}px icon in the manifest`).toBeDefined();
      expect(icon!.src).toBe(appIconPath(px));
      expect(icon!.type).toBe("image/png");
    }
    // Every plated icon the manifest names is a cut apple-icon.tsx draws.
    for (const icon of icons.filter((entry) => entry.src.startsWith("/apple-icon/"))) {
      expect(APP_ICON_SIZES.map((px) => appIconPath(px))).toContain(icon.src);
    }
  });

  it("answers /favicon.ico with the generated icon instead of a 404 page", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual(expect.arrayContaining([{ source: "/favicon.ico", destination: "/icon" }]));
  });

  it("does not advertise the framework in a response header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
