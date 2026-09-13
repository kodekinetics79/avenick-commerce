import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brands: vi.fn(),
  tree: vi.fn(),
  locale: { value: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => (mocks.locale.value ? { value: mocks.locale.value } : undefined) }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@avenick/utils/portal-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@avenick/utils/portal-config")>()),
  selfOrigin: () => "https://shop.example",
}));
vi.mock("@/lib/public-brands", () => ({ readPublicBrands: mocks.brands }));
vi.mock("@/lib/public-category-tree", () => ({ readPublicCategoryTree: mocks.tree }));
vi.mock("@avenick/database", () => ({ db: {}, PUBLIC_CATALOG_SELLER: {} }));
vi.mock("@/lib/backend", () => ({ fetchBackendJson: vi.fn() }));
vi.mock("@/lib/b2b-server", () => ({ getServerB2BContext: vi.fn() }));

import { generateMetadata } from "../page";

/**
 * A brand listing is its own page, with its own title and no borrowed canonical.
 *
 * THE DEFECT. /products?brand=<slug> is the only address a brand has — there is
 * no /brands/<slug> route — and it lists only that brand's products. The branch
 * that added canonicals gave it the plain catalogue's head: the title "All
 * products" and a canonical naming /products. That tells a crawler every brand
 * listing duplicates the whole catalogue and should be folded into it, so no
 * brand listing could be indexed, and a shared brand link unfurled as "All
 * products". A category narrowed by a brand made the same claim about
 * /categories/<slug>.
 */

const mennekes = { id: "b1", slug: "mennekes", nameEn: "Mennekes", nameAr: "مينيكس", logoUrl: null, _count: { products: 3 } };
const tree = [
  { id: "c1", slug: "wiring", nameEn: "Wiring Devices", nameAr: "أجهزة الأسلاك", iconName: null, parentId: null, sortOrder: 0, children: [] },
];

beforeEach(() => {
  mocks.brands.mockReset().mockResolvedValue([mennekes]);
  mocks.tree.mockReset().mockResolvedValue(tree);
  mocks.locale.value = undefined;
});

const meta = (searchParams: Record<string, string>) => generateMetadata({ searchParams } as never);

describe("catalogue metadata for a brand listing", () => {
  it("titles the listing with the brand and names no canonical", async () => {
    const head = await meta({ brand: "mennekes" });
    expect(head.title).toBe('title.brand:{"brand":"Mennekes"}');
    expect(head.alternates).toBeUndefined();
  });

  it("names the brand in the reader's language", async () => {
    mocks.locale.value = "ar";
    expect((await meta({ brand: "mennekes" })).title).toBe('title.brand:{"brand":"مينيكس"}');
  });

  it("does not echo an unknown brand slug, and still names no canonical", async () => {
    const head = await meta({ brand: "no-such-brand" });
    expect(head.title).toBe("title.all");
    expect(head.alternates).toBeUndefined();
  });

  it("does not point a category narrowed by a brand at the category page", async () => {
    const head = await meta({ category: "wiring", brand: "mennekes" });
    expect(head.title).toBe('title.category:{"category":"Wiring Devices"}');
    expect(head.alternates).toBeUndefined();
  });

  it("still names the canonical for the plain catalogue and for a plain category", async () => {
    expect((await meta({})).alternates).toEqual({ canonical: "https://shop.example/products" });
    expect((await meta({ category: "wiring" })).alternates).toEqual({ canonical: "https://shop.example/categories/wiring" });
  });
});
