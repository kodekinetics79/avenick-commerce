import { Prisma } from "@prisma/client";
import { isEncryptionConfigured } from "@avenick/utils/crypto";
import { db } from "../src/index";
import {
  encryptSellerBankDetails,
  isEncryptedSellerBankDetails,
  parseSellerBankDetails,
} from "../src/services/seller-settings";

async function main() {
  if (!isEncryptionConfigured()) {
    throw new Error("PII encryption keys must be configured before banking details can be backfilled");
  }

  const sellers = await db.sellerProfile.findMany({
    where: { bankDetails: { not: Prisma.JsonNull } },
    select: { id: true, bankDetails: true },
  });

  let migrated = 0;
  let skipped = 0;
  for (const seller of sellers) {
    if (isEncryptedSellerBankDetails(seller.bankDetails)) {
      skipped += 1;
      continue;
    }
    const details = parseSellerBankDetails(seller.bankDetails);
    if (!details) {
      skipped += 1;
      continue;
    }
    const encrypted = encryptSellerBankDetails(details, details.updatedAt || new Date().toISOString());
    await db.sellerProfile.update({
      where: { id: seller.id },
      data: { bankDetails: encrypted as unknown as Prisma.InputJsonObject },
    });
    migrated += 1;
  }

  process.stdout.write(`Encrypted ${migrated} seller banking record(s); skipped ${skipped}.\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
