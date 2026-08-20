import { AuditAction, PrismaClient } from "@prisma/client";
import {
  DEMO_MENNEKES_PART_NUMBERS,
  fetchMennekesProduct,
  manufacturerDescription,
} from "../src/services/demo-product-enrichment";

const prisma = new PrismaClient();

function assertDemoTarget() {
  if (process.env.DEMO_ENVIRONMENT !== "certification") {
    throw new Error("DEMO_ENVIRONMENT must be certification");
  }
  const expectedHost = process.env.DEMO_DATABASE_HOST;
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!expectedHost || !databaseUrl) throw new Error("DEMO_DATABASE_HOST and DIRECT_URL/DATABASE_URL are required");
  const actual = new URL(databaseUrl);
  if (actual.hostname !== expectedHost || actual.hostname.includes("-pooler.")) {
    throw new Error("Demo enrichment target must match the explicit unpooled branch host");
  }
  return actual.hostname;
}

async function main() {
  const host = assertDemoTarget();
  const sourced = await Promise.all(DEMO_MENNEKES_PART_NUMBERS.map(fetchMennekesProduct));
  const actor = await prisma.user.findUnique({ where: { email: "cert-admin@avenick.test" } });
  if (!actor || actor.status !== "ACTIVE" || actor.deletedAt) throw new Error("Active certification admin is required");

  const result = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        tags: { has: "pilot-catalog" },
        commercialMetadata: { is: { supplierPartNumber: { in: [...DEMO_MENNEKES_PART_NUMBERS] } } },
      },
      include: { commercialMetadata: true, images: true },
    });
    if (products.length !== DEMO_MENNEKES_PART_NUMBERS.length) {
      throw new Error(`Expected ${DEMO_MENNEKES_PART_NUMBERS.length} reviewed products, found ${products.length}`);
    }
    const byPart = new Map(products.map((product) => [product.commercialMetadata?.supplierPartNumber, product]));

    for (const source of sourced) {
      if (!source.imageUrl) throw new Error(`Official MENNEKES image ${source.partNumber} is missing`);
      const product = byPart.get(source.partNumber);
      if (!product) throw new Error(`Reviewed catalog product ${source.partNumber} is missing`);
      const existingPrimary = product.images.find((image) => image.isPrimary);
      const existingOfficial = product.images.find((image) => image.url === source.imageUrl);
      if (!existingOfficial) {
        await tx.productImage.create({
          data: {
            productId: product.id,
            url: source.imageUrl,
            altEn: `${source.name}, MENNEKES part ${source.partNumber}`,
            isPrimary: !existingPrimary,
            sortOrder: product.images.length,
          },
        });
      }
      await tx.product.update({
        where: { id: product.id },
        data: {
          nameEn: source.name,
          descriptionEn: manufacturerDescription(source),
          tags: { set: [...new Set([...product.tags, "manufacturer-verified", "demo-enriched"])] },
        },
      });
      await tx.productIssue.updateMany({
        where: { productId: product.id, issueType: "MISSING_ENGLISH_DESCRIPTION", resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          entityType: "DemoProductEnrichment",
          entityId: product.id,
          action: AuditAction.UPDATE,
          after: {
            source: "MENNEKES_OFFICIAL_PRODUCT_PAGE",
            sourceUrl: source.sourceUrl,
            sourceFingerprint: source.fingerprint,
            partNumber: source.partNumber,
            gtin13: source.gtin13,
            specifications: source.specifications,
            imageUrl: source.imageUrl,
            priceChanged: false,
            inventoryChanged: false,
          },
        },
      });
    }
    return { enriched: sourced.length, productIds: products.map((product) => product.id) };
  }, { timeout: 60_000 });

  console.log(JSON.stringify({ targetHost: host, ...result }));
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
