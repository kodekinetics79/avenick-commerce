import { describe, expect, it } from "vitest";
import {
  B2B_MODE_CONTRACTS,
  B2B_SPATIAL_MODES,
  hasProductionArabicContent,
  type MechanicalSku,
} from "./contracts";

describe("B2B mode contracts", () => {
  it("defines a complete contract for every supported mode", () => {
    expect(Object.keys(B2B_MODE_CONTRACTS).sort()).toEqual([...B2B_SPATIAL_MODES].sort());
    for (const mode of B2B_SPATIAL_MODES) {
      expect(B2B_MODE_CONTRACTS[mode].mode).toBe(mode);
    }
  });

  it("limits inspect and procure to one selection", () => {
    expect(B2B_MODE_CONTRACTS.inspect.selectionLimit).toBe(1);
    expect(B2B_MODE_CONTRACTS.procure.selectionLimit).toBe(1);
    expect(B2B_MODE_CONTRACTS.compare.allowsMultipleSelection).toBe(true);
  });
});

describe("production spatial SKU localization", () => {
  const baseSku: MechanicalSku = {
    id: "sku-1",
    sku: "MECH-001",
    name: "Mechanical seal",
    description: "Mechanical seal for an assembly.",
    unitPrice: 10,
    currency: "AED",
    minimumOrderQuantity: 2,
    leadTimeDays: 5,
    availability: "available",
  };

  it("accepts complete Arabic product content", () => {
    expect(hasProductionArabicContent({
      ...baseSku,
      nameAr: "مانع تسرب ميكانيكي",
      descriptionAr: "مانع تسرب مخصص لتجميعة ميكانيكية.",
    })).toBe(true);
  });

  it.each([
    { nameAr: undefined, descriptionAr: "وصف" },
    { nameAr: "اسم", descriptionAr: undefined },
    { nameAr: "  ", descriptionAr: "وصف" },
    { nameAr: "اسم", descriptionAr: "  " },
  ])("rejects incomplete Arabic product content", (localized) => {
    expect(hasProductionArabicContent({ ...baseSku, ...localized })).toBe(false);
  });
});
