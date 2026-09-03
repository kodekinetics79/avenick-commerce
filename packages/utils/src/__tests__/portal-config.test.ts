/**
 * The resolver reads env at call time, but its warn-once set lives at module
 * scope. Every test therefore stubs the full variable set (unset = undefined)
 * and re-imports a fresh module, so no test inherits another's warnings or
 * leftovers. vi.unstubAllEnvs() puts the real environment back afterwards.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

type PortalConfig = typeof import("../portal-config");

const ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_CUSTOMER_PORTAL_URL",
  "NEXT_PUBLIC_SELLER_PORTAL_URL",
  "NEXT_PUBLIC_ADMIN_PORTAL_URL",
  "NEXTAUTH_URL",
  "RENDER_EXTERNAL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_LEGAL_EMAIL",
  "NEXT_PUBLIC_PRIVACY_EMAIL",
  "NEXT_PUBLIC_PLATFORM_NAME",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

async function load(env: Partial<Record<EnvKey, string | undefined>>): Promise<PortalConfig> {
  // NODE_ENV is never left unset: vitest itself reads it. "test" is simply
  // "not production", which is the only distinction the resolver makes.
  for (const key of ENV_KEYS) vi.stubEnv(key, key === "NODE_ENV" ? (env.NODE_ENV ?? "test") : env[key]);
  vi.resetModules();
  return import("../portal-config");
}

const PROD = { NODE_ENV: "production" } as const;
const DEV = { NODE_ENV: "development" } as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("portalOrigin", () => {
  it("is null for every portal when unset in production", async () => {
    const m = await load(PROD);
    expect(m.portalOrigin("customer")).toBeNull();
    expect(m.portalOrigin("seller")).toBeNull();
    expect(m.portalOrigin("admin")).toBeNull();
  });

  it("falls back to the documented localhost ports outside production", async () => {
    const m = await load(DEV);
    expect(m.portalOrigin("customer")).toBe("http://localhost:13100");
    expect(m.portalOrigin("seller")).toBe("http://localhost:13101");
    expect(m.portalOrigin("admin")).toBe("http://localhost:13102");

    // vitest's own NODE_ENV is "test" — also non-production, also falls back.
    const t = await load({ NODE_ENV: "test" });
    expect(t.portalOrigin("seller")).toBe("http://localhost:13101");
  });

  it("returns the configured origin with a trailing slash trimmed", async () => {
    const m = await load({
      ...PROD,
      NEXT_PUBLIC_CUSTOMER_PORTAL_URL: "https://shop.example/",
      NEXT_PUBLIC_SELLER_PORTAL_URL: "https://sell.example",
      NEXT_PUBLIC_ADMIN_PORTAL_URL: "  https://ops.example:8443/  ",
    });
    expect(m.portalOrigin("customer")).toBe("https://shop.example");
    expect(m.portalOrigin("seller")).toBe("https://sell.example");
    expect(m.portalOrigin("admin")).toBe("https://ops.example:8443");
  });

  it("rejects a value carrying a path and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await load({ ...PROD, NEXT_PUBLIC_CUSTOMER_PORTAL_URL: "https://shop.example/store" });

    expect(m.portalOrigin("customer")).toBeNull();
    expect(m.portalOrigin("customer")).toBeNull();
    expect(m.portalUrl("customer", "/login")).toBeNull();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("NEXT_PUBLIC_CUSTOMER_PORTAL_URL");
  });

  it("rejects query, fragment, credentials, non-http and scheme-less values", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const bad of [
      "https://shop.example/?ref=1",
      "https://shop.example/#top",
      "https://user:pw@shop.example",
      "ftp://shop.example",
      "shop.example",
      "localhost:13100",
    ]) {
      const m = await load({ ...PROD, NEXT_PUBLIC_SELLER_PORTAL_URL: bad });
      expect(m.portalOrigin("seller"), bad).toBeNull();
    }
    // Never echo the rejected value: it may carry credentials.
    for (const call of warn.mock.calls) expect(String(call[0])).not.toContain("user:pw");
  });

  it("treats a malformed value as unset even in development (no fallback masking)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await load({ ...DEV, NEXT_PUBLIC_SELLER_PORTAL_URL: "https://sell.example/apply" });
    expect(m.portalOrigin("seller")).toBeNull();
  });

  it("does not warn in a browser bundle", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", {});
    const m = await load({ ...PROD, NEXT_PUBLIC_ADMIN_PORTAL_URL: "https://ops.example/x" });
    expect(m.portalOrigin("admin")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("portalUrl", () => {
  it("joins the path onto the origin, adding the leading slash when missing", async () => {
    const m = await load({ ...PROD, NEXT_PUBLIC_SELLER_PORTAL_URL: "https://sell.example/" });
    expect(m.portalUrl("seller", "/register")).toBe("https://sell.example/register");
    expect(m.portalUrl("seller", "register")).toBe("https://sell.example/register");
    expect(m.portalUrl("seller", "/login?next=%2Fdashboard")).toBe("https://sell.example/login?next=%2Fdashboard");
    expect(m.portalUrl("seller")).toBe("https://sell.example");
  });

  it("is null when the origin is unknown", async () => {
    const m = await load(PROD);
    expect(m.portalUrl("seller", "/register")).toBeNull();
  });
});

describe("selfOrigin", () => {
  it("prefers the portal's own configured origin over every platform variable", async () => {
    const m = await load({
      ...PROD,
      NEXT_PUBLIC_CUSTOMER_PORTAL_URL: "https://shop.example",
      NEXTAUTH_URL: "https://auth.example",
      RENDER_EXTERNAL_URL: "https://render.example",
      VERCEL_PROJECT_PRODUCTION_URL: "vercel.example",
    });
    expect(m.selfOrigin("customer")).toBe("https://shop.example");
  });

  it("falls through NEXTAUTH_URL, then RENDER_EXTERNAL_URL, then VERCEL_PROJECT_PRODUCTION_URL", async () => {
    const withAll = await load({
      ...PROD,
      NEXTAUTH_URL: "https://auth.example/",
      RENDER_EXTERNAL_URL: "https://render.example",
      VERCEL_PROJECT_PRODUCTION_URL: "vercel.example",
    });
    expect(withAll.selfOrigin("customer")).toBe("https://auth.example");

    const withRender = await load({
      ...PROD,
      RENDER_EXTERNAL_URL: "https://render.example",
      VERCEL_PROJECT_PRODUCTION_URL: "vercel.example",
    });
    expect(withRender.selfOrigin("customer")).toBe("https://render.example");

    const withVercel = await load({ ...PROD, VERCEL_PROJECT_PRODUCTION_URL: "vercel.example" });
    expect(withVercel.selfOrigin("customer")).toBe("https://vercel.example");
  });

  it("skips a malformed NEXTAUTH_URL rather than trusting part of it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await load({
      ...PROD,
      NEXTAUTH_URL: "https://auth.example/api/auth",
      RENDER_EXTERNAL_URL: "https://render.example",
    });
    expect(m.selfOrigin("customer")).toBe("https://render.example");
  });

  it("is null in production when nothing is configured", async () => {
    const m = await load(PROD);
    expect(m.selfOrigin("customer")).toBeNull();
    expect(m.selfOrigin("seller")).toBeNull();
  });

  it("consults the platform variables before the dev fallback outside production", async () => {
    const tunnel = await load({ ...DEV, NEXTAUTH_URL: "https://tunnel.example" });
    expect(tunnel.selfOrigin("seller")).toBe("https://tunnel.example");

    const bare = await load(DEV);
    expect(bare.selfOrigin("seller")).toBe("http://localhost:13101");
  });
});

describe("emailSender", () => {
  it("is null when unset — there is no default sender", async () => {
    const m = await load(PROD);
    expect(m.emailSender()).toBeNull();
  });

  it("accepts a bare address and a named angle-address, trimmed", async () => {
    expect((await load({ RESEND_FROM_EMAIL: "noreply@mail.example" })).emailSender()).toBe("noreply@mail.example");
    expect((await load({ RESEND_FROM_EMAIL: "  Avenick <noreply@mail.example>  " })).emailSender()).toBe(
      "Avenick <noreply@mail.example>",
    );
    expect((await load({ RESEND_FROM_EMAIL: '"Avenick Commerce" <noreply@mail.example>' })).emailSender()).toBe(
      '"Avenick Commerce" <noreply@mail.example>',
    );
  });

  it("rejects every other shape and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const bad of [
      "not-an-address",
      "noreply@localhost",
      "Avenick <not-an-address>",
      "<noreply@mail.example>",
      "a@mail.example, b@mail.example",
      "Avenick noreply@mail.example",
      // A line break inside the display name is the shape of a header injection.
      "Avenick\r\nBcc: x <noreply@mail.example>",
      "Avenick\n<noreply@mail.example>",
    ]) {
      const m = await load({ RESEND_FROM_EMAIL: bad });
      expect(m.emailSender(), JSON.stringify(bad)).toBeNull();
      expect(m.emailSender(), JSON.stringify(bad)).toBeNull();
    }
    // One fresh module per value, one warning per module.
    expect(warn).toHaveBeenCalledTimes(8);
  });
});

describe("platformContacts", () => {
  it("is all null when nothing is configured", async () => {
    const m = await load(PROD);
    expect(m.platformContacts()).toEqual({ support: null, legal: null, privacy: null });
  });

  it("falls legal and privacy back to support", async () => {
    const m = await load({ NEXT_PUBLIC_SUPPORT_EMAIL: "help@mail.example" });
    expect(m.platformContacts()).toEqual({
      support: "help@mail.example",
      legal: "help@mail.example",
      privacy: "help@mail.example",
    });
  });

  it("keeps explicit legal and privacy addresses", async () => {
    const m = await load({
      NEXT_PUBLIC_SUPPORT_EMAIL: "help@mail.example",
      NEXT_PUBLIC_LEGAL_EMAIL: "legal@mail.example",
      NEXT_PUBLIC_PRIVACY_EMAIL: "privacy@mail.example",
    });
    expect(m.platformContacts()).toEqual({
      support: "help@mail.example",
      legal: "legal@mail.example",
      privacy: "privacy@mail.example",
    });
  });

  it("treats a malformed address as unset — a named sender is not a contact address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await load({
      NEXT_PUBLIC_SUPPORT_EMAIL: "help@mail.example",
      NEXT_PUBLIC_LEGAL_EMAIL: "Legal <legal@mail.example>",
      NEXT_PUBLIC_PRIVACY_EMAIL: "privacy",
    });
    expect(m.platformContacts()).toEqual({
      support: "help@mail.example",
      legal: "help@mail.example",
      privacy: "help@mail.example",
    });
    expect(warn).toHaveBeenCalledTimes(2);

    const noSupport = await load({ NEXT_PUBLIC_SUPPORT_EMAIL: "help at mail" });
    expect(noSupport.platformContacts()).toEqual({ support: null, legal: null, privacy: null });
  });
});

describe("platformName", () => {
  it("defaults to the brand name and trims a configured one", async () => {
    expect((await load(PROD)).platformName()).toBe("Avenick");
    expect((await load({ NEXT_PUBLIC_PLATFORM_NAME: "" })).platformName()).toBe("Avenick");
    expect((await load({ NEXT_PUBLIC_PLATFORM_NAME: "   " })).platformName()).toBe("Avenick");
    expect((await load({ NEXT_PUBLIC_PLATFORM_NAME: "  Manzil  " })).platformName()).toBe("Manzil");
  });
});
