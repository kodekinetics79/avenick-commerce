import { afterEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "../index";
import {
  hashSellerPassword,
  registerSeller,
  SellerRegistrationConflictError,
  type SellerRegistrationInput,
} from "../services/seller-registration";

const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;

/** Every row this suite creates is tagged with the stamp so cleanup is exact. */
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const userIds: string[] = [];
const sellerIds: string[] = [];

/** Not a real hash of anything; the service stores what it is given. */
const PASSWORD_HASH = `$2a$12$${"x".repeat(53)}`;

function application(label: string, overrides: Partial<SellerRegistrationInput> = {}): SellerRegistrationInput {
  return {
    businessNameEn: `Seller registration ${label} ${stamp}`,
    crNumber: `SREG-${label}-${stamp}`,
    type: "DISTRIBUTOR",
    country: "AE",
    city: "Dubai",
    firstName: "Owner",
    lastName: label,
    email: `seller-registration-${label}-${stamp}@test.invalid`,
    language: "AR",
    passwordHash: PASSWORD_HASH,
    ...overrides,
  };
}

async function register(input: SellerRegistrationInput) {
  const result = await registerSeller(input);
  userIds.push(result.userId);
  sellerIds.push(result.sellerId);
  return result;
}

/** The conflict field an attempt fails with; anything else fails the test. */
async function conflictField(input: SellerRegistrationInput) {
  const failure = await registerSeller(input).then(
    (result) => {
      userIds.push(result.userId);
      sellerIds.push(result.sellerId);
      return new Error("registration unexpectedly succeeded");
    },
    (e: unknown) => e,
  );
  expect(failure).toBeInstanceOf(SellerRegistrationConflictError);
  return (failure as SellerRegistrationConflictError).field;
}

// Needs no database: the credentials provider (packages/auth/src/config.ts)
// verifies with bcrypt.compare, so the hash this service hands out must be one
// that compare accepts, or every applicant would be locked out at first login.
describe("hashSellerPassword", () => {
  it("produces a bcrypt hash the credentials provider can verify", async () => {
    const hash = await hashSellerPassword("Correct-Horse-1");
    expect(hash).not.toBe("Correct-Horse-1");
    await expect(bcrypt.compare("Correct-Horse-1", hash)).resolves.toBe(true);
    await expect(bcrypt.compare("correct-horse-1", hash)).resolves.toBe(false);
  });
});

run("seller self-registration", () => {
  // Registered inside the gated block: the hash test above needs no database,
  // so its teardown must not touch one either.
  afterEach(async () => {
    const sellers = sellerIds.splice(0);
    const users = userIds.splice(0);
    await db.auditLog.deleteMany({ where: { OR: [{ sellerId: { in: sellers } }, { actorId: { in: users } }] } });
    await db.sellerProfile.deleteMany({ where: { id: { in: sellers } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    // A rolled-back attempt leaves nothing behind, but a regression that leaks
    // an orphaned owner must not pollute the shared database either.
    await db.user.deleteMany({ where: { email: { endsWith: `-${stamp}@test.invalid` }, sellerProfile: { is: null } } });
  });

  it("creates an active owner login, a seller under review and the audit row atomically", async () => {
    const input = application("fresh", {
      email: `  Seller-Registration-FRESH-${stamp}@Test.invalid `,
      phone: `+9715${String(Date.now()).slice(-8)}`,
      businessNameAr: "  ",
      vatNumber: "",
    });
    const result = await register(input);

    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user).toMatchObject({
      email: `seller-registration-fresh-${stamp}@test.invalid`,
      role: "SELLER_OWNER",
      status: "ACTIVE",
      passwordHash: PASSWORD_HASH,
      phone: input.phone,
      language: "AR",
    });

    const seller = await db.sellerProfile.findUniqueOrThrow({ where: { id: result.sellerId } });
    expect(seller).toMatchObject({
      userId: result.userId,
      crNumber: input.crNumber,
      status: "PENDING_REVIEW",
      businessNameAr: null,
      vatNumber: null,
      type: "DISTRIBUTOR",
      country: "AE",
    });

    const audit = await db.auditLog.findMany({ where: { entityType: "SellerProfile", entityId: result.sellerId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: result.userId, sellerId: result.sellerId, action: "CREATE", after: { status: "PENDING_REVIEW" } });
  });

  it("stores an omitted phone as null rather than an empty string", async () => {
    const result = await register(application("nophone", { phone: "" }));
    await expect(db.user.findUniqueOrThrow({ where: { id: result.userId } })).resolves.toMatchObject({ phone: null });
  });

  it("reports an email collision as an email conflict, whatever the letter case, and leaves no seller behind", async () => {
    const first = application("email-a");
    await register(first);

    const second = application("email-b", { email: first.email.toUpperCase() });
    expect(await conflictField(second)).toBe("email");
    await expect(db.sellerProfile.findUnique({ where: { crNumber: second.crNumber } })).resolves.toBeNull();
  });

  it("reports a CR collision as a CR conflict and leaves no orphaned owner behind", async () => {
    const first = application("cr-a");
    await register(first);

    const second = application("cr-b", { crNumber: first.crNumber });
    expect(await conflictField(second)).toBe("crNumber");
    await expect(db.user.findUnique({ where: { email: second.email } })).resolves.toBeNull();
  });

  it("decides a CR collision before it looks at the email, so the answer never depends on the address", async () => {
    // Privacy invariant: a known CR submitted with a candidate email must get
    // the same answer whether or not that email is registered. If the email
    // were checked first, the two cases would differ and the endpoint would
    // be a membership oracle for email addresses.
    const existing = await register(application("order-existing"));
    const existingEmail = (await db.user.findUniqueOrThrow({ where: { id: existing.userId } })).email;
    const existingCr = (await db.sellerProfile.findUniqueOrThrow({ where: { id: existing.sellerId } })).crNumber;

    expect(await conflictField(application("order-known", { email: existingEmail, crNumber: existingCr }))).toBe("crNumber");
    expect(await conflictField(application("order-fresh", { crNumber: existingCr }))).toBe("crNumber");
  });

  it("reports a phone collision as a phone conflict", async () => {
    const phone = `+9665${String(Date.now()).slice(-8)}`;
    await register(application("phone-a", { phone }));
    expect(await conflictField(application("phone-b", { phone }))).toBe("phone");
  });
});
