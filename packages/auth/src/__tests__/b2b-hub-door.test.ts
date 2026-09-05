import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// No session, and no network: an anonymous visitor is the whole subject here.
vi.mock("../remote-session", () => ({ resolveRemotePortalSession: async () => null }));

import { createMiddleware } from "../middleware";

const middleware = createMiddleware("customer");
const visit = (path: string) => middleware(new NextRequest(`https://avenick.test${path}`));
const bounced = async (path: string) => {
  const res = await visit(path);
  return res.status === 307 || res.status === 308 || (res.headers.get("location") ?? "").includes("/login");
};

/**
 * `/b2b` is the header's own "For business" link and the footer's "B2B portal".
 * It is the workspace, and it already handles a visitor it cannot place: the
 * dashboard fetch fails and the page redirects to /b2b/register, the door built
 * for a prospect. Gating it in the middleware replaced that with a bare login —
 * turning away the one visitor the door exists to catch.
 *
 * The fix cannot be an entry on PUBLIC_PATHS: that list is PREFIX-matched, so
 * "/b2b" there would open /b2b/team, /b2b/billing and every other company
 * surface at once. Hence an exact-match list, and hence this test — the value
 * of the change is entirely in the boundary it does NOT cross.
 */
describe("the B2B hub door", () => {
  it("lets an anonymous visitor reach /b2b, so the page can send them to the register door", async () => {
    expect(await bounced("/b2b")).toBe(false);
  });

  it.each([
    "/b2b/team",
    "/b2b/billing",
    "/b2b/company",
    "/b2b/purchase-orders",
    "/b2b/purchase-orders/new",
    "/b2b/approvals",
    "/b2b/approval-policies",
    "/b2b/quotes",
    "/b2b/lists",
    "/b2b/addresses",
    "/b2b/analytics",
    "/b2b/spatial-commerce",
  ])("still requires a session for %s", async (path) => {
    expect(await bounced(path), `${path} became public — the exact-match list leaked into the subtree`).toBe(true);
  });

  it("keeps the registration door public, prefix and all", async () => {
    expect(await bounced("/b2b/register")).toBe(false);
  });

  it("does not make /b2bsomething public by accident", async () => {
    expect(await bounced("/b2b-internal")).toBe(true);
  });

  it("still gates the b2b API, which is where company data actually lives", async () => {
    const res = await visit("/api/b2b/dashboard");
    expect(res.status).toBe(401);
  });
});
