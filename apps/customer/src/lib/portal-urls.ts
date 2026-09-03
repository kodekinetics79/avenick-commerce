/**
 * Cross-portal links from the storefront.
 *
 * "Become a seller" used to point at `/register`, which in this app is BUYER
 * registration: a prospective supplier clicked the CTA and landed on a consumer
 * sign-up form. Seller self-registration lives in the seller portal, a separate
 * deployment, so the link has to carry that portal's origin.
 *
 * The origin comes from the shared resolver (NEXT_PUBLIC_SELLER_PORTAL_URL,
 * with the documented localhost port outside production). There is no
 * hardcoded production host here on purpose: a wrong host is a link that
 * silently sends a supplier to the wrong deployment. When the origin is not
 * configured the helper returns null and the caller hides the CTA rather than
 * guessing.
 */
import { portalUrl } from "@avenick/utils/portal-config";

export function sellerPortalUrl(path = "/"): string | null {
  return portalUrl("seller", path);
}

/**
 * Seller self-registration in the seller portal — the only correct target for
 * "Become a seller". Null when this environment does not know where the
 * seller portal lives; render nothing in that case.
 */
export const SELLER_REGISTER_URL: string | null = sellerPortalUrl("/register");
