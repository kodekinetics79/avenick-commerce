import { createHash } from "node:crypto";

export const DEMO_MENNEKES_PART_NUMBERS = [
  "13501", "13502", "13506", "13510", "13512", "13513", "13516", "13520",
  "13102", "13106", "13112", "13619", "13620", "13622", "13624", "13649",
  "13625", "13627", "13629", "13202",
] as const;

export const INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS = [
  ...DEMO_MENNEKES_PART_NUMBERS,
  "14626", "14261P", "14260P", "14248",
  "1457", "1491", "1458", "1128A", "32", "10118",
] as const;

const SOURCE_ORIGIN = "https://www.mennekes.org";

function text(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&reg;/gi, "®")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export type ManufacturerEnrichment = {
  partNumber: string;
  name: string;
  gtin13: string | null;
  imageUrl: string;
  sourceUrl: string;
  specifications: Record<string, string>;
  fingerprint: string;
};

export function parseMennekesProductPage(html: string, expectedPartNumber: string): ManufacturerEnrichment {
  const sourceUrl = `${SOURCE_ORIGIN}/industry/product-details/${encodeURIComponent(expectedPartNumber)}/`;
  const jsonMatch = html.match(/<script type="application\/ld\+json" id="ext-schema-jsonld">([^<]+)<\/script>/);
  if (!jsonMatch) throw new Error(`Official product metadata is missing for ${expectedPartNumber}`);
  const graph = JSON.parse(jsonMatch[1])?.["@graph"] as Array<Record<string, unknown>> | undefined;
  const product = graph?.find((entry) => entry["@type"] === "Product");
  if (!product || product.sku !== expectedPartNumber || product.brand !== "MENNEKES") {
    throw new Error(`Official product identity does not match ${expectedPartNumber}`);
  }

  const table = html.match(/<table class="figure-table">([\s\S]*?)<\/table>/)?.[1];
  if (!table) throw new Error(`Official technical specifications are missing for ${expectedPartNumber}`);
  const specifications: Record<string, string> = {};
  for (const row of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const key = text(row[1].match(/<th>([\s\S]*?)<\/th>/)?.[1] ?? "");
    const value = text(row[1].match(/<td>([\s\S]*?)<\/td>/)?.[1] ?? "");
    if (key && value) specifications[key] = value;
  }
  if (Object.keys(specifications).length < 5) {
    throw new Error(`Official technical specifications are incomplete for ${expectedPartNumber}`);
  }

  const imagePath = String(product.image ?? "");
  if (!imagePath.startsWith("/fileadmin/products_media/produktbilder/") || !imagePath.endsWith(`${expectedPartNumber}.png`)) {
    throw new Error(`Official image identity does not match ${expectedPartNumber}`);
  }
  const canonical = JSON.stringify({
    partNumber: expectedPartNumber,
    name: product.name,
    gtin13: product.gtin13 ?? null,
    imageUrl: `${SOURCE_ORIGIN}${imagePath}`,
    sourceUrl,
    specifications,
  });
  return {
    ...JSON.parse(canonical),
    fingerprint: createHash("sha256").update(canonical).digest("hex"),
  } as ManufacturerEnrichment;
}

export async function fetchMennekesProduct(partNumber: string): Promise<ManufacturerEnrichment> {
  if (!(INDUSTRIAL_DEMO_MENNEKES_PART_NUMBERS as readonly string[]).includes(partNumber)) {
    throw new Error(`Part number ${partNumber} is outside the reviewed demo set`);
  }
  const sourceUrl = `${SOURCE_ORIGIN}/industry/product-details/${encodeURIComponent(partNumber)}/`;
  const response = await fetch(sourceUrl, { headers: { "User-Agent": "AvenickDemoCatalog/1.0" } });
  if (!response.ok) throw new Error(`Official manufacturer returned ${response.status} for ${partNumber}`);
  return parseMennekesProductPage(await response.text(), partNumber);
}

export function manufacturerDescription(source: ManufacturerEnrichment) {
  const facts = Object.entries(source.specifications).map(([key, value]) => `${key}: ${value}`).join(". ");
  return `${source.name} (MENNEKES part ${source.partNumber}). ${facts}. Source: ${source.sourceUrl}`;
}
