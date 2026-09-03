import type { RFQStatus } from "@avenick/database";
import type { PillTone } from "@avenick/ui";
import type { B2BKey } from "./messages";

/**
 * How an RFQ's stored status is shown to the buyer.
 *
 * This map used to exist twice — once in the quotes list and once in the RFQ
 * detail page — with nine hand-written Tailwind pairs each, including a purple
 * and an orange that carried no meaning beyond "another status". Nine states
 * across two files is exactly how a status silently ends up a different colour
 * in two places.
 *
 * The tone answers one question: whose move is it?
 *   warning — yours, right now
 *   accent  — the supplier's, and they are engaged
 *   neutral — nobody's; it is parked, spent or not yet sent
 *   success / danger — settled, one way or the other
 *
 * The label is a message KEY, not a string: the buyer suite is bilingual, and a
 * status map holding nine English words is how an Arabic page ends up with an
 * English column.
 *
 * Keyed by the Prisma enum, so a status added to schema.prisma fails the build
 * here rather than rendering as an unstyled raw enum value.
 */
export const RFQ_STATUS: Record<RFQStatus, { labelKey: B2BKey; tone: PillTone }> = {
  DRAFT: { labelKey: "status.rfq.DRAFT", tone: "neutral" },
  SUBMITTED: { labelKey: "status.rfq.SUBMITTED", tone: "neutral" },
  UNDER_REVIEW: { labelKey: "status.rfq.UNDER_REVIEW", tone: "accent" },
  QUOTED: { labelKey: "status.rfq.QUOTED", tone: "warning" },
  NEGOTIATING: { labelKey: "status.rfq.NEGOTIATING", tone: "accent" },
  ACCEPTED: { labelKey: "status.rfq.ACCEPTED", tone: "success" },
  REJECTED: { labelKey: "status.rfq.REJECTED", tone: "danger" },
  EXPIRED: { labelKey: "status.rfq.EXPIRED", tone: "neutral" },
  CANCELLED: { labelKey: "status.rfq.CANCELLED", tone: "neutral" },
};
