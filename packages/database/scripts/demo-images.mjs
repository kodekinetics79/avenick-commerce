/**
 * Attach DEMO product photography, and remove it again.
 *
 * The pilot catalogue is live with 383 products and no images at all, which is
 * what makes a populated storefront read as an unfinished one. These images are
 * a STAGE PROP: they come from the manufacturer pages the repo already
 * allow-lists for source-attributed demo enrichment, and they are cycled across
 * products, so the photograph on a card is frequently NOT that product.
 *
 * That is a deliberate, owner-approved demo compromise and it must not survive
 * contact with a real customer. Every row written here is therefore tagged, in
 * two independent ways, so removing them is exact rather than best-effort:
 *   · altEn begins with DEMO_MARKER
 *   · the URL host is the manufacturer origin
 * `node demo-images.mjs wipe` deletes exactly those and nothing else.
 *
 * Usage:
 *   node packages/database/scripts/demo-images.mjs apply
 *   node packages/database/scripts/demo-images.mjs wipe
 *   node packages/database/scripts/demo-images.mjs status
 */
import { PrismaClient } from "@prisma/client";

const DEMO_MARKER = "[DEMO IMAGE — not the actual product]";
const SOURCE_ORIGIN = "https://www.mennekes.org";
const IMAGE_PATH = "/fileadmin/products_media/produktbilder";

// Part numbers whose official image the enrichment service already verifies by
// identity (the path must end in `${partNumber}.png`).
const PART_NUMBERS = [
  "13501", "13502", "13506", "13510", "13512", "13513", "13516", "13520",
  "13102", "13106", "13112", "13619", "13620", "13622", "13624", "13649",
  "13625", "13627", "13629", "13202", "14626", "14248", "1457", "1491",
];

const db = new PrismaClient();
const mode = process.argv[2] ?? "status";

const demoWhere = { altEn: { startsWith: DEMO_MARKER } };

if (mode === "status") {
  const [products, withImage, demo] = await Promise.all([
    db.product.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    db.product.count({ where: { deletedAt: null, status: "ACTIVE", images: { some: {} } } }),
    db.productImage.count({ where: demoWhere }),
  ]);
  console.log(`active products: ${products}\nwith an image:   ${withImage}\ndemo images:     ${demo}`);
} else if (mode === "wipe") {
  const { count } = await db.productImage.deleteMany({ where: demoWhere });
  console.log(`removed ${count} demo images`);
} else if (mode === "apply") {
  // Only products that have NO image at all. A real photograph is never replaced.
  const targets = await db.product.findMany({
    where: { deletedAt: null, status: "ACTIVE", images: { none: {} } },
    select: { id: true, sku: true, nameEn: true },
    orderBy: { sku: "asc" },
  });
  console.log(`${targets.length} products without an image`);
  let written = 0;
  for (const [index, product] of targets.entries()) {
    const part = PART_NUMBERS[index % PART_NUMBERS.length];
    await db.productImage.create({
      data: {
        productId: product.id,
        url: `${SOURCE_ORIGIN}${IMAGE_PATH}/${part}.png`,
        altEn: `${DEMO_MARKER} ${product.nameEn}`.slice(0, 240),
        altAr: `${DEMO_MARKER} ${product.nameEn}`.slice(0, 240),
        isPrimary: true,
        sortOrder: 0,
      },
    });
    written += 1;
  }
  console.log(`wrote ${written} demo images`);
} else {
  console.error("usage: demo-images.mjs apply|wipe|status");
  process.exitCode = 1;
}
await db.$disconnect();
