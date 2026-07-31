// @vitest-environment jsdom

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSpatialBindingIndex } from "../../domain/bindings";
import type { SpatialSkuTableLabels, SpatialSkuTableProps } from "./sku-table";
import { SpatialSkuTable } from "./sku-table";

const labels: SpatialSkuTableLabels = {
  caption: "Mechanical SKU catalog",
  sku: "SKU",
  item: "Item",
  availability: "Availability",
  minimumOrderQuantity: "MOQ",
  leadTime: "Lead time",
  spatialStatus: "3D status",
  bound3d: "3D available",
  missing3d: "3D unavailable",
  loading: "Loading SKUs",
  empty: "No SKUs",
  error: "Unable to load SKUs",
  days: (value) => `${value} days`,
  quantity: (value) => String(value),
  price: (value, currency) => `${currency} ${value.toFixed(2)}`,
  availabilityValue: (value) => value,
};

const items = [
  {
    id: "sku-1",
    sku: "FIX-1",
    name: "Fixture bearing",
    description: "Fixture",
    unitPrice: 10,
    currency: "AED" as const,
    minimumOrderQuantity: 2,
    leadTimeDays: 3,
    availability: "available" as const,
  },
  {
    id: "sku-2",
    sku: "FIX-2",
    name: "Fixture seal",
    description: "Fixture",
    unitPrice: 20,
    currency: "AED" as const,
    minimumOrderQuantity: 4,
    leadTimeDays: 5,
    availability: "limited" as const,
  },
];

afterEach(cleanup);

function renderTable(overrides: Partial<SpatialSkuTableProps> = {}) {
  const onSelect = vi.fn();
  render(
    <SpatialSkuTable
      items={items}
      bindings={createSpatialBindingIndex(
        items.map((item) => item.id),
        [{ skuId: "sku-1", targetIds: ["node-1"] }],
      )}
      selectedSkuId="sku-1"
      onSelect={onSelect}
      labels={labels}
      {...overrides}
    />,
  );
  return { onSelect };
}

function desktopSkuRow(sku: string) {
  return desktopSkuButton(sku).closest("tr")!;
}

function desktopSkuButton(sku: string) {
  const table = screen.getByRole("table", { name: labels.caption });
  return within(table).getByRole("button", { name: new RegExp(sku) });
}

describe("SpatialSkuTable", () => {
  it("renders a semantic desktop table and native mobile selection controls", () => {
    renderTable();

    expect(desktopSkuButton("FIX-1").getAttribute("aria-pressed")).toBe("true");
    expect(desktopSkuButton("FIX-1").getAttribute("data-spatial-sku-id")).toBe("sku-1");
    const mobileButton = document.querySelector<HTMLButtonElement>('[data-spatial-surface="mobile"][data-spatial-sku-id="sku-1"]')!;
    expect(mobileButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("3D unavailable")).toHaveLength(2);
    expect(desktopSkuButton("FIX-2").getAttribute("data-binding-cardinality")).toBe("missing");
  });

  it("selects from a pointer click and reports the table source", () => {
    const { onSelect } = renderTable();

    fireEvent.click(desktopSkuButton("FIX-2"));

    expect(onSelect).toHaveBeenCalledWith("sku-2", "sku-table");
  });

  it("supports Enter, Space, and reselecting an already-selected SKU", async () => {
    const { onSelect } = renderTable();
    const button = desktopSkuButton("FIX-1");
    const user = userEvent.setup();

    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenNthCalledWith(1, "sku-1", "sku-table");
    expect(onSelect).toHaveBeenNthCalledWith(2, "sku-1", "sku-table");
    expect(onSelect).toHaveBeenNthCalledWith(3, "sku-1", "sku-table");
  });

  it("treats an absent binding-index entry as missing without crashing", () => {
    renderTable({ bindings: new Map() });

    expect(desktopSkuButton("FIX-1").getAttribute("data-binding-cardinality")).toBe("missing");
    expect(screen.getAllByText("3D unavailable")).toHaveLength(4);
  });

  it.each([
    ["loading", { loading: true }, "Loading SKUs"],
    ["empty", { items: [] }, "No SKUs"],
    ["error", { error: "network offline" }, "Unable to load SKUs: network offline"],
  ])("renders the %s state", (_state, overrides, expected) => {
    renderTable(overrides);
    expect(screen.getAllByText(expected)).toHaveLength(2);
  });
});
