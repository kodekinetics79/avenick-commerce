import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AddressListResponseSchema,
  AddressResponseSchema,
  DeleteAddressResponseSchema,
  ErrorEnvelopeSchema,
} from "@avenick/contracts";

/**
 * /api/v1/addresses — the full CRUD, owner-scoped.
 *
 * The two things worth testing here are not the happy paths: they are that
 * ownership is part of every statement (so a write can never touch another
 * account's row) and that "the default address" stays a single-valued fact,
 * which is only true because it is cleared and set inside ONE transaction.
 */
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueUser: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth-instance", () => ({ auth: mocks.auth }));
vi.mock("@avenick/auth/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true, count: 1, limit: 120, resetAt: Date.now() + 60_000 }),
  clientIpFrom: () => "203.0.113.7",
}));
vi.mock("@avenick/observability", () => {
  const log = { error: mocks.logError, info: vi.fn(), warn: vi.fn(), debug: vi.fn(), with: () => log };
  return { log, instrumentRequest: () => ({ ctx: { log }, finish: vi.fn() }) };
});
vi.mock("@avenick/database", () => ({
  db: {
    user: { findUnique: mocks.findUniqueUser },
    address: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

import { DELETE, GET as GET_ONE, PATCH } from "../[id]/route";
import { GET as GET_LIST, POST } from "../route";

const ROW = {
  id: "adr_1",
  label: "Home",
  line1: "12 Marina Street",
  line2: null,
  city: "Dubai",
  country: "AE",
  postalCode: null,
  lat: { toString: () => "25.07620000" },
  lng: { toString: () => "55.13040000" },
  isDefault: true,
};

function get(path: string) {
  return new NextRequest(`https://customer.test${path}`, { method: "GET" });
}

function send(method: string, path: string, body?: unknown) {
  return new NextRequest(`https://customer.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function errorOf(response: Response) {
  return ErrorEnvelopeSchema.parse(await response.json()).error;
}

function signedInAs(userId: string) {
  mocks.auth.mockResolvedValue({ user: { id: userId } });
  mocks.findUniqueUser.mockResolvedValue({
    role: "CONSUMER", status: "ACTIVE", deletedAt: null, companyMember: null,
  });
}

/** A real transaction runs the callback against the same delegates. */
function runTransaction() {
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      address: {
        findFirst: mocks.findFirst,
        create: mocks.create,
        update: mocks.update,
        updateMany: mocks.updateMany,
      },
    }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.findMany.mockResolvedValue([ROW]);
  mocks.findFirst.mockResolvedValue(ROW);
  mocks.create.mockResolvedValue(ROW);
  mocks.update.mockResolvedValue(ROW);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  runTransaction();
});

describe("who may touch an address", () => {
  it("refuses a guest every verb", async () => {
    expect((await GET_LIST(get("/api/v1/addresses"))).status).toBe(401);
    expect((await POST(send("POST", "/api/v1/addresses", { label: "H", line1: "12 St", city: "Dubai", country: "AE" }))).status).toBe(401);
    expect((await GET_ONE(get("/api/v1/addresses/adr_1"), { params: { id: "adr_1" } })).status).toBe(401);
    expect((await PATCH(send("PATCH", "/api/v1/addresses/adr_1", { label: "H" }), { params: { id: "adr_1" } })).status).toBe(401);
    expect((await DELETE(send("DELETE", "/api/v1/addresses/adr_1"), { params: { id: "adr_1" } })).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("does not let one account READ another's address", async () => {
    signedInAs("usr_a");
    mocks.findFirst.mockResolvedValue(null);
    const response = await GET_ONE(get("/api/v1/addresses/adr_of_b"), { params: { id: "adr_of_b" } });
    expect(response.status).toBe(404);
    expect(mocks.findFirst.mock.calls[0]![0].where).toEqual({ id: "adr_of_b", userId: "usr_a" });
  });

  it("does not let one account WRITE another's address", async () => {
    signedInAs("usr_a");
    mocks.findFirst.mockResolvedValue(null);
    const response = await PATCH(
      send("PATCH", "/api/v1/addresses/adr_of_b", { label: "Mine now" }),
      { params: { id: "adr_of_b" } },
    );
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not let one account DELETE another's address", async () => {
    signedInAs("usr_a");
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    const response = await DELETE(send("DELETE", "/api/v1/addresses/adr_of_b"), {
      params: { id: "adr_of_b" },
    });
    expect(response.status).toBe(404);
    // The user id is IN the delete statement, so there is no window between a
    // check and the write.
    expect(mocks.deleteMany.mock.calls[0]![0].where).toEqual({ id: "adr_of_b", userId: "usr_a" });
  });
});

describe("reading the address book", () => {
  beforeEach(() => signedInAs("usr_a"));

  it("answers the whole list, uncursored, conforming to the contract", async () => {
    const response = await GET_LIST(get("/api/v1/addresses"));
    expect(response.status).toBe(200);
    const { data } = AddressListResponseSchema.parse(await response.json());
    expect(data).toEqual([{
      id: "adr_1",
      label: "Home",
      line1: "12 Marina Street",
      line2: null,
      city: "Dubai",
      country: "AE",
      postalCode: null,
      latitude: 25.0762,
      longitude: 55.1304,
      isDefault: true,
    }]);
    // No meta block: an account holds a handful of addresses and cursoring five
    // rows costs a round trip to learn there is no second page.
    expect(await (await GET_LIST(get("/api/v1/addresses"))).json()).not.toHaveProperty("meta");
  });

  it("puts the default first, so checkout preselects the first row", async () => {
    await GET_LIST(get("/api/v1/addresses"));
    expect(mocks.findMany.mock.calls[0]![0].orderBy[0]).toEqual({ isDefault: "desc" });
  });
});

describe("adding an address", () => {
  beforeEach(() => signedInAs("usr_a"));

  const body = { label: "Home", line1: "12 Marina Street", city: "Dubai", country: "AE" };

  it("creates it against the caller's own id", async () => {
    const response = await POST(send("POST", "/api/v1/addresses", body));
    expect(response.status).toBe(200);
    AddressResponseSchema.parse(await response.json());
    expect(mocks.create.mock.calls[0]![0].data).toMatchObject({ userId: "usr_a", label: "Home" });
  });

  it("clears the other defaults IN THE SAME TRANSACTION as the create", async () => {
    // Two defaults is a state no client should be able to create; doing this as
    // two round trips from the app leaves exactly that state behind whenever
    // the second one fails.
    await POST(send("POST", "/api/v1/addresses", { ...body, isDefault: true }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany.mock.calls[0]![0]).toEqual({
      where: { userId: "usr_a", isDefault: true },
      data: { isDefault: false },
    });
  });

  it("does not touch the other rows when the flag is not set", async () => {
    await POST(send("POST", "/api/v1/addresses", body));
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("refuses half a coordinate", async () => {
    const response = await POST(send("POST", "/api/v1/addresses", { ...body, latitude: 25.07 }));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.longitude).toBeDefined();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses a field the contract does not describe", async () => {
    const response = await POST(send("POST", "/api/v1/addresses", { ...body, userId: "usr_b" }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("changing an address", () => {
  beforeEach(() => signedInAs("usr_a"));

  it("applies only the fields the patch names", async () => {
    const response = await PATCH(
      send("PATCH", "/api/v1/addresses/adr_1", { label: "Office", line2: null }),
      { params: { id: "adr_1" } },
    );
    expect(response.status).toBe(200);
    AddressResponseSchema.parse(await response.json());
    expect(mocks.update.mock.calls[0]![0].data).toEqual({ label: "Office", line2: null });
  });

  it("refuses an empty patch", async () => {
    const response = await PATCH(send("PATCH", "/api/v1/addresses/adr_1", {}), {
      params: { id: "adr_1" },
    });
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  /**
   * The contract's Create schema refuses half a coordinate; its Update schema
   * has no such refinement, so this request is one the published document
   * ACCEPTS. It is refused against the merged row instead — half a coordinate
   * is a point on the equator, and a delivery app navigating there goes
   * somewhere real and wrong.
   */
  it("refuses a patch that would leave half a coordinate behind", async () => {
    mocks.findFirst.mockResolvedValue({ ...ROW, lat: null, lng: null });
    const response = await PATCH(
      send("PATCH", "/api/v1/addresses/adr_1", { latitude: 25.07 }),
      { params: { id: "adr_1" } },
    );
    expect(response.status).toBe(400);
    expect((await errorOf(response)).fieldErrors?.longitude).toBeDefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows a patch that completes an existing coordinate", async () => {
    mocks.findFirst.mockResolvedValue({ ...ROW, lat: { toString: () => "25.07" }, lng: null });
    const response = await PATCH(
      send("PATCH", "/api/v1/addresses/adr_1", { longitude: 55.13 }),
      { params: { id: "adr_1" } },
    );
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]![0].data).toEqual({ lng: 55.13 });
  });

  it("clears the other defaults, and never its own row, when promoting one", async () => {
    await PATCH(send("PATCH", "/api/v1/addresses/adr_1", { isDefault: true }), {
      params: { id: "adr_1" },
    });
    expect(mocks.updateMany.mock.calls[0]![0].where).toEqual({
      userId: "usr_a",
      isDefault: true,
      id: { not: "adr_1" },
    });
  });
});

describe("removing an address", () => {
  beforeEach(() => signedInAs("usr_a"));

  it("acknowledges the removal in the contract's shape", async () => {
    const response = await DELETE(send("DELETE", "/api/v1/addresses/adr_1"), {
      params: { id: "adr_1" },
    });
    expect(response.status).toBe(200);
    const { data } = DeleteAddressResponseSchema.parse(await response.json());
    expect(data).toEqual({ id: "adr_1", deleted: true });
  });

  it("answers 409, not 500, when a foreign key still points at it", async () => {
    // Orders keep their own address snapshot, so this should not happen — but
    // Order.addressId is a real FK with no cascade, and "this address is
    // attached to an order" is something a person can act on.
    mocks.deleteMany.mockRejectedValue(Object.assign(new Error("FK"), { code: "P2003" }));
    const response = await DELETE(send("DELETE", "/api/v1/addresses/adr_1"), {
      params: { id: "adr_1" },
    });
    expect(response.status).toBe(409);
    expect((await errorOf(response)).code).toBe("conflict");
  });
});
