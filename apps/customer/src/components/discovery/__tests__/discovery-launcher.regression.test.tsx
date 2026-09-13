// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { DiscoveryPlan } from "../interest-signals";
import { DiscoveryPanel } from "../discovery-panel";
import { DiscoveryProvider, useDiscoveryLauncher } from "../discovery-context";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products/some-product",
  useSearchParams: () => new URLSearchParams(),
}));

const EMPTY: DiscoveryPlan = {
  blocks: [],
  basis: { views: 0, categoryVisits: 0, searches: 0 },
  needsMoreSignal: false,
} as unknown as DiscoveryPlan;

const A_SEARCH: DiscoveryPlan = {
  blocks: [{ kind: "resumeSearch", term: "glove", href: "/search?q=glove", reason: { kind: "lastSearch", term: "glove" } }],
  basis: { views: 0, categoryVisits: 0, searches: 1 },
  needsMoreSignal: false,
} as unknown as DiscoveryPlan;

let plan = A_SEARCH;

vi.mock("../interest-signals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../interest-signals")>()),
  buildDiscoveryPlan: () => plan,
}));

vi.mock("../use-discovery", () => ({
  useDiscoverySignals: () => ({ ready: true, history: {}, clear: vi.fn(), dismissedAt: null, dismiss: vi.fn() }),
  useCatalogueLabels: () => ({ categoryNames: new Map(), brandSlugs: new Map() }),
}));

afterEach(() => {
  cleanup();
  plan = A_SEARCH;
});

/** Stands in for the header: reads the bridge the way the sheet does. */
let launcher: ReturnType<typeof useDiscoveryLauncher> = null;
function ChromeProbe() {
  launcher = useDiscoveryLauncher();
  return null;
}

describe("the discovery launcher on a phone", () => {
  /**
   * At 390×844 the floating launcher was 108×30 at y 726–756, lifted 5.5rem to
   * clear the product page's buy bar. On the product page, elementFromPoint at
   * the wishlist heart's lower centre returned the launcher, so a tap meant for
   * the wishlist opened Discovery. It also covered the end of the cart's
   * "Request a quote", a chip row on search and the help band's copy. Below lg
   * there is no floating control at all.
   */
  it("draws no floating pill below lg, and keeps it at lg and up", () => {
    render(<DiscoveryPanel />);
    const pill = screen.getByRole("button", { name: /launcher/ });
    const classes = pill.className.split(/\s+/);
    expect(classes).toContain("hidden");
    expect(classes).toContain("lg:inline-flex");
    expect(classes).not.toContain("inline-flex");
  });

  it("tells the chrome it has something to say, and opens when the chrome asks", () => {
    render(
      <DiscoveryProvider>
        <ChromeProbe />
        <DiscoveryPanel />
      </DiscoveryProvider>,
    );

    expect(launcher?.available).toBe(true);
    expect(document.getElementById("discovery-panel")).toBeNull();

    act(() => launcher!.open());
    expect(screen.getByRole("region")).toHaveProperty("id", "discovery-panel");
  });

  /**
   * The menu must never offer a panel that would render nothing. The panel is
   * the only thing that knows, so availability is its report, not a guess.
   */
  it("reports nothing to offer when the panel would render nothing", () => {
    plan = EMPTY;
    const { container } = render(
      <DiscoveryProvider>
        <ChromeProbe />
        <DiscoveryPanel />
      </DiscoveryProvider>,
    );

    expect(launcher?.available).toBe(false);
    expect(container.innerHTML).toBe("");
  });

  /**
   * The lift above the product page's buy bar was deliberate, and it still
   * applies to the open panel, so the panel never sits on the buy bar.
   */
  it("keeps the open panel clear of the product page's buy bar", () => {
    const { container } = render(<DiscoveryPanel />);
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]",
    );
  });
});
