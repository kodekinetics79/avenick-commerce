import { afterEach, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  SellerRegistrationConflictError,
  createSellerAccount,
  type AdminSellerCreationInput,
} from "../services/seller-registration";
import { integrationSuite } from "../testing/integration-db";

const run = integrationSuite();

/** Every row this suite creates is tagged with the stamp so cleanup is exact. */
const stamp = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const userIds: string[] = [];
const sellerIds: string[] = [];
const actorIds: string[] = [];

/** Not a real hash of anything; the service stores what it is given. */
const PASSWORD_HASH = `$2a$12$${"x".repeat(53)}`;

function application(label: string, overrides: Partial<AdminSellerCreationInput> = {}): AdminSellerCreationInput {
  return {
    businessNameEn: `Admin created ${label} ${stamp}`,
    crNumber: `ADMCR-${label}-${stamp}`,
    type: "DISTRIBUTOR",
    country: "AE",
    city: "Dubai",
    firstName: "Owner",
    lastName: label,
    email: `admin-created-${label}-${stamp}@test.invalid`,
    language: "EN",
    passwordHash: PASSWORD_HASH,
    ...overrides,
  };
}

async function makeActor(role: "ADMIN" | "SUPER_ADMIN" | "CONSUMER", label: string) {
  const user = await db.user.create({
    data: {
      email: `admin-actor-${label}-${stamp}@test.invalid`,
      firstName: "Actor",
      lastName: label,
      role,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  actorIds.push(user.id);
  return user.id;
}

async function create(input: AdminSellerCreationInput, actorId: string) {
  const result = await createSellerAccount(input, actorId);
  userIds.push(result.userId);
  sellerIds.push(result.sellerId);
  return result;
}

/** The rejection an attempt fails with; a success fails the test. */
async function refusal(input: AdminSellerCreationInput, actorId: string) {
  const failure = await createSellerAccount(input, actorId).then(
    (result) => {
      userIds.push(result.userId);
      sellerIds.push(result.sellerId);
      return new Error("creation unexpectedly succeeded");
    },
    (e: unknown) => e,
  );
  expect(failure).toBeInstanceOf(Error);
  return failure as Error;
}

run("admin-created seller accounts", () => {
  afterEach(async () => {
    const sellers = sellerIds.splice(0);
    const users = userIds.splice(0);
    const actors = actorIds.splice(0);
    await db.auditLog.deleteMany({
      where: { OR: [{ sellerId: { in: sellers } }, { actorId: { in: [...users, ...actors] } }] },
    });
    await db.sellerProfile.deleteMany({ where: { id: { in: sellers } } });
    await db.user.deleteMany({ where: { id: { in: [...users, ...actors] } } });
    // A rolled-back attempt leaves nothing behind, but a regression that leaks
    // an orphaned owner must not pollute the shared database either.
    await db.user.deleteMany({ where: { email: { endsWith: `-${stamp}@test.invalid` } } });
  });

  it("creates the organisation, the owner login and one audit row naming the admin", async () => {
    const actorId = await makeActor("ADMIN", "creates");
    const result = await create(application("queued"), actorId);

    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user).toMatchObject({ role: "SELLER_OWNER", status: "ACTIVE", passwordHash: PASSWORD_HASH });

    const seller = await db.sellerProfile.findUniqueOrThrow({ where: { id: result.sellerId } });
    expect(seller).toMatchObject({ userId: result.userId, status: "PENDING_REVIEW" });

    // The actor is the ADMINISTRATOR, not the new owner. That is the only thing
    // that distinguishes an admin-opened account from a self-registration when
    // someone later asks why a seller never appeared in the review queue.
    const audit = await db.auditLog.findMany({ where: { entityType: "SellerProfile", entityId: result.sellerId } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId, action: "CREATE" });
    expect(audit[0]!.after).toMatchObject({
      createdBy: "admin",
      ownerUserId: result.userId,
      openedWithoutReview: false,
      status: "PENDING_REVIEW",
    });
  });

  it("refuses to open an account for trading below SUPER_ADMIN, and creates nothing", async () => {
    const actorId = await makeActor("ADMIN", "notsuper");
    const input = application("straightlive", { status: "ACTIVE" });
    const error = await refusal(input, actorId);
    expect(error.message).toContain("super admin");

    // The whole thing is one transaction: a refused authority must not leave an
    // owner login behind for the CR number to then collide with on the retry.
    await expect(db.user.findUnique({ where: { email: input.email } })).resolves.toBeNull();
    await expect(db.sellerProfile.findUnique({ where: { crNumber: input.crNumber } })).resolves.toBeNull();
  });

  it("lets a SUPER_ADMIN open an account for trading, and records that it skipped review", async () => {
    const actorId = await makeActor("SUPER_ADMIN", "super");
    const result = await create(application("live", { status: "ACTIVE", tier: "VERIFIED", commissionRate: 7.5 }), actorId);
    expect(result.status).toBe("ACTIVE");

    const seller = await db.sellerProfile.findUniqueOrThrow({ where: { id: result.sellerId } });
    expect(seller.status).toBe("ACTIVE");
    expect(seller.tier).toBe("VERIFIED");
    expect(Number(seller.commissionRate)).toBe(7.5);

    const audit = await db.auditLog.findFirstOrThrow({
      where: { entityType: "SellerProfile", entityId: result.sellerId, action: "CREATE" },
    });
    expect(audit.after).toMatchObject({ openedWithoutReview: true, commissionRate: "7.5" });
  });

  it("refuses an actor who is not an administrator at all", async () => {
    const actorId = await makeActor("CONSUMER", "consumer");
    const error = await refusal(application("byconsumer"), actorId);
    expect(error.message).toContain("admin authority");
  });

  it("names the colliding field instead of answering neutrally", async () => {
    const actorId = await makeActor("SUPER_ADMIN", "conflicts");
    const first = await create(application("original", { phone: `+9715${String(Date.now()).slice(-8)}` }), actorId);
    const original = await db.sellerProfile.findUniqueOrThrow({ where: { id: first.sellerId } });
    const owner = await db.user.findUniqueOrThrow({ where: { id: first.userId } });

    // The public registration route must answer an email collision neutrally,
    // because anyone can call it and it would otherwise be a membership oracle.
    // A signed-in administrator is entitled to be told plainly.
    const byEmail = await refusal(application("dupemail", { email: owner.email }), actorId);
    expect(byEmail).toBeInstanceOf(SellerRegistrationConflictError);
    expect((byEmail as SellerRegistrationConflictError).field).toBe("email");

    const byCr = await refusal(application("dupcr", { crNumber: original.crNumber }), actorId);
    expect((byCr as SellerRegistrationConflictError).field).toBe("crNumber");

    const byPhone = await refusal(application("dupphone", { phone: owner.phone! }), actorId);
    expect((byPhone as SellerRegistrationConflictError).field).toBe("phone");
  });

  it("refuses a commission rate outside 0–100 rather than storing it", async () => {
    const actorId = await makeActor("ADMIN", "commission");
    const input = application("badrate", { commissionRate: 140 });
    const error = await refusal(input, actorId);
    expect(error.message).toContain("between 0 and 100");
    await expect(db.sellerProfile.findUnique({ where: { crNumber: input.crNumber } })).resolves.toBeNull();
  });
});
