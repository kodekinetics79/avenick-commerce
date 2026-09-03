import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  findUnique: vi.fn(),
  browserDirectUploadsEnabled: vi.fn(),
  presignGetUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@avenick/database", () => ({ db: { sellerDocument: { findUnique: mocks.findUnique } } }));
// The namespace test itself stays real: the point of the viewer is that a key
// outside the owning seller's prefix is never signed, and that only holds if
// the check being exercised is the one production runs.
vi.mock("@avenick/utils/browser-upload-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avenick/utils/browser-upload-policy")>();
  return { ...actual, browserDirectUploadsEnabled: mocks.browserDirectUploadsEnabled };
});
vi.mock("@avenick/utils/s3", () => ({ presignGetUrl: mocks.presignGetUrl }));

import { GET } from "../[id]/view/route";

const documentId = "cdoc000000000000001";
const sellerId = "cseller00000000000001";
// The shape buildObjectKey() in @avenick/utils/s3 actually emits under the
// seller-document namespace: <base36 stamp>-<12 hex>.<allowlisted ext>.
const ownKey = `private/sellers/${sellerId}/documents/mfa1b2c3-0123456789ab.pdf`;
const signedUrl = "https://storage.test/bucket/signed?X-Amz-Signature=test";

function get(id: string) {
  return GET(new Request(`https://admin.test/documents/${id}/view`), { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue({ userId: "cadmin0000000000001", role: "ADMIN" });
  mocks.browserDirectUploadsEnabled.mockReturnValue(true);
  mocks.presignGetUrl.mockReturnValue(signedUrl);
});

describe("admin document viewer", () => {
  it("answers 404 for a non-record id before touching auth or the database", async () => {
    await expect(get("not-a-record-id")).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
    expect(mocks.requireAdminSession).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("lets the admin-session redirect propagate and never loads the row", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    mocks.requireAdminSession.mockRejectedValue(redirect);
    await expect(get(documentId)).rejects.toBe(redirect);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("answers 404 when the row does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(get(documentId)).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: documentId },
      select: { fileUrl: true, sellerId: true },
    });
  });

  it("302s to a presigned GET for a key in the owning seller's namespace", async () => {
    mocks.findUnique.mockResolvedValue({ fileUrl: ownKey, sellerId });
    const response = await get(documentId);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(signedUrl);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.presignGetUrl).toHaveBeenCalledWith(ownKey);
  });

  it("302s straight through to a legacy https URL without signing it", async () => {
    const legacy = "https://legacy.test/seed/cr-certificate.pdf";
    mocks.findUnique.mockResolvedValue({ fileUrl: legacy, sellerId });
    const response = await get(documentId);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(legacy);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.presignGetUrl).not.toHaveBeenCalled();
  });

  it("answers 503 for a namespaced key when object storage is not configured", async () => {
    mocks.browserDirectUploadsEnabled.mockReturnValue(false);
    mocks.findUnique.mockResolvedValue({ fileUrl: ownKey, sellerId });
    const response = await get(documentId);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.presignGetUrl).not.toHaveBeenCalled();
  });

  it("answers 409 for a reference that is neither the row's own key nor a link", async () => {
    // Another seller's key stored on this row: the namespace is bound to the
    // row's sellerId, so it must not be signed. Same for a malformed segment,
    // a product-image key, and a "link" that only looks like one — a row that
    // cannot be followed must be reported, never thrown as a 500.
    for (const fileUrl of [
      `private/sellers/cotherseller0000001/documents/mfa1b2c3-0123456789ab.pdf`,
      `private/sellers/${sellerId}/documents/../../../secrets.pdf`,
      `private/sellers/${sellerId}/documents/hand-written-name.pdf`,
      `public/sellers/${sellerId}/products/mfa1b2c3-0123456789ab.jpg`,
      "ftp://legacy.test/file.pdf",
      "https://",
      "https://legacy test/space-in-host.pdf",
      "",
    ]) {
      mocks.presignGetUrl.mockClear();
      mocks.findUnique.mockResolvedValue({ fileUrl, sellerId });
      const response = await get(documentId);
      expect(response.status, fileUrl).toBe(409);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mocks.presignGetUrl).not.toHaveBeenCalled();
    }
  });
});
