// @vitest-environment jsdom

import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SpatialSceneProps } from "./scene";
import { SpatialCommerceShell } from "./spatial-commerce-shell";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) => `${key}${values ? `:${JSON.stringify(values)}` : ""}`,
}));

vi.mock("./scene", () => ({
  skuIdForSpatialTarget: (nodeId: string, bindings: Map<string, { targetIds: readonly string[] }>) => {
    const matches = [...bindings].filter(([, binding]) => binding.targetIds.includes(nodeId));
    return matches.length === 1 ? matches[0]![0] : null;
  },
  SpatialScene: (props: SpatialSceneProps) => (
    <div>
      <button
        type="button"
        data-testid="scene-adapter"
        data-node={props.selectedNodeId ?? ""}
        data-pulse={props.pulseRevision}
        data-webgl-load={String(props.allowWebGLLoad)}
        onClick={() => props.onNodeSelect?.("drive-shaft", "scene")}
      >
        scene
      </button>
      <button
        type="button"
        data-testid="accessible-part"
        onClick={() => props.onNodeSelect?.("motor-housing", "accessible-control")}
      >
        accessible part
      </button>
    </div>
  ),
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(globalThis, "CSS", { value: { escape: (value: string) => value } });
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const items = [
  { id: "sku-1", sku: "FIX-1", name: "Bearing", description: "Fixture", unitPrice: 10, currency: "AED" as const, minimumOrderQuantity: 2, leadTimeDays: 3, availability: "available" as const },
  { id: "sku-2", sku: "FIX-2", name: "Fastener", description: "Fixture", unitPrice: 20, currency: "AED" as const, minimumOrderQuantity: 4, leadTimeDays: 5, availability: "limited" as const },
  { id: "sku-3", sku: "FIX-3", name: "Seal", description: "Fixture", unitPrice: 30, currency: "AED" as const, minimumOrderQuantity: 1, leadTimeDays: 8, availability: "unavailable" as const },
];
const bindings = [
  { skuId: "sku-1", targetIds: ["mounting-plate"] },
  { skuId: "sku-2", targetIds: ["motor-housing", "drive-shaft"] },
];

describe("SpatialCommerceShell integration", () => {
  it("maps row selection to a scene node and restarts pulse on reselection", async () => {
    render(<SpatialCommerceShell items={items} bindings={bindings} fixtureMode />);
    const row = document.querySelector<HTMLElement>('[data-spatial-surface="desktop"][data-spatial-sku-id="sku-1"]')!;

    fireEvent.click(row);
    expect(screen.getByTestId("scene-adapter").getAttribute("data-node")).toBe("mounting-plate");
    expect(screen.getByTestId("scene-adapter").getAttribute("data-pulse")).toBe("1");

    fireEvent.click(row);
    expect(screen.getByTestId("scene-adapter").getAttribute("data-pulse")).toBe("2");
    expect(screen.getByRole("status").textContent).toContain("selection.sequence");
  });

  it("maps a scene-node selection back to the corresponding SKU row", () => {
    render(<SpatialCommerceShell fixtureMode items={items} bindings={bindings} />);
    fireEvent.click(screen.getByTestId("scene-adapter"));
    const rows = document.querySelectorAll<HTMLElement>('[data-spatial-sku-id="sku-2"]');
    expect([...rows].some((row) => row.getAttribute("aria-pressed") === "true")).toBe(true);
    expect(screen.getByTestId("scene-adapter").getAttribute("data-node")).toBe("drive-shaft");
    expect(document.activeElement?.getAttribute("data-spatial-surface")).toBe("desktop");
    expect(document.activeElement?.getAttribute("data-spatial-sku-id")).toBe("sku-2");
  });

  it("keeps focus on accessible part controls while updating the selected SKU", () => {
    render(<SpatialCommerceShell fixtureMode items={items} bindings={bindings} />);
    const part = screen.getByTestId("accessible-part");
    part.focus();

    fireEvent.click(part);

    expect(document.activeElement).toBe(part);
    expect(screen.getByTestId("scene-adapter").getAttribute("data-node")).toBe("motor-housing");
  });

  it("selects an unmapped SKU without crashing or inventing a scene target", () => {
    render(<SpatialCommerceShell fixtureMode items={items} bindings={bindings} />);
    fireEvent.click(document.querySelector<HTMLElement>('[data-spatial-surface="desktop"][data-spatial-sku-id="sku-3"]')!);
    expect(screen.getByTestId("scene-adapter").getAttribute("data-node")).toBe("");
    expect(screen.getByRole("status").textContent).toContain("selection.unmapped");
  });
});
