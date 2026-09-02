/**
 * Deterministic coverage for the upload policy and its bound SigV4 presigner.
 *
 * The presigner in browser-upload-policy.ts repeats ./s3's canonical-request
 * construction and adds two signed headers. Nothing else in this package
 * exercises it, and a divergence from the SigV4 spec is a silent 403 from
 * real S3 (MinIO is more lenient). So this file carries an independent
 * VERIFIER written from the spec — what the storage server does on receipt:
 * parse the URL, rebuild the canonical request from the request as actually
 * sent, re-derive the signing key from the secret, and compare signatures.
 *
 * The verifier is first checked against ./s3's trusted host-only signer, then
 * applied to the bound signer. That makes the test a statement about the
 * delta between the two, not just an echo of the code under test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import {
  createPresignedUpload,
  isKeyInUploadNamespace,
  uploadKeyPrefixFor,
  UPLOAD_POLICIES,
  UPLOAD_PRESIGN_TTL_SECONDS,
} from "../browser-upload-policy";
import { presignPutUrl } from "../s3";

// The AWS SigV4 documentation example credentials; nothing real.
const ENV = {
  S3_ENDPOINT: "http://localhost:9000",
  S3_BUCKET: "avenick-uploads",
  S3_ACCESS_KEY: "AKIAIOSFODNN7EXAMPLE",
  S3_SECRET_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  S3_REGION: "us-east-1",
};
const FROZEN_NOW = new Date("2013-05-24T00:00:00.000Z");

const SELLER = { kind: "seller", sellerId: "clseller000000000000001" } as const;
const BUYER = { kind: "buyer", userId: "cluser00000000000000001" } as const;

// ─── Spec-derived verifier ────────────────────────────────────────────────────

const rfc3986 = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Emulate the receiving server. `headers` are the request headers exactly as a
 * client would send them (case-insensitive names). Returns the computed
 * signature so a mismatch is visible in the assertion diff.
 */
function serverSideSignature(
  url: string,
  request: { method: string; headers: Record<string, string> },
  secretKey: string,
): { presented: string; computed: string } {
  const u = new URL(url);
  const params = new Map<string, string>();
  for (const [k, v] of u.searchParams) params.set(k, v);

  const presented = params.get("X-Amz-Signature") ?? "";
  params.delete("X-Amz-Signature");

  const canonicalQuery = [...params.entries()]
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const headerMap = new Map<string, string>();
  for (const [k, v] of Object.entries(request.headers)) headerMap.set(k.toLowerCase(), v.trim());
  headerMap.set("host", u.host);

  const signedHeaders = (params.get("X-Amz-SignedHeaders") ?? "").split(";");
  const canonicalHeaders = signedHeaders
    .map((name) => {
      const value = headerMap.get(name);
      if (value === undefined) throw new Error(`request is missing signed header ${name}`);
      return `${name}:${value}\n`;
    })
    .join("");

  // S3 canonical URI: the encoded absolute path, encoded once (S3 is the one
  // service that does not double-encode). u.pathname is already that.
  const canonicalRequest = [
    request.method,
    u.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const amzDate = params.get("X-Amz-Date") ?? "";
  const credential = params.get("X-Amz-Credential") ?? "";
  const [, dateStamp, region, service, terminator] = credential.split("/");
  const scope = `${dateStamp}/${region}/${service}/${terminator}`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex"),
  ].join("\n");

  const hmac = (key: crypto.BinaryLike, data: string) => crypto.createHmac("sha256", key).update(data, "utf8").digest();
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp!), region!), service!), terminator!);
  const computed = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return { presented, computed };
}

function verifies(url: string, request: { method: string; headers: Record<string, string> }): boolean {
  const { presented, computed } = serverSideSignature(url, request, ENV.S3_SECRET_KEY);
  return presented.length === 64 && presented === computed;
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

const savedEnv = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, ENV);
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
  // buildObjectKey's random suffix is the only non-deterministic input left.
  vi.spyOn(crypto, "randomBytes").mockImplementation(((size: number) => Buffer.alloc(size, 0)) as typeof crypto.randomBytes);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  process.env = { ...savedEnv };
});

function grant(overrides: Partial<Parameters<typeof createPresignedUpload>[0]> = {}) {
  return createPresignedUpload({
    principal: SELLER,
    purpose: "product-image",
    filename: "photo.png",
    contentType: "image/png",
    size: 70,
    ...overrides,
  });
}

function okGrant(overrides: Partial<Parameters<typeof createPresignedUpload>[0]> = {}) {
  const decision = grant(overrides);
  if (!decision.ok) throw new Error(`expected a grant, got ${decision.status}: ${decision.error}`);
  return decision.upload;
}

// ─── Signer ───────────────────────────────────────────────────────────────────

describe("SigV4 verifier", () => {
  it("reproduces the signature in the AWS SigV4 documentation example", () => {
    // Published vector (Amazon S3 API Reference, "Authenticating Requests:
    // Using Query Parameters", example presigned GET). Anchors the verifier to
    // AWS's own arithmetic so the tests below are not circular.
    const aws =
      "https://examplebucket.s3.amazonaws.com/test.txt" +
      "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
      "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request" +
      "&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404";
    const { presented, computed } = serverSideSignature(aws, { method: "GET", headers: {} }, ENV.S3_SECRET_KEY);
    expect(computed).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
    expect(presented).toBe(computed);
  });

  it("accepts the trusted host-only presignPutUrl output and rejects it when the key is rewritten", () => {
    const url = presignPutUrl("sellers/s1/products/a.png", { expiresIn: 300 });
    expect(verifies(url, { method: "PUT", headers: {} })).toBe(true);
    expect(verifies(url.replace("/products/", "/documents/"), { method: "PUT", headers: {} })).toBe(false);
    expect(verifies(url, { method: "GET", headers: {} })).toBe(false);
  });
});

describe("presignBoundPut", () => {
  it("produces a URL the server verifies only with the exact bound headers", () => {
    const upload = okGrant();
    const honest = { "Content-Type": "image/png", "Content-Length": "70" };

    expect(verifies(upload.url, { method: "PUT", headers: honest })).toBe(true);

    // Each binding the policy claims to make must actually be in the signature.
    expect(verifies(upload.url, { method: "PUT", headers: { ...honest, "Content-Length": "71" } })).toBe(false);
    expect(verifies(upload.url, { method: "PUT", headers: { ...honest, "Content-Type": "text/html" } })).toBe(false);
    expect(verifies(upload.url.replace("/products/", "/documents/"), { method: "PUT", headers: honest })).toBe(false);
    expect(verifies(upload.url, { method: "GET", headers: honest })).toBe(false);
  });

  it("differs from ./s3 only by the two extra signed headers", () => {
    const upload = okGrant();
    const u = new URL(upload.url);
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(u.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(u.searchParams.get("X-Amz-Date")).toBe("20130524T000000Z");
    expect(u.searchParams.get("X-Amz-Expires")).toBe(String(UPLOAD_PRESIGN_TTL_SECONDS));
    expect(u.searchParams.get("X-Amz-Credential")).toBe("AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");

    // Same path-style shape as ./s3: /<bucket>/<key>, host carries the port.
    expect(u.host).toBe("localhost:9000");
    expect(u.pathname).toBe(`/avenick-uploads/${upload.key}`);

    // Query names in canonical (sorted) order, signature last.
    expect([...u.searchParams.keys()]).toEqual([
      "X-Amz-Algorithm",
      "X-Amz-Credential",
      "X-Amz-Date",
      "X-Amz-Expires",
      "X-Amz-SignedHeaders",
      "X-Amz-Signature",
    ]);
  });

  it("is byte-stable for a frozen clock and key (regression pin)", () => {
    // Pinned from a run that the spec-derived verifier above accepted. If this
    // changes, the canonical request changed: re-verify against real S3 before
    // updating the value.
    const upload = okGrant();
    expect(upload.key).toBe("public/sellers/clseller000000000000001/products/hh2ls000-000000000000.png");
    expect(new URL(upload.url).searchParams.get("X-Amz-Signature")).toBe(
      "903ef756ee56a7e3cc7598e4ea3c4acff78e6681c91c51111aa89be3d4c1e946",
    );
  });
});

// ─── Policy ───────────────────────────────────────────────────────────────────

describe("createPresignedUpload policy", () => {
  it("fails closed with 503 when storage is unconfigured, before looking at the input", () => {
    delete process.env.S3_SECRET_KEY;
    const decision = grant({ purpose: "not-a-purpose", size: -1 });
    expect(decision).toMatchObject({ ok: false, status: 503 });
  });

  it("binds role to namespace: purposes cannot cross principal kinds", () => {
    expect(grant({ principal: BUYER, purpose: "product-image" })).toMatchObject({ ok: false, status: 403 });
    expect(grant({ principal: BUYER, purpose: "seller-document" })).toMatchObject({ ok: false, status: 403 });
    expect(grant({ principal: SELLER, purpose: "avatar" })).toMatchObject({ ok: false, status: 403 });
    expect(grant({ principal: SELLER, purpose: "message-attachment" })).toMatchObject({ ok: false, status: 403 });

    expect(okGrant().key.startsWith(`public/sellers/${SELLER.sellerId}/products/`)).toBe(true);
    expect(okGrant({ purpose: "seller-document", filename: "cr.pdf", contentType: "application/pdf" }).key).toMatch(
      new RegExp(`^private/sellers/${SELLER.sellerId}/documents/[a-z0-9]+-[0-9a-f]{12}\\.pdf$`),
    );
    expect(okGrant({ principal: BUYER, purpose: "avatar" }).key.startsWith(`public/users/${BUYER.userId}/avatars/`)).toBe(true);
  });

  it("refuses a principal id that could carry a path segment", () => {
    expect(grant({ principal: { kind: "seller", sellerId: "../other" } })).toMatchObject({ ok: false, status: 403 });
    expect(grant({ principal: { kind: "seller", sellerId: "a/b" } })).toMatchObject({ ok: false, status: 403 });
    expect(grant({ principal: { kind: "seller", sellerId: "" } })).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects unknown purposes including prototype keys", () => {
    expect(grant({ purpose: "__proto__" })).toMatchObject({ ok: false, status: 400 });
    expect(grant({ purpose: "constructor" })).toMatchObject({ ok: false, status: 400 });
    expect(grant({ purpose: "" })).toMatchObject({ ok: false, status: 400 });
  });

  it("enforces the size ceiling exactly and signs the validated size", () => {
    const max = UPLOAD_POLICIES["product-image"].maxBytes;
    expect(okGrant({ size: max }).size).toBe(max);
    expect(grant({ size: max + 1 })).toMatchObject({ ok: false, status: 413 });
    expect(grant({ size: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(grant({ size: 1.5 })).toMatchObject({ ok: false, status: 400 });
    expect(grant({ size: Number.MAX_SAFE_INTEGER + 2 })).toMatchObject({ ok: false, status: 400 });

    const atMax = okGrant({ size: max });
    expect(verifies(atMax.url, { method: "PUT", headers: { "Content-Type": "image/png", "Content-Length": String(max) } })).toBe(true);
    expect(verifies(atMax.url, { method: "PUT", headers: { "Content-Type": "image/png", "Content-Length": String(max + 1) } })).toBe(false);
  });

  it("derives the media type from the extension and signs that, not the client string", () => {
    // Case and double extensions: only the final, lowercased extension counts.
    expect(okGrant({ filename: "Photo.JPG", contentType: "image/jpeg" }).contentType).toBe("image/jpeg");
    expect(okGrant({ filename: "a.php.png", contentType: "image/png" }).key.endsWith(".png")).toBe(true);
    // Parameters on the declared type are tolerated; the signed value is the bare type.
    expect(okGrant({ contentType: "image/png; charset=binary" }).headers).toEqual({ "Content-Type": "image/png" });

    // Mismatch between declared type and extension: refused, not "corrected".
    expect(grant({ filename: "photo.png", contentType: "image/jpeg" })).toMatchObject({ ok: false, status: 415 });
    expect(grant({ filename: "doc.pdf", contentType: "application/pdf" })).toMatchObject({ ok: false, status: 415 });

    // Active content and unknown extensions never get a key.
    for (const name of ["logo.svg", "page.html", "x.js", "noext", ".png", "photo.png.", "photo.tar.gz"]) {
      expect(grant({ filename: name, contentType: "image/png" }), name).toMatchObject({ ok: false, status: 415 });
    }
  });

  it("discards everything about the filename except its extension", () => {
    const upload = okGrant({ filename: "../../etc/passwd/My Photo.JPG", contentType: "image/jpeg" });
    expect(upload.key).toMatch(/^public\/sellers\/[A-Za-z0-9_-]+\/products\/[a-z0-9]+-[0-9a-f]{12}\.jpg$/);
    expect(upload.key).not.toContain("..");
    expect(upload.key).not.toContain(" ");
  });

  it("only hands out a public read URL for public purposes", () => {
    const image = okGrant();
    expect(image.visibility).toBe("public");
    expect(image.publicUrl).toBe(`http://localhost:9000/avenick-uploads/${image.key}`);

    const doc = okGrant({ purpose: "seller-document", filename: "licence.pdf", contentType: "application/pdf" });
    expect(doc.visibility).toBe("private");
    expect(doc.publicUrl).toBeNull();
  });

  it("reports an expiry that matches the signed X-Amz-Expires window", () => {
    const upload = okGrant();
    expect(upload.expiresAt).toBe(new Date(FROZEN_NOW.getTime() + UPLOAD_PRESIGN_TTL_SECONDS * 1000).toISOString());
  });
});

describe("upload namespace membership", () => {
  // The presigner decides where a client may PUT; these helpers are what the
  // code that RECORDS a key afterwards uses to refuse a key it never issued.
  it("accepts exactly the key the presigner minted for the same principal and purpose", () => {
    const upload = okGrant();
    expect(isKeyInUploadNamespace(upload.key, SELLER, "product-image")).toBe(true);
    const doc = okGrant({ purpose: "seller-document", filename: "cr.pdf", contentType: "application/pdf" });
    expect(isKeyInUploadNamespace(doc.key, SELLER, "seller-document")).toBe(true);
  });

  it("refuses keys from another principal, another purpose, or a hand-built path", () => {
    const upload = okGrant();
    expect(isKeyInUploadNamespace(upload.key, { kind: "seller", sellerId: "clseller000000000000002" }, "product-image")).toBe(false);
    expect(isKeyInUploadNamespace(upload.key, SELLER, "seller-document")).toBe(false);
    expect(isKeyInUploadNamespace(`${uploadKeyPrefixFor(SELLER, "product-image")}../../x.png`, SELLER, "product-image")).toBe(false);
    expect(isKeyInUploadNamespace(`${uploadKeyPrefixFor(SELLER, "product-image")}a/b.png`, SELLER, "product-image")).toBe(false);
    expect(isKeyInUploadNamespace("public/sellers/clseller000000000000001/products/", SELLER, "product-image")).toBe(false);
  });

  it("puts public and private purposes under different top-level prefixes", () => {
    expect(uploadKeyPrefixFor(SELLER, "product-image")).toMatch(/^public\//);
    expect(uploadKeyPrefixFor(SELLER, "seller-document")).toMatch(/^private\//);
    expect(uploadKeyPrefixFor(BUYER, "avatar")).toMatch(/^public\//);
    expect(uploadKeyPrefixFor(BUYER, "message-attachment")).toMatch(/^private\//);
    expect(uploadKeyPrefixFor(BUYER, "product-image")).toBeNull();
  });
});
