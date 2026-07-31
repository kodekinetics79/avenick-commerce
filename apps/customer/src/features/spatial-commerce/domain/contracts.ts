export const B2B_SPATIAL_MODES = ["inspect", "procure", "compare"] as const;

export type B2BSpatialMode = (typeof B2B_SPATIAL_MODES)[number];

export interface B2BModeContract {
  readonly mode: B2BSpatialMode;
  readonly allowsMultipleSelection: boolean;
  readonly showsCommercialTerms: boolean;
  readonly selectionLimit: number | null;
}

export const B2B_MODE_CONTRACTS: Readonly<Record<B2BSpatialMode, B2BModeContract>> = {
  inspect: {
    mode: "inspect",
    allowsMultipleSelection: false,
    showsCommercialTerms: false,
    selectionLimit: 1,
  },
  procure: {
    mode: "procure",
    allowsMultipleSelection: false,
    showsCommercialTerms: true,
    selectionLimit: 1,
  },
  compare: {
    mode: "compare",
    allowsMultipleSelection: true,
    showsCommercialTerms: true,
    selectionLimit: null,
  },
};

export type SpatialAvailability = "available" | "limited" | "unavailable";

export interface MechanicalSku {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly nameAr?: string;
  readonly description: string;
  readonly descriptionAr?: string;
  readonly unitPrice: number;
  readonly currency: "AED" | "SAR" | "USD";
  readonly minimumOrderQuantity: number;
  readonly leadTimeDays: number;
  readonly availability: SpatialAvailability;
}

/**
 * Production catalog adapters must return complete Arabic commerce content.
 * The looser MechanicalSku remains useful for explicitly disclosed fixtures and
 * migration inputs, while this type prevents an Arabic production surface from
 * silently falling back to mixed-direction English product content.
 */
export type ProductionMechanicalSku = MechanicalSku & {
  readonly nameAr: string;
  readonly descriptionAr: string;
};

export function hasProductionArabicContent(item: MechanicalSku): item is ProductionMechanicalSku {
  return Boolean(item.nameAr?.trim() && item.descriptionAr?.trim());
}
