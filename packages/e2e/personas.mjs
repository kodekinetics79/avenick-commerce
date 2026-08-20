/**
 * Test personas for authenticated journey certification.
 *
 * Maps seeded accounts to the portal each one signs into and the boundaries it
 * must NOT cross. The "denied" lists are the point: PROMPT 02 certifies refusal
 * as rigorously as it certifies success.
 *
 * Passwords are never stored here. Supply E2E_SEED_PASSWORD — the same value
 * given to the seed as SEED_PASSWORD — at run time.
 */

export const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD?.trim() || "";

export const PERSONAS = {
  buyer: {
    email: "buyer@avenick.test",
    portal: "customer",
    role: "CONSUMER",
    label: "B2C buyer",
    // A consumer has no company, so governed B2B surfaces must refuse them.
    deniedPortals: ["seller", "admin"],
  },
  companyAdmin: {
    email: "company@avenick.test",
    portal: "customer",
    role: "COMPANY_ADMIN",
    label: "B2B company admin",
    deniedPortals: ["seller", "admin"],
  },
  sellerOwner: {
    email: "seller@avenick.test",
    portal: "seller",
    role: "SELLER_OWNER",
    label: "Seller A owner",
    deniedPortals: ["admin"],
  },
  sellerBOwner: {
    email: "seller-b-owner@avenick.test",
    portal: "seller",
    role: "SELLER_OWNER",
    label: "Seller B owner",
    // Exists to prove seller-to-seller isolation, not just anonymous denial.
    deniedPortals: ["admin"],
  },
  sellerStaff: {
    email: "seller-a-fulfillment@avenick.test",
    portal: "seller",
    role: "SELLER_STAFF",
    label: "Seller A fulfilment staff",
    deniedPortals: ["admin"],
  },
  admin: {
    email: "admin@avenick.test",
    portal: "admin",
    role: "SUPER_ADMIN",
    label: "Platform admin",
    deniedPortals: [],
  },
};

/** Where a persona's authenticated browser state is cached. */
export function storageStatePath(name) {
  return `artifacts/auth/${name}.json`;
}

export function assertPasswordConfigured() {
  if (!SEED_PASSWORD) {
    throw new Error(
      "E2E_SEED_PASSWORD is not set. Authenticated certification needs the seed " +
        "password used by `pnpm db:seed` (SEED_PASSWORD). It is deliberately not " +
        "stored in the repository.",
    );
  }
}
