import type { RFQStatus } from "@avenick/database";
import type { PillTone } from "@avenick/ui";

/**
 * How an RFQ's stored status is shown to the buyer.
 *
 * This map used to exist twice — once in the quotes list and once in the RFQ
 * detail page — with nine hand-written Tailwind pairs each, including a purple
 * and an orange that carried no meaning beyond "another status". Nine states
 * across two files is exactly how a status silently ends up a different colour
 * in two places.
 *
 * The tone now answers one question: whose move is it?
 *   warning — yours, right now
 *   accent  — the supplier's, and they are engaged
 *   neutral — nobody's; it is parked, spent or not yet sent
 *   success / danger — settled, one way or the other
 *
 * Keyed by the Prisma enum, so a status added to schema.prisma fails the build
 * here rather than rendering as an unstyled raw enum value.
 */
export const RFQ_STATUS: Record<RFQStatus, { label: string; tone: PillTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "neutral" },
  UNDER_REVIEW: { label: "Under review", tone: "accent" },
  QUOTED: { label: "Quote received", tone: "warning" },
  NEGOTIATING: { label: "Negotiating", tone: "accent" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};
