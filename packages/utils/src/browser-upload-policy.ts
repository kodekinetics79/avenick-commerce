/**
 * Server-side upload policy for browser-direct object uploads.
 *
 * The browser is untrusted. Everything that decides what may land in the bucket
 * is computed here, on the server, from the caller's session:
 *
 *  1. SIZE — the exact byte length is signed into the URL as `content-length`.
 *     Content-Length is a forbidden header name in `fetch`, so the browser sets
 *     it from the real body and cannot re-declare it; a body of any other length
 *     produces a SigV4 mismatch and storage rejects the PUT. The ceiling is
 *     therefore enforced by storage, not by a client-side check we hope holds.
 *  2. MEDIA TYPE — the media type is derived from an allowlisted extension, the
 *     client's declared type must agree with it, and the derived value (never
 *     the client's string) is signed as `content-type`. Uploading under a
 *     different type is likewise a signature mismatch.
 *  3. NAMESPACE — the object key is generated here from the session principal.
 *     Nothing the client sends contributes a path segment, so a buyer cannot
 *     write into `sellers/…` and a seller cannot write into another seller's
 *     prefix. Path traversal has no surface: the submitted filename is read for
 *     its extension and then discarded.
 *
 * These are the three bindings the fail-closed stub in the customer portal said
 * had to exist before any URL could be issued. What it could not do before is
 * now done; what remains is configuration, and that still fails closed — see
 * browserDirectUploadsEnabled().
 *
 * Honest limitation: signing `content-type` binds the *declared* type of the
 * stored object, not the bytes. Nothing here sniffs magic numbers or scans for
 * malware. The exploit that would normally follow — a scriptable object served
 * from a public bucket — is closed structurally instead: the key's extension
 * comes from the allowlist below, which contains no `.svg`, `.html` or `.js`,
 * so such an object cannot be created at all. Byte-level verification would
 * still need a post-upload verifier.
 */
import crypto from "crypto";
import { buildObjectKey, getS3Config, isObjectStorageConfigured, objectPublicUrl } from "./s3";

export type UploadPurpose = "product-image" | "seller-document" | "message-attachment" | "avatar";

export interface UploadPurposePolicy {
  /** Hard byte ceiling for this purpose; signed into the URL. */
  maxBytes: number;
  /** Lowercase extension (with dot) → the ONLY media type accepted for it. */
  mediaTypesByExtension: Readonly<Record<string, string>>;
  /**
   * Whether the finished object may be handed out as a public read URL.
   * KYC documents and B2B correspondence are private: callers get the key and
   * must mint a short-lived presigned GET (see presignGetUrl in ./s3) to read
   * them back, so the URL cannot be forwarded or indexed.
   */
  visibility: "public" | "private";
}

/**
 * Raster image types only. `.svg` is deliberately absent — it is an XML
 * document that can carry script, and objects in the shared bucket are served
 * for direct display. `.gif` is absent because nothing in the product surface
 * needs animation and every extra type is extra parser surface.
 */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Compliance evidence arrives as a scan or a PDF. */
const DOCUMENT_TYPES: Readonly<Record<string, string>> = { ...IMAGE_TYPES, ".pdf": "application/pdf" };

export const UPLOAD_POLICIES: Readonly<Record<UploadPurpose, UploadPurposePolicy>> = {
  "product-image": { maxBytes: 5 * 1024 * 1024, mediaTypesByExtension: IMAGE_TYPES, visibility: "public" },
  "seller-document": { maxBytes: 10 * 1024 * 1024, mediaTypesByExtension: DOCUMENT_TYPES, visibility: "private" },
  "message-attachment": { maxBytes: 10 * 1024 * 1024, mediaTypesByExtension: DOCUMENT_TYPES, visibility: "private" },
  avatar: { maxBytes: 2 * 1024 * 1024, mediaTypesByExtension: IMAGE_TYPES, visibility: "public" },
};

/** The signed URL is a write capability; keep the window to minutes, not hours. */
export const UPLOAD_PRESIGN_TTL_SECONDS = 300;

/**
 * Rate limit for presign requests, structurally a RateLimitRule from
 * packages/auth/src/rate-limit.ts and used with checkRateLimit() exactly like
 * the entries in RATE_LIMITS. It is declared here rather than added to
 * RATE_LIMITS because @avenick/utils cannot import @avenick/auth — auth depends
 * on database, which depends on utils, so that import would close a cycle.
 *
 * Every grant is a licence to write one object bounded by maxBytes, so this
 * rule is really a bytes-per-account budget: 60 grants per ten minutes caps a
 * compromised session at ~600 MB per window even at the largest ceiling, while
 * leaving room for a seller uploading a full gallery across several products.
 */
export const UPLOAD_PRESIGN_RATE_LIMIT = {
  name: "upload-presign",
  limit: 60,
  windowMs: 10 * 60_000,
};

/**
 * Who is asking. Constructed by the route from the session only — there is no
 * shape here that a request body can populate.
 */
export type UploadPrincipal =
  | { kind: "seller"; sellerId: string }
  | { kind: "buyer"; userId: string };

/**
 * The role→namespace binding, in one place so neither portal can drift from it.
 * A principal may only request the purposes listed for its kind.
 */
const PURPOSES_BY_PRINCIPAL: Readonly<Record<UploadPrincipal["kind"], readonly UploadPurpose[]>> = {
  seller: ["product-image", "seller-document"],
  buyer: ["message-attachment", "avatar"],
};

/** Purposes a given principal kind may request; useful for building a route's schema. */
export function uploadPurposesFor(kind: UploadPrincipal["kind"]): readonly UploadPurpose[] {
  return PURPOSES_BY_PRINCIPAL[kind];
}

/**
 * Ids reaching this function come from the database (cuid), never from the
 * client. The check is a belt-and-braces guard so that a future caller passing
 * something else can never smuggle a `/` or `..` into the key prefix.
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Every key starts with its visibility. The bucket's anonymous-read policy is
 * scoped to `public/` and nothing else, so a private document can never become
 * readable through a bucket-wide rule — the layout enforces it, not a policy
 * someone has to remember to narrow (see docker-compose's `mc anonymous set`
 * and DEPLOYMENT.md for the production equivalent).
 */
export const PUBLIC_KEY_PREFIX = "public/";
export const PRIVATE_KEY_PREFIX = "private/";

/** Session-derived key prefix, or null when this principal may not use this purpose. */
function namespaceFor(principal: UploadPrincipal, purpose: UploadPurpose): string | null {
  if (!PURPOSES_BY_PRINCIPAL[principal.kind].includes(purpose)) return null;
  const visibilityPrefix = UPLOAD_POLICIES[purpose].visibility === "public" ? PUBLIC_KEY_PREFIX : PRIVATE_KEY_PREFIX;

  if (principal.kind === "seller") {
    if (!SAFE_ID.test(principal.sellerId)) return null;
    return purpose === "product-image"
      ? `${visibilityPrefix}sellers/${principal.sellerId}/products`
      : `${visibilityPrefix}sellers/${principal.sellerId}/documents`;
  }

  if (!SAFE_ID.test(principal.userId)) return null;
  return purpose === "avatar"
    ? `${visibilityPrefix}users/${principal.userId}/avatars`
    : `${visibilityPrefix}users/${principal.userId}/messages`;
}

/**
 * The key prefix (with trailing slash) a principal's uploads for `purpose`
 * land under, or null when the principal may not use that purpose. Exposed so
 * the code that RECORDS an uploaded key (a seller document row, a product
 * image row) can refuse a key outside the namespace the presigner would have
 * issued — a client can only ever PUT where it was signed to, but nothing
 * stops it from *claiming* another key in a later request.
 */
export function uploadKeyPrefixFor(principal: UploadPrincipal, purpose: UploadPurpose): string | null {
  const namespace = namespaceFor(principal, purpose);
  return namespace ? `${namespace}/` : null;
}

/** Whether a stored key belongs to the given principal's namespace for the purpose. */
export function isKeyInUploadNamespace(key: string, principal: UploadPrincipal, purpose: UploadPurpose): boolean {
  const prefix = uploadKeyPrefixFor(principal, purpose);
  if (!prefix || !key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  // One generated segment, no separators, no traversal.
  return /^[a-z0-9]+-[0-9a-f]{12}\.[a-z0-9]+$/.test(rest);
}

export interface PresignedUpload {
  /** Server-generated object key. The only path the client ever learns. */
  key: string;
  /** Short-lived signed URL. PUT the file body to it verbatim. */
  url: string;
  method: "PUT";
  /** Headers the client MUST send. Any other value breaks the signature. */
  headers: Record<string, string>;
  /** The media type that will be stored, derived from the extension. */
  contentType: string;
  /** Exact byte length bound into the signature. */
  size: number;
  /** Ceiling for this purpose, so the UI can explain a 413 before trying. */
  maxBytes: number;
  expiresAt: string;
  visibility: "public" | "private";
  /** Readable URL for public objects; null for private ones (mint a GET instead). */
  publicUrl: string | null;
}

export type UploadDecision =
  | { ok: true; upload: PresignedUpload }
  | { ok: false; status: 400 | 403 | 413 | 415 | 503; error: string };

/**
 * Whether a browser may be handed a direct-to-storage upload URL at all.
 *
 * Both preconditions the original fail-closed stub named — an object-size
 * ceiling and a verified media type — are now enforced by the signature, so the
 * only remaining question is configuration. With no S3_* contract present there
 * is nothing to sign against and the honest answer is 503: never a fabricated
 * URL, never an unsigned one, never a silent success.
 */
export function browserDirectUploadsEnabled(): boolean {
  return isObjectStorageConfigured();
}

/**
 * Validate an upload request against the policy and, if it passes, mint the
 * signed URL. Returns a decision rather than throwing so routes map it straight
 * onto a status code.
 */
export function createPresignedUpload(request: {
  principal: UploadPrincipal;
  purpose: string;
  filename: string;
  contentType: string;
  size: number;
}): UploadDecision {
  // Configuration is checked first: an unconfigured environment must answer the
  // same way for every request rather than leaking which inputs would be valid.
  if (!browserDirectUploadsEnabled()) {
    return {
      ok: false,
      status: 503,
      error: "File storage is not configured for this environment, so uploads are unavailable.",
    };
  }

  const purpose = request.purpose as UploadPurpose;
  const policy = Object.prototype.hasOwnProperty.call(UPLOAD_POLICIES, purpose)
    ? UPLOAD_POLICIES[purpose]
    : undefined;
  if (!policy) return { ok: false, status: 400, error: "Unknown upload purpose" };

  const namespace = namespaceFor(request.principal, purpose);
  if (!namespace) {
    return { ok: false, status: 403, error: "This account may not upload files for that purpose" };
  }

  if (!Number.isSafeInteger(request.size) || request.size <= 0) {
    return { ok: false, status: 400, error: "A positive file size in bytes is required" };
  }
  if (request.size > policy.maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `Files for this purpose must be ${formatByteLimit(policy.maxBytes)} or smaller`,
    };
  }

  // The extension decides the media type; the client's declared type only has
  // to agree with it. A `.pdf` renamed to `.png` cannot be uploaded as a PDF,
  // and a PDF cannot be stored under an image extension.
  const extension = extensionOf(request.filename);
  const expectedType = extension ? policy.mediaTypesByExtension[extension] : undefined;
  if (!extension || !expectedType) {
    return {
      ok: false,
      status: 415,
      error: `Allowed file types: ${Object.keys(policy.mediaTypesByExtension).sort().join(", ")}`,
    };
  }
  const declaredType = request.contentType.split(";")[0]!.trim().toLowerCase();
  if (declaredType !== expectedType) {
    return { ok: false, status: 415, error: `A ${extension} file must be uploaded as ${expectedType}` };
  }

  // Key is generated server-side under the session's namespace. The submitted
  // filename contributed nothing but the extension checked above.
  const key = buildObjectKey(namespace, `upload${extension}`);
  const url = presignBoundPut(key, {
    contentType: expectedType,
    contentLength: request.size,
    expiresIn: UPLOAD_PRESIGN_TTL_SECONDS,
  });

  return {
    ok: true,
    upload: {
      key,
      url,
      method: "PUT",
      headers: { "Content-Type": expectedType },
      contentType: expectedType,
      size: request.size,
      maxBytes: policy.maxBytes,
      expiresAt: new Date(Date.now() + UPLOAD_PRESIGN_TTL_SECONDS * 1000).toISOString(),
      visibility: policy.visibility,
      publicUrl: policy.visibility === "public" ? objectPublicUrl(key) : null,
    },
  };
}

/**
 * Extension of a client-supplied filename, lowercased, or null.
 * Any directory part is stripped before parsing; the result is only ever used
 * to look up a media type and to suffix a server-generated key.
 */
function extensionOf(filename: string): string | null {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null; // no extension, or a dotfile with no name
  const ext = base.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : null;
}

function formatByteLimit(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// ─── SigV4 ────────────────────────────────────────────────────────────────────

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256Hex = (data: string) => crypto.createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: crypto.BinaryLike | crypto.KeyObject, data: string) =>
  crypto.createHmac("sha256", key).update(data, "utf8").digest();

/**
 * Presign a PUT that is bound to an exact Content-Length and Content-Type.
 *
 * This is a sibling of the presigner in ./s3, not a replacement: that one signs
 * `host` alone, which is right for the server-to-server backup upload but
 * cannot carry a policy. Signing the two extra headers is the whole point here
 * — it is what moves the size ceiling and the media type from a client promise
 * into a storage-enforced constraint — and ./s3's presign() is module-private,
 * so the canonical-request construction is repeated rather than parameterised.
 * The two should be merged behind one signer with a signedHeaders option; that
 * touches ./s3, which is outside this change.
 *
 * Path-style addressing, UNSIGNED-PAYLOAD, SigV4 query auth: identical to ./s3,
 * so it works against MinIO locally and S3/R2 in production unchanged.
 *
 * Note for operators: because Content-Type is set on a cross-origin PUT the
 * browser sends a CORS preflight, so the bucket needs a CORS rule allowing PUT
 * and the Content-Type header from the portal origins. MinIO permits this by
 * default; S3 and R2 need the rule configured.
 */
function presignBoundPut(
  key: string,
  opts: { contentType: string; contentLength: number; expiresIn: number },
): string {
  const cfg = getS3Config();
  // Unreachable via createPresignedUpload(), which checks configuration first.
  if (!cfg) throw new Error("Object storage is not configured");

  const expiresIn = Math.min(Math.max(opts.expiresIn, 1), 604800);
  const objectKey = key.replace(/^\/+/, "");

  const base = new URL(cfg.endpoint);
  const host = base.host;
  const canonicalUri = `/${enc(cfg.bucket)}/${objectKey.split("/").map(enc).join("/")}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;

  // Alphabetical, as SigV4 requires.
  const signedHeaders = "content-length;content-type;host";

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k]!)}`)
    .join("&");

  const canonicalHeaders =
    `content-length:${opts.contentLength}\n` + `content-type:${opts.contentType}\n` + `host:${host}\n`;

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${cfg.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return `${base.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
