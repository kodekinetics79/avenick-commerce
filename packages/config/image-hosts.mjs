/**
 * next/image `remotePatterns` entries for the hosts that serve user-uploaded
 * media, derived from the same env the presigner reads.
 *
 * Why this exists: the customer, seller and admin portals all render product
 * images with next/image, and next/image throws (taking the whole page down)
 * for a host that is not allow-listed. Uploads live on the S3/MinIO/R2 host,
 * which differs per environment, so the allow-list has to be computed at
 * build time rather than hard-coded — a wrong hostname here surfaces as a
 * blank catalog, not as an error anyone reads.
 *
 * S3_PUBLIC_BASE_URL wins when set (Cloudflare R2 and CDN fronts serve public
 * objects from a different origin than the S3 API endpoint). Otherwise the
 * S3_ENDPOINT origin is used, which is how MinIO and AWS path-style URLs work.
 * With neither set, nothing is added: the catalog then only renders hosts in
 * the static list, which is the truthful state of "no object storage".
 */
export function objectStorageRemotePatterns(env = process.env) {
  const candidates = [env.S3_PUBLIC_BASE_URL, env.S3_ENDPOINT];
  const patterns = [];
  const seen = new Set();
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    const protocol = url.protocol.replace(/:$/, "");
    if (protocol !== "http" && protocol !== "https") continue;
    const key = `${protocol}://${url.host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    patterns.push({
      protocol,
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/**",
    });
  }
  return patterns;
}
