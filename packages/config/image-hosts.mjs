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

/**
 * The CSP `img-src` origins for a set of next/image `remotePatterns`.
 *
 * WHY THIS EXISTS. `remotePatterns` and the CSP are two answers to the same
 * question — "may the browser load this image?" — and they disagreed. All three
 * portals allow `www.mennekes.org` in remotePatterns, but only the customer
 * portal passed it to the CSP, so the admin and seller portals BLOCKED the very
 * images their own configuration promised to serve: no product photo on the
 * admin products list, and none on the approval screens where a human is meant
 * to look at the product before approving it. The failure is silent — a blocked
 * image is an empty box and one console line, and the page around it is fine.
 *
 * The object-storage hosts had the same hole waiting: they are computed from
 * env for remotePatterns and were never in any portal's CSP, so the first
 * uploaded product photo would have been invisible in production.
 *
 * Deriving one from the other is the fix. The pattern list stays the single
 * source of truth and the policy cannot fall behind it.
 *
 * @param {Array<{protocol?: string, hostname: string, port?: string}>} patterns
 * @param {object}  [options]
 * @param {boolean} [options.isDev] Include http origins (localhost media).
 * @returns {string[]} origins, deduplicated, in first-seen order
 */
export function imageOriginsFrom(patterns, { isDev = false } = {}) {
  const origins = new Set();
  for (const pattern of patterns ?? []) {
    const hostname = pattern?.hostname?.trim();
    if (!hostname) continue;
    const protocol = pattern.protocol ?? "https";
    if (protocol !== "http" && protocol !== "https") continue;
    // An http origin is a development convenience (localhost media). Carrying
    // it into a production policy would widen it for nothing.
    if (protocol === "http" && !isDev) continue;
    const port = pattern.port ? `:${pattern.port}` : hostname === "localhost" ? ":*" : "";
    origins.add(`${protocol}://${hostname}${port}`);
  }
  return [...origins];
}

