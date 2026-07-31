import type { MechanicalSku } from "../domain/contracts";
import type { SkuSpatialBinding } from "../domain/bindings";

export interface DevelopmentMechanicalFixture {
  readonly fixtureOnly: true;
  readonly fixtureName: "synthetic-mechanical-skus";
  readonly skus: readonly MechanicalSku[];
  readonly bindings: readonly SkuSpatialBinding[];
}

const SYNTHETIC_MECHANICAL_FIXTURE: DevelopmentMechanicalFixture = {
  fixtureOnly: true,
  fixtureName: "synthetic-mechanical-skus",
  skus: [
    {
      id: "fixture-sku-bearing-01",
      sku: "FIX-MECH-BRG-001",
      name: "Fixture radial bearing",
      nameAr: "محمل شعاعي تجريبي",
      description: "Synthetic development bearing; not a saleable catalog item.",
      descriptionAr: "محمل اصطناعي للتطوير؛ ليس عنصرًا قابلاً للبيع.",
      unitPrice: 111.11,
      currency: "AED",
      minimumOrderQuantity: 10,
      leadTimeDays: 7,
      availability: "available",
    },
    {
      id: "fixture-sku-fastener-02",
      sku: "FIX-MECH-FST-002",
      name: "Fixture fastener kit",
      nameAr: "طقم مثبتات تجريبي",
      description: "Synthetic development fastener set; not a saleable catalog item.",
      descriptionAr: "طقم مثبتات اصطناعي للتطوير؛ ليس عنصرًا قابلاً للبيع.",
      unitPrice: 222.22,
      currency: "AED",
      minimumOrderQuantity: 25,
      leadTimeDays: 14,
      availability: "limited",
    },
    {
      id: "fixture-sku-seal-03",
      sku: "FIX-MECH-SEL-003",
      name: "Fixture mechanical seal",
      nameAr: "مانع تسرب ميكانيكي تجريبي",
      description: "Synthetic development seal with intentionally missing 3D representation.",
      descriptionAr: "مانع تسرب اصطناعي للتطوير دون تمثيل ثلاثي الأبعاد عمدًا.",
      unitPrice: 333.33,
      currency: "AED",
      minimumOrderQuantity: 5,
      leadTimeDays: 21,
      availability: "unavailable",
    },
  ],
  bindings: [
    { skuId: "fixture-sku-bearing-01", targetIds: ["mounting-plate"] },
    {
      skuId: "fixture-sku-fastener-02",
      targetIds: ["motor-housing", "drive-shaft", "output-coupling"],
    },
  ],
};

/** Production deliberately cannot obtain this synthetic, identity-free fixture. */
export function getDevelopmentMechanicalFixture(
): DevelopmentMechanicalFixture {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development mechanical SKU fixtures are unavailable in production.");
  }

  return SYNTHETIC_MECHANICAL_FIXTURE;
}
