import { describe, expect, it } from "vitest";
import { createSpatialBindingIndex, resolveSkuBinding } from "./bindings";

describe("resolveSkuBinding", () => {
  it("resolves a one-to-one SKU binding", () => {
    expect(resolveSkuBinding("sku-1", [{ skuId: "sku-1", targetIds: ["node-a"] }])).toEqual({
      skuId: "sku-1",
      cardinality: "one",
      targetIds: ["node-a"],
      hasSpatialRepresentation: true,
    });
  });

  it("combines one-to-many bindings and removes duplicate targets", () => {
    expect(
      resolveSkuBinding("sku-1", [
        { skuId: "sku-1", targetIds: ["node-a", "node-b"] },
        { skuId: "sku-1", targetIds: ["node-b", "node-c"] },
      ]),
    ).toMatchObject({ cardinality: "many", targetIds: ["node-a", "node-b", "node-c"] });
  });

  it("returns an explicit missing resolution", () => {
    expect(resolveSkuBinding("sku-missing", [])).toEqual({
      skuId: "sku-missing",
      cardinality: "missing",
      targetIds: [],
      hasSpatialRepresentation: false,
    });
  });

  it("builds an index that retains missing SKUs", () => {
    const index = createSpatialBindingIndex(["sku-1", "sku-2"], [
      { skuId: "sku-1", targetIds: ["node-a"] },
    ]);

    expect(index.get("sku-1")?.cardinality).toBe("one");
    expect(index.get("sku-2")?.cardinality).toBe("missing");
  });
});
