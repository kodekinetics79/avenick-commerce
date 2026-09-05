/**
 * Test personas for authenticated journey certification.
 *
 * Maps test accounts to the portal each one signs into and the boundaries it
 * must NOT cross. The "denied" lists are the point: PROMPT 02 certifies refusal
 * as rigorously as it certifies success.
 *
 * Passwords are never stored here. Supply E2E_SEED_PASSWORD at run time — the
 * same value the accounts were given, either as SEED_PASSWORD by the seed or as
 * TEST_PERSONA_PASSWORD by packages/database/scripts/reset-test-personas.mjs.
 */

export const SEED_PASSWORD = process.env.E2E_SEED_PASSWORD?.trim() || "";

/**
 * @typedef {"customer" | "seller" | "admin"} PortalName
 * @typedef {{ email: string, portal: PortalName, role: string, label: string, deniedPortals: PortalName[] }} Persona
 */

/**
 * TWO DATABASES, TWO ADDRESS BOOKS.
 *
 * The same roles exist under different addresses depending on which database
 * the portals point at, and a suite that knows only one address book signs in
 * against the other with "Invalid email or password" — indistinguishable on a
 * screenshot from a wrong password.
 *
 *  - `seed`   — what packages/database/prisma/seed.ts creates on an EMPTY
 *               database: the CI job's throwaway Postgres, or a local docker
 *               Postgres seeded by hand. CI's `verify:personas` step imports
 *               this module, so this is also the set the seed is checked against.
 *  - `shared` — the accounts that exist and are ACTIVE on the shared database
 *               that local development and the deployments point at, and whose
 *               password packages/database/scripts/reset-test-personas.mjs sets.
 *               Only `buyer@` and `admin@` are common to both sets; the others
 *               carry a `cert-` prefix there. No Seller B account on that
 *               database has a password anybody knows, so `sellerBOwner` is
 *               absent from this set and the seller-to-seller isolation specs
 *               report themselves as not exercised instead of failing on a
 *               missing state file.
 *
 * E2E_PERSONA_SET selects the set. It defaults to `shared`, the database a
 * developer's portals actually point at; the CI workflow sets `seed` explicitly,
 * in the job that seeds. An unknown value throws rather than guessing.
 */
export const PERSONA_SETS = {
  seed: {
    buyer: "buyer@avenick.test",
    companyAdmin: "company@avenick.test",
    sellerOwner: "seller@avenick.test",
    sellerBOwner: "seller-b-owner@avenick.test",
    sellerStaff: "seller-a-fulfillment@avenick.test",
    admin: "admin@avenick.test",
  },
  shared: {
    buyer: "buyer@avenick.test",
    companyAdmin: "cert-company-admin@avenick.test",
    sellerOwner: "cert-seller-a-owner@avenick.test",
    sellerBOwner: null,
    sellerStaff: "cert-seller-a-catalog@avenick.test",
    admin: "admin@avenick.test",
  },
};

export const PERSONA_SET = resolvePersonaSet();

function resolvePersonaSet() {
  const raw = process.env.E2E_PERSONA_SET?.trim().toLowerCase() || "shared";
  if (!Object.prototype.hasOwnProperty.call(PERSONA_SETS, raw)) {
    throw new Error(
      `E2E_PERSONA_SET="${raw}" is not a persona set. Use one of: ${Object.keys(PERSONA_SETS).join(", ")}.`,
    );
  }
  return raw;
}

/** The roles, portals and boundaries — identical whichever address book is active. */
const ROLES = {
  buyer: {
    portal: "customer",
    role: "CONSUMER",
    label: "B2C buyer",
    // A consumer has no company, so governed B2B surfaces must refuse them.
    deniedPortals: ["seller", "admin"],
  },
  companyAdmin: {
    portal: "customer",
    role: "COMPANY_ADMIN",
    label: "B2B company admin",
    deniedPortals: ["seller", "admin"],
  },
  sellerOwner: {
    portal: "seller",
    role: "SELLER_OWNER",
    label: "Seller A owner",
    deniedPortals: ["admin"],
  },
  sellerBOwner: {
    portal: "seller",
    role: "SELLER_OWNER",
    label: "Seller B owner",
    // Exists to prove seller-to-seller isolation, not just anonymous denial.
    deniedPortals: ["admin"],
  },
  sellerStaff: {
    portal: "seller",
    role: "SELLER_STAFF",
    label: "Seller A staff",
    deniedPortals: ["admin"],
  },
  admin: {
    portal: "admin",
    role: "SUPER_ADMIN",
    label: "Platform admin",
    deniedPortals: [],
  },
};

/** @type {Record<string, Persona>} */
const personas = {};
for (const [name, base] of Object.entries(ROLES)) {
  const email = PERSONA_SETS[PERSONA_SET][name];
  if (email) personas[name] = { ...base, email };
}

/**
 * The personas the active set can sign in — keyed by role name. A role with no
 * address in the active set is simply absent, so specs test for presence and
 * skip with a reason instead of tripping over a state file that was never
 * written.
 */
export const PERSONAS = personas;

/** Where a persona's authenticated browser state is cached. */
export function storageStatePath(name) {
  return `artifacts/auth/${name}.json`;
}

export function assertPasswordConfigured() {
  if (!SEED_PASSWORD) {
    throw new Error(
      "E2E_SEED_PASSWORD is not set. Authenticated certification needs the password " +
        "the test accounts hold: SEED_PASSWORD from `pnpm db:seed`, or TEST_PERSONA_PASSWORD " +
        "from packages/database/scripts/reset-test-personas.mjs. It is deliberately not " +
        "stored in the repository.",
    );
  }
}
