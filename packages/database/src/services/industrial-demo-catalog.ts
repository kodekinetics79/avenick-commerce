import type { Currency } from "@prisma/client";
import { INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS } from "./demo-product-enrichment";

export const INDUSTRIAL_DEMO_CURRENCY: Currency = "SAR";
export const INDUSTRIAL_DEMO_TAG = "AVENICK_INDUSTRIAL_DEMO_V1";

export const INDUSTRIAL_DEMO_CATEGORIES = [
  {
    slug: "industrial-standard-plugs",
    nameEn: "Industrial Standard Plugs",
    nameAr: "مقابس صناعية قياسية",
    parts: ["13501", "13502", "13506", "13510", "13512", "13513", "13516", "13520", "13102", "13106", "13112", "13202"],
  },
  {
    slug: "industrial-high-ip-plugs",
    nameEn: "High-IP Industrial Plugs",
    nameAr: "مقابس صناعية عالية الحماية",
    parts: ["13619", "13620", "13622", "13624", "13649", "13625", "13627", "13629"],
  },
  {
    slug: "industrial-connectors",
    nameEn: "Industrial Connectors",
    nameAr: "موصلات صناعية",
    parts: ["14626", "14261P", "14260P", "14248"],
  },
  {
    slug: "panel-mounted-receptacles",
    nameEn: "Panel-Mounted Receptacles",
    nameAr: "مآخذ مثبتة على اللوحات",
    parts: ["1457", "1491", "1458", "1128A"],
  },
  {
    slug: "wall-mounted-receptacles",
    nameEn: "Wall-Mounted Receptacles",
    nameAr: "مآخذ مثبتة على الجدران",
    parts: ["32", "10118"],
  },
] as const;

const categoryByPart = new Map<string, string>(
  INDUSTRIAL_DEMO_CATEGORIES.flatMap((category) => category.parts.map((part) => [part, category.slug] as const)),
);

export function industrialDemoCategorySlug(partNumber: string) {
  const slug = categoryByPart.get(partNumber);
  if (!slug) throw new Error(`Industrial demo part ${partNumber} has no reviewed category`);
  return slug;
}

export function industrialDemoSellerIndex(partNumber: string) {
  const index = (INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS as readonly string[]).indexOf(partNumber);
  if (index < 0) throw new Error(`Industrial demo part ${partNumber} is outside the reviewed set`);
  return index % 3;
}

export function industrialDemoCommercialFacts(partNumber: string) {
  const index = (INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS as readonly string[]).indexOf(partNumber);
  if (index < 0) throw new Error(`Industrial demo part ${partNumber} is outside the reviewed set`);
  return {
    price: 85 + index * 7,
    onHand: 72 + index * 3,
    reserved: 0,
    reorderPoint: 12,
  };
}

export function validateIndustrialDemoCatalog() {
  const reviewed = new Set<string>(INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS);
  const assigned = INDUSTRIAL_DEMO_CATEGORIES.flatMap((category) => category.parts);
  if (assigned.length !== reviewed.size || new Set(assigned).size !== assigned.length) {
    throw new Error("Every reviewed industrial demo part must have exactly one category");
  }
  for (const part of assigned) {
    if (!reviewed.has(part)) throw new Error(`Unreviewed industrial demo part ${part}`);
  }
  return { products: assigned.length, categories: INDUSTRIAL_DEMO_CATEGORIES.length, sellers: 3 };
}
