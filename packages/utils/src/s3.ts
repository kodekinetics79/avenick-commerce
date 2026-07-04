/**
 * Minimal S3 presigned-URL helper — no AWS SDK dependency.
 *
 * Generates a short-lived, SigV4-signed PUT URL so the browser uploads a file
 * directly to object storage; the app server never proxies the bytes. Works
 * with AWS S3 and any S3-compatible endpoint (MinIO, R2, etc.) via S3_ENDPOINT.
 *
 * Configured by the S3_* env contract already declared in .env.example:
 *   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
 * When unset, isObjectStorageConfigured() returns false and callers should show
 * an "uploads unavailable" state rather than a broken control.
 */
import crypto from "crypto";

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKey = process.env.S3_ACCESS_KEY?.trim();
  const secretKey = process.env.S3_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return { endpoint, region, bucket, accessKey, secretKey };
}

export function isObjectStorageConfigured(): boolean {
  return getS3Config() !== null;
}

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256Hex = (data: string) => crypto.createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: crypto.BinaryLike | crypto.KeyObject, data: string) =>
  crypto.createHmac("sha256", key).update(data, "utf8").digest();

/**
 * Presign a PUT URL for `key`, valid for `expiresIn` seconds (default 5 min).
 * The returned URL is uploaded to with a plain fetch(url, { method: "PUT", body }).
 * Throws if object storage isn't configured — guard with isObjectStorageConfigured().
 */
/**
 * Core SigV4 query-string presigner shared by presignPutUrl / presignGetUrl.
 * Path-style, UNSIGNED-PAYLOAD, host-only signed header — works for AWS S3 and
 * S3-compatible endpoints (MinIO, R2) alike.
 */
function presign(method: "PUT" | "GET", key: string, expiresInSec: number): string {
  const cfg = getS3Config();
  if (!cfg) throw new Error("Object storage is not configured");

  const expiresIn = Math.min(Math.max(expiresInSec, 1), 604800);
  const objectKey = key.replace(/^\/+/, "");

  const base = new URL(cfg.endpoint);
  const host = base.host;
  const canonicalUri = `/${enc(cfg.bucket)}/${objectKey.split("/").map(enc).join("/")}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const credential = `${cfg.accessKey}/${credentialScope}`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k]!)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join(
    "\n",
  );

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${cfg.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return `${base.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function presignPutUrl(key: string, opts: { expiresIn?: number; contentType?: string } = {}): string {
  return presign("PUT", key, opts.expiresIn ?? 300);
}

/**
 * Presign a GET URL for a private object, valid for `expiresIn` seconds
 * (default 5 min). Used to download private backups for restore/DR.
 */
export function presignGetUrl(key: string, opts: { expiresIn?: number } = {}): string {
  return presign("GET", key, opts.expiresIn ?? 300);
}

/** Public read URL for an uploaded object (path-style). */
export function objectPublicUrl(key: string): string {
  const cfg = getS3Config();
  if (!cfg) throw new Error("Object storage is not configured");
  const base = new URL(cfg.endpoint);
  const objectKey = key.replace(/^\/+/, "");
  return `${base.protocol}//${base.host}/${enc(cfg.bucket)}/${objectKey.split("/").map(enc).join("/")}`;
}

/** Build a collision-resistant object key under a namespace, preserving extension. */
export function buildObjectKey(namespace: string, filename: string): string {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString("hex");
  return `${namespace.replace(/^\/+|\/+$/g, "")}/${stamp}-${rand}${ext.toLowerCase()}`;
}
