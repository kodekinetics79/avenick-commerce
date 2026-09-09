/**
 * What a company role may actually DO at each destination in the buyer sidebar.
 *
 * WHY THIS EXISTS
 * ---------------
 * The sidebar rendered the same eleven rows to all three roles, so a
 * COMPANY_BUYER read "Approval Policies", "Team & Roles" and "Delivery Sites"
 * as places they could work and discovered they were read-only on arrival —
 * three times, once per page. The nav promised authority the server has never
 * granted them.
 *
 * WHY ALMOST NOTHING IS HIDDEN
 * ----------------------------
 * Hiding a page a role may legitimately READ is the same lie told backwards. A
 * buyer needs the policy thresholds to understand why their own purchase order
 * is being held, needs the roster to know which colleague can release it, and
 * needs the delivery sites their order will ship to. `hidden` is part of this
 * vocabulary and nothing currently maps to it: every one of the eleven B2B
 * pages renders something the role may legitimately read, and the two that a
 * non-approver cannot act on — /b2b/approvals and /b2b/approval-policies —
 * already say so on the page itself. That is a finding about those eleven
 * pages, not an oversight here; the case is kept in the type so the day a
 * genuinely unusable destination arrives, marking it is a one-line change.
 *
 * EVERY ENTRY IS A CITATION, NOT AN OPINION
 * -----------------------------------------
 * - /b2b/team          — inviteMember, updateMember and setMemberActive all
 *                        refuse anything but COMPANY_ADMIN
 *                        (app/b2b/team/actions.ts).
 * - /b2b/approval-policies — createPolicy and togglePolicy, same gate
 *                        (app/b2b/approval-policies/actions.ts:14,37).
 * - /b2b/addresses     — createAddress, setDefaultAddress and deleteAddress,
 *                        same gate (app/b2b/addresses/actions.ts:13,43,57).
 * - /b2b/approvals     — approve and reject require B2B_APPROVER_ROLES
 *                        (api/b2b/purchase-orders/[id]/route.ts:33,47), which
 *                        is COMPANY_ADMIN and COMPANY_APPROVER only
 *                        (lib/b2b-server.ts:5). A buyer may read the queue.
 * - /b2b/company       — no server action exists; it is a read-only record for
 *                        every role, so no role is singled out.
 *
 * THE SERVER REMAINS THE AUTHORITY
 * --------------------------------
 * This is a MIRROR of gates that live in server actions and route handlers.
 * Typing the URL still reaches the page and the page's own gate is what
 * refuses. If the two ever disagree the server is right and this file is the
 * bug — which is why it holds no gate of its own, only a description of gates
 * that exist elsewhere.
 */

/** Full use, read-only, or not shown at all. */
export type B2BNavAccess = "full" | "read" | "hidden";

/** Destinations whose every write action admits COMPANY_ADMIN and nobody else. */
const ADMIN_ONLY = ["/b2b/approval-policies", "/b2b/team", "/b2b/addresses"];

/** Destinations whose actions admit an approver but never a buyer. */
const APPROVER_ONLY = ["/b2b/approvals"];

/**
 * How `role` may use `href`.
 *
 * An unknown or absent role answers "full" for everything, and that is
 * deliberate: this is called from a client component where the session may not
 * have resolved yet, and a sidebar that quietly demotes itself for a
 * legitimate admin during the first paint is a worse failure than one that
 * briefly over-promises. Refusing a legitimate user is the expensive mistake.
 */
export function navAccessForRole(href: string, role: string | undefined): B2BNavAccess {
  if (!role || role === "COMPANY_ADMIN") return "full";
  if (ADMIN_ONLY.includes(href)) return "read";
  if (role !== "COMPANY_APPROVER" && APPROVER_ONLY.includes(href)) return "read";
  return "full";
}
