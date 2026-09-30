import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { OrderTotalsSchema } from "../checkout";

/**
 * `OrderTotalsSchema` must stay field-for-field identical to the `OrderTotals`
 * interface `composeOrderTotals` returns.
 *
 * The brief for this schema is "mirror it exactly", and a comment saying so is
 * not a mirror. This reads the service's source and compares the field names,
 * so a field added to the invariants module — a second discount, a levy, a
 * separate freight surcharge — fails here instead of reaching the app as a
 * figure the contract silently drops.
 *
 * The source is read rather than imported on purpose: importing it would pull
 * `@prisma/client` into this package, which is exactly the dependency this
 * package is built to avoid.
 */
const servicePath = path.resolve(import.meta.dirname, "../../../database/src/services/checkout-invariants.ts");

describe("OrderTotals mirrors the checkout service", () => {
  it("can find checkout-invariants.ts", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  const source = fs.readFileSync(servicePath, "utf8");

  it("declares exactly the fields the OrderTotals interface declares", () => {
    const body = /export interface OrderTotals\s*\{([\s\S]*?)^\}/m.exec(source);
    expect(body, "OrderTotals interface not found in checkout-invariants.ts").not.toBeNull();
    const serviceFields = [...body![1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map((match) => match[1]).sort();
    const contractFields = Object.keys(OrderTotalsSchema.innerType().shape).sort();
    expect(contractFields).toEqual(serviceFields);
  });

  it("keeps both VAT components, which is the property PR #21 depends on", () => {
    const contractFields = Object.keys(OrderTotalsSchema.innerType().shape);
    expect(contractFields).toContain("goodsVatAmount");
    expect(contractFields).toContain("shippingVatAmount");
    expect(source).toContain("shippingVatAmount");
  });
});
