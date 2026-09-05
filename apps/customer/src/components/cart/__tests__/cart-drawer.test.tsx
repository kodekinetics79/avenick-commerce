// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useCartStore } from "@/stores/cart";
import { ProductCard } from "@/components/products/product-card";
import { CartDrawer } from "../cart-drawer";
import { useCartDrawerStore } from "../cart-drawer-store";
import type { CartCompletionRow } from "../completions";

const push = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    `${key}${values ? `:${JSON.stringify(values)}` : ""}`,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const line = {
  productId: "p1",
  slug: "busbar-400a",
  channel: "B2C" as const,
  nameEn: "Busbar 400 A",
  nameAr: "قضيب توزيع",
  sku: "BB-400",
  qty: 5,
  moq: 5,
  unitPrice: 120,
  vatRate: 5,
  sellerId: "seller-1",
  currency: "AED",
};

const completion = (over: Partial<CartCompletionRow> = {}): CartCompletionRow => ({
  id: "c1",
  slug: "lug-400",
  nameEn: "Cable lug 400",
  nameAr: "طرف كابل",
  sku: "LUG-400",
  sellerId: "seller-1",
  price: 8,
  currency: "AED",
  vatRate: 5,
  inStock: true,
  hasVariants: false,
  priceTiered: false,
  moq: 1,
  rating: null,
  ...over,
});

beforeEach(() => {
  push.mockClear();
  act(() => {
    useCartStore.getState().clearCart();
    useCartDrawerStore.setState({ open: false, lastAddedKey: null, lastAddedBands: null, completions: [] });
  });
});

afterEach(cleanup);

describe("CartDrawer", () => {
  it("does not open on load, opens as a modal dialog on openFor, and never navigates", () => {
    render(<CartDrawer />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      useCartStore.getState().addItem(line);
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("drawer.title");
    expect(dialog.textContent).toContain("Busbar 400 A");
    expect(dialog.textContent).toContain("drawer.exclVat");
    expect(within(dialog).getByRole("link", { name: /^checkout/ }).getAttribute("href")).toBe("/checkout");
    expect(within(dialog).getByRole("link", { name: /drawer\.viewCart/ }).getAttribute("href")).toBe("/cart");
    expect(push).not.toHaveBeenCalled();
    // "You might also need" is absent when there is nothing to say.
    expect(dialog.textContent).not.toContain("drawer.alsoNeed");
  });

  it("closes on Escape and returns focus to the control that opened it", async () => {
    render(
      <>
        <button type="button">trigger</button>
        <CartDrawer />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "trigger" });
    trigger.focus();
    act(() => {
      useCartStore.getState().addItem(line);
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });
    const dialog = screen.getByRole("dialog");
    // Focus is trapped inside the layer while it is open.
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(useCartDrawerStore.getState().open).toBe(false);
  });

  it("steps quantity in place for a flat line and never below the MOQ", () => {
    render(<CartDrawer />);
    act(() => {
      useCartStore.getState().addItem(line);
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });
    const dialog = screen.getByRole("dialog");
    const decrease = within(dialog).getByRole("button", { name: "drawer.decrease" });
    const increase = within(dialog).getByRole("button", { name: "drawer.increase" });
    expect((decrease as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(increase);
    expect(useCartStore.getState().items[0]!.qty).toBe(6);
    expect((decrease as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(decrease);
    expect(useCartStore.getState().items[0]!.qty).toBe(5);
  });

  it("shows a B2B line's ladder basis and sends its quantity change through the product page", () => {
    render(<CartDrawer />);
    act(() => {
      useCartStore.getState().addItem({ ...line, channel: "B2B", qty: 10, moq: 10, unitPrice: 100 });
      useCartDrawerStore.getState().openFor({
        productId: "p1",
        priceBands: [
          { minQty: 10, maxQty: 49, amount: 100 },
          { minQty: 50, maxQty: null, amount: 90 },
        ],
      });
    });
    const dialog = screen.getByRole("dialog");
    // No in-place stepper: the "+" is a link that reprices on the product page.
    expect(within(dialog).queryByRole("button", { name: "drawer.increase" })).toBeNull();
    const up = within(dialog).getByRole("link", { name: /drawer\.repriceAt.*"count":11/ });
    expect(up.getAttribute("href")).toBe("/products/busbar-400a?currency=AED&b2b=true&qty=11");
    expect(dialog.textContent).toContain("drawer.tiered");
    // The ladder is a real table with the buyer's band marked.
    const table = within(dialog).getByRole("table");
    const active = table.querySelector('tr[data-active="true"]');
    expect(active?.textContent).toContain("10–49");
    expect(within(dialog).getByRole("link", { name: /drawer\.purchaseOrder/ }).getAttribute("href")).toBe(
      "/b2b/purchase-orders/new",
    );
  });

  it("renders passed completions minus what is in the cart, routes the quote path to RFQ, and adds in place", () => {
    const rows = [
      completion({ id: "p1", slug: "busbar-400a" }), // already in the cart: dropped
      completion({ id: "c2", nameEn: "Terminal block", price: undefined, currency: undefined, vatRate: undefined }),
      completion(),
    ];
    render(<CartDrawer completions={rows} />);
    act(() => {
      useCartStore.getState().addItem(line);
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("drawer.alsoNeed");
    const rail = within(dialog).getByRole("list");
    expect(within(rail).getAllByRole("listitem")).toHaveLength(2);

    const quote = within(rail).getByRole("link", { name: /requestQuote/ });
    expect(quote.getAttribute("href")).toBe("/b2b/rfq/new?supplier=seller-1&product=c2");

    fireEvent.click(within(rail).getByRole("button", { name: /addToCart/ }));
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(["p1", "c1"]);
    // The drawer stays open, features the new line, and stops suggesting it.
    expect(screen.getByRole("dialog").textContent).toContain("Cable lug 400");
    expect(useCartDrawerStore.getState()).toMatchObject({ open: true, lastAddedKey: "c1-" });
    expect(within(screen.getByRole("dialog")).getAllByRole("listitem")).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  /**
   * The rail's heading is a CLAIM. "You might also need" sits over rows two
   * distinct buyers actually ordered together; when nothing has been ordered
   * together yet the route sends affinity rows with basis "related", and the
   * heading has to change with them — otherwise the drawer would put words in
   * other buyers' mouths on a catalogue where nobody has bought anything.
   */
  it("heads the rail with the claim its basis supports", () => {
    render(<CartDrawer completions={[completion({ basis: "related" })]} />);
    act(() => {
      useCartStore.getState().addItem(line);
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("drawer.alsoRelated");
    expect(dialog.textContent).not.toContain("drawer.alsoNeed");
  });

  it("keeps the co-purchase heading when the basis is co-purchase, and when none is reported", () => {
    const { unmount } = render(<CartDrawer completions={[completion({ basis: "co-purchase" })]} />);
    act(() => {
      useCartStore.getState().addItem(line);
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });
    expect(screen.getByRole("dialog").textContent).toContain("drawer.alsoNeed");
    unmount();
    cleanup();

    render(<CartDrawer completions={[completion()]} />);
    act(() => {
      useCartDrawerStore.getState().openFor({ productId: "p1" });
    });
    expect(screen.getByRole("dialog").textContent).toContain("drawer.alsoNeed");
  });

  it("opens from the product card's add-to-cart without leaving the page", () => {
    render(
      <>
        <ProductCard
          id="p1"
          slug="busbar-400a"
          nameEn="Busbar 400 A"
          nameAr="قضيب توزيع"
          price={120}
          currency="AED"
          vatRate={5}
          priceTiered={false}
          sku="BB-400"
          sellerId="seller-1"
          moq={5}
          locale="en"
        />
        <CartDrawer />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /addToCart/ }));
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]).toMatchObject({ productId: "p1", qty: 5, moq: 5 });
    expect(screen.getByRole("dialog").textContent).toContain("Busbar 400 A");
    expect(push).not.toHaveBeenCalled();
  });
});
