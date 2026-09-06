import { describe, expect, it } from "vitest";
import { navAccessForRole } from "../nav-access";

/**
 * The sidebar used to render the same eleven destinations to every role, so a
 * COMPANY_BUYER read "Approval Policies", "Team & Roles" and "Delivery Sites"
 * as places they could work and found out otherwise on arrival — once per page.
 *
 * These pin the two halves of the fix that are easy to get backwards later:
 * that the marking follows the SERVER's gates rather than a tidier-looking
 * list, and that an unknown role over-promises rather than demoting a
 * legitimate administrator's sidebar while the session resolves.
 */
const EVERY_DESTINATION = [
  "/b2b",
  "/b2b/approvals",
  "/b2b/quotes",
  "/b2b/purchase-orders",
  "/b2b/lists",
  "/b2b/billing",
  "/b2b/analytics",
  "/b2b/approval-policies",
  "/b2b/team",
  "/b2b/addresses",
  "/b2b/company",
];

/** Every write action behind these admits COMPANY_ADMIN and nobody else. */
const ADMIN_ONLY = ["/b2b/approval-policies", "/b2b/team", "/b2b/addresses"];

describe("what the buyer sidebar promises each role", () => {
  it("promises an administrator everything, because the gates admit them everywhere", () => {
    for (const href of EVERY_DESTINATION) {
      expect(navAccessForRole(href, "COMPANY_ADMIN")).toBe("full");
    }
  });

  it("marks the three administrator-only destinations read-only for an approver", () => {
    for (const href of ADMIN_ONLY) {
      expect(navAccessForRole(href, "COMPANY_APPROVER")).toBe("read");
    }
  });

  it("leaves the approvals queue fully workable for an approver and read-only for a buyer", () => {
    // api/b2b/purchase-orders/[id]/route.ts:47 refuses approve/reject to
    // anything outside B2B_APPROVER_ROLES, which is admin and approver only.
    expect(navAccessForRole("/b2b/approvals", "COMPANY_APPROVER")).toBe("full");
    expect(navAccessForRole("/b2b/approvals", "COMPANY_BUYER")).toBe("read");
  });

  it("marks every administrator-only destination read-only for a buyer", () => {
    for (const href of ADMIN_ONLY) {
      expect(navAccessForRole(href, "COMPANY_BUYER")).toBe("read");
    }
  });

  it("leaves a buyer's own working destinations alone", () => {
    // Hiding a page a role may legitimately read is the same lie backwards: a
    // buyer raises these, reads their own spend against them, and needs them.
    for (const href of ["/b2b", "/b2b/quotes", "/b2b/purchase-orders", "/b2b/lists", "/b2b/billing", "/b2b/analytics", "/b2b/company"]) {
      expect(navAccessForRole(href, "COMPANY_BUYER")).toBe("full");
    }
  });

  it("hides nothing from anyone today", () => {
    // Every one of the eleven pages renders something the role may read, and
    // the two a non-approver cannot act on say so on the page itself. If this
    // ever fails, a destination has been hidden — check that it is genuinely
    // unusable and not merely untidy.
    for (const role of ["COMPANY_ADMIN", "COMPANY_APPROVER", "COMPANY_BUYER", undefined]) {
      for (const href of EVERY_DESTINATION) {
        expect(navAccessForRole(href, role)).not.toBe("hidden");
      }
    }
  });

  it("over-promises rather than demotes when the role is not known yet", () => {
    // Called from a client component: the session may not have resolved on the
    // first paint, and a sidebar that quietly strips an administrator's own
    // destinations is a worse failure than one that briefly over-promises.
    for (const href of EVERY_DESTINATION) {
      expect(navAccessForRole(href, undefined)).toBe("full");
      expect(navAccessForRole(href, "")).toBe("full");
    }
  });
});
