// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import en from "../../../../messages/en.json";
import ar from "../../../../messages/ar.json";
import ProductsPage from "@/app/products/page";
import {
  resetCatalogSortHref,
  type CatalogSearchParams,
} from "../catalog-filters";

const state = vi.hoisted(() => ({
  locale: "en",
  params: new URLSearchParams(),
  push: vi.fn(),
  fetch: vi.fn(),
  refused: false,
  empty: false,
}));
vi.stubGlobal("React", React);
vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => ({ value: state.locale }) }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => state.params,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: state.locale === "ar" ? ar : en,
      namespace,
    }),
}));
vi.mock("@avenick/database", () => ({
  db: {},
  read: vi.fn(() => {
    throw new Error("Unexpected database read");
  }),
  publicProductWhere: vi.fn(),
  MIN_TRENDING_PRODUCTS: 3,
  TRENDING_WINDOW_DAYS: 7,
  getTrendingProducts: vi.fn(async () => []),
}));
vi.mock("@/lib/backend", () => ({
  fetchBackendJson: (...args: unknown[]) => state.fetch(...args),
}));
vi.mock("@/lib/b2b-server", () => ({
  getServerB2BContext: async () => ({ company: { country: "SA" } }),
}));
vi.mock("@/lib/public-category-tree", () => ({
  readPublicCategoryTree: async () => [],
}));
vi.mock("@/lib/public-brands", () => ({ readPublicBrands: async () => [] }));
vi.mock("@/components/layout/main-layout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ nameEn, nameAr }: { nameEn: string; nameAr: string }) => (
    <article>{state.locale === "ar" ? nameAr : nameEn}</article>
  ),
}));

// Resolve the real async server component tree while leaving client components
// for React/testing-library. No test-only exports are needed on the Next page.
async function resolveServerTree(
  node: React.ReactNode,
): Promise<React.ReactNode> {
  if (Array.isArray(node))
    return Promise.all(React.Children.toArray(node).map(resolveServerTree));
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return node;
  if (
    typeof node.type === "function" &&
    node.type.constructor.name === "AsyncFunction"
  ) {
    return resolveServerTree(await (node.type as Function)(node.props));
  }
  return node.props.children === undefined
    ? node
    : React.cloneElement(
        node,
        {},
        await resolveServerTree(node.props.children),
      );
}

async function show(params: CatalogSearchParams, locale = "en") {
  state.locale = locale;
  state.params = new URLSearchParams(params as Record<string, string>);
  state.fetch.mockImplementation(async (url: string) => {
    const query = new URL(url, "https://fixture.invalid").searchParams;
    const products =
      query.get("sort") === "rating" ||
      query.has("minRating") ||
      state.refused ||
      state.empty
        ? []
        : [
            {
              id: "unreviewed",
              slug: "bearing",
              nameEn: "Unreviewed bearing",
              nameAr: "محمل بدون مراجعات",
              sku: "B1",
              inventory: [],
              images: [],
            },
          ];
    return {
      products,
      total: products.length,
      totalPages: 1,
      search: state.refused
        ? { status: "too_short", minLength: 3 }
        : { status: "ok" },
    };
  });
  const tree = await resolveServerTree(
    await ProductsPage({ searchParams: params }),
  );
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? ar : en}
    >
      {tree}
    </NextIntlClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  state.push.mockClear();
  state.fetch.mockClear();
  state.refused = false;
  state.empty = false;
});

describe("catalog empty-result recovery", () => {
  it.each(["en", "ar"])(
    "recovers an unreviewed category in %s without losing channel/currency",
    async (locale) => {
      const messages = locale === "ar" ? ar : en;
      const params = {
        category: "bearings",
        currency: "SAR",
        b2b: "true",
        sort: "rating",
        page: "7",
      };
      await show(params, locale);
      expect(
        screen.getByText(messages.catalogue.empty.filters.headline),
      ).toBeTruthy();
      expect(
        screen.getByText(messages.catalogue.empty.filters.reviewedOnly),
      ).toBeTruthy();
      expect(
        screen.queryByText(messages.catalogue.empty.category.headline),
      ).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: messages.catalogue.empty.requestQuote,
        }),
      ).toBeNull();
      const recovery = screen.getByRole("link", {
        name: messages.catalogue.sortOptions.newest,
      });
      const href = recovery.getAttribute("href")!;
      const recovered = Object.fromEntries(
        new URL(href, "https://fixture.invalid").searchParams,
      );
      expect(recovered).toEqual({
        category: "bearings",
        currency: "SAR",
        b2b: "true",
        sort: "newest",
      });
      await userEvent
        .setup()
        .selectOptions(screen.getByRole("combobox"), "newest");
      expect(
        Object.fromEntries(
          new URL(state.push.mock.calls[0][0], "https://fixture.invalid")
            .searchParams,
        ),
      ).toEqual(recovered);
      cleanup();
      await show(recovered, locale);
      expect(screen.getByRole("article").textContent).toBe(
        locale === "ar" ? "محمل بدون مراجعات" : "Unreviewed bearing",
      );
      const request = new URL(
        state.fetch.mock.calls.at(-1)![0],
        "https://fixture.invalid",
      ).searchParams;
      expect(Object.fromEntries(request)).toMatchObject({
        categorySlug: "bearings",
        currency: "SAR",
        b2b: "true",
        page: "1",
      });
      expect(request.has("sort")).toBe(false);
    },
  );

  it("resets only sort and pagination, retaining search and explicit facets", () => {
    const params = {
      category: "bearings",
      brand: "brand",
      search: "bolt",
      inStock: "1",
      minRating: "4",
      moqMax: "10",
      currency: "AED",
      b2b: "true",
      sort: "rating",
      page: "9",
    };
    const { page, ...retained } = params;
    expect(
      Object.fromEntries(
        new URL(resetCatalogSortHref(params), "https://fixture.invalid")
          .searchParams,
      ),
    ).toEqual({ ...retained, sort: "newest" });
  });

  it("clear filters also removes rating sort when an explicit rating floor is active", async () => {
    await show({
      category: "bearings",
      minRating: "4",
      sort: "rating",
      currency: "SAR",
      b2b: "true",
    });
    const href = screen
      .getByRole("link", { name: en.catalogue.empty.clearFilters })
      .getAttribute("href")!;
    expect(
      Object.fromEntries(new URL(href, "https://fixture.invalid").searchParams),
    ).toEqual({ currency: "SAR", b2b: "true" });
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("keeps refused-search messaging and sorting without claiming category absence", async () => {
    state.refused = true;
    await show({ category: "bearings", search: "a", sort: "rating" });
    expect(screen.getByText(en.catalogue.refused.body)).toBeTruthy();
    expect(screen.queryByText(en.catalogue.empty.category.headline)).toBeNull();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("preserves the RFQ action for a genuinely empty category under default sort", async () => {
    state.empty = true;
    await show({ category: "bearings" });
    expect(screen.getByText(en.catalogue.empty.category.headline)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: en.catalogue.empty.requestQuote })
        .getAttribute("href"),
    ).toBe("/b2b/rfq/new");
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});
