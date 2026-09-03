/**
 * Default GCC delivery tariff.
 *
 * These are STARTING figures for an operator to edit in the admin, not
 * negotiated carrier rates — the zones and bands are the structure, the numbers
 * are a placeholder. They exist because an empty tariff makes quoteShipping
 * refuse every destination, which is correct behaviour and an unusable store.
 *
 * Bands are min-inclusive / max-exclusive, and the top band of each zone is
 * open-ended so no parcel can fall through the tariff.
 *
 *   node packages/database/scripts/seed-shipping-zones.mjs
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const ZONES = [
  {
    code: "UAE_DOMESTIC", nameEn: "United Arab Emirates", nameAr: "الإمارات العربية المتحدة",
    countries: ["AE"], fallbackPrice: 25, freeOverSubtotal: 500, etaMinDays: 1, etaMaxDays: 3, sortOrder: 0,
    bands: [[0, 1, 15], [1, 5, 25], [5, 20, 45], [20, 50, 90], [50, null, 160]],
  },
  {
    code: "GCC_NEIGHBOURS", nameEn: "GCC neighbours", nameAr: "دول الخليج المجاورة",
    countries: ["SA", "QA", "KW", "BH", "OM"], fallbackPrice: 60, freeOverSubtotal: 1500,
    etaMinDays: 2, etaMaxDays: 6, sortOrder: 1,
    bands: [[0, 1, 40], [1, 5, 70], [5, 20, 130], [20, 50, 260], [50, null, 470]],
  },
];

for (const zone of ZONES) {
  const { bands, ...fields } = zone;
  const saved = await db.shippingZone.upsert({
    where: { code: zone.code },
    // Reconcile on re-run rather than skip: a tariff that silently keeps old
    // numbers is the same trap the product seed had.
    update: { ...fields },
    create: { ...fields },
  });
  await db.shippingRate.deleteMany({ where: { zoneId: saved.id, currency: "AED" } });
  await db.shippingRate.createMany({
    data: bands.map(([min, max, price]) => ({
      zoneId: saved.id, currency: "AED",
      minWeightKg: min, maxWeightKg: max, price,
    })),
  });
  console.log(`${zone.code}: ${zone.countries.join(", ")} — ${bands.length} AED bands`);
}
console.log("\nEdit these in the admin before launch: they are structure, not negotiated rates.");
await db.$disconnect();
