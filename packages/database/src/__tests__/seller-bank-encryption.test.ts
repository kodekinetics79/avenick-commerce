import { beforeAll, describe, expect, it } from "vitest";
import { isEncrypted } from "@avenick/utils/crypto";
import {
  encryptSellerBankDetails,
  isEncryptedSellerBankDetails,
  parseSellerBankDetails,
} from "../services/seller-settings";

beforeAll(() => {
  process.env.PII_ENCRYPTION_KEYS = JSON.stringify({ test: Buffer.alloc(32, 7).toString("base64") });
  process.env.PII_ENCRYPTION_ACTIVE_KEY_ID = "test";
});

describe("seller banking details", () => {
  it("stores versioned ciphertext and returns the canonical decrypted shape", () => {
    const stored = encryptSellerBankDetails({
      iban: "SA03 8000 0000 6080 1016 7519",
      bankName: "Example Bank",
      accountName: "Avenick Supplier",
    }, "2026-09-30T00:00:00.000Z");

    expect(isEncryptedSellerBankDetails(stored)).toBe(true);
    expect(isEncrypted(stored.ibanCiphertext)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("608010167519");
    expect(parseSellerBankDetails(stored)).toEqual({
      iban: "SA0380000000608010167519",
      bankName: "Example Bank",
      accountName: "Avenick Supplier",
      updatedAt: "2026-09-30T00:00:00.000Z",
    });
  });

  it("keeps legacy plaintext readable only for controlled migration", () => {
    expect(parseSellerBankDetails({
      iban: "SA0380000000608010167519",
      bankName: "Legacy Bank",
      accountName: "Legacy Supplier",
      updatedAt: "2026-01-01T00:00:00.000Z",
    })).toMatchObject({ bankName: "Legacy Bank", accountName: "Legacy Supplier" });
  });
});
