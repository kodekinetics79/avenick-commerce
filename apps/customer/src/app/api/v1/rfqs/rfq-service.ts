import type { z } from "zod";

import type { CreateRfqRequestSchema, RfqDetailSchema } from "@avenick/contracts";
import { PUBLIC_CATALOG_SELLER, createRFQ, db, getRFQForBuyer } from "@avenick/database";

import { V1Error, notFound } from "../_lib/errors";
import type { Principal } from "../_lib/principal";
import { toRfqDetail, type RfqDetailRow } from "./rfq-projection";

type CreateRfqRequest = z.infer<typeof CreateRfqRequestSchema>;
type RfqDetail = z.infer<typeof RfqDetailSchema>;

/**
 * Creating a request for quote, and reading one back.
 *
 * `createRFQ`, `getRFQsForBuyer` and `getRFQForBuyer` are the wired buyer
 * services and they own the writes, the ordering, the message window and — the
 * part that matters most — the visibility predicate. Nothing here re-states
 * "this RFQ is mine or my company's"; the services take the ids and build it,
 * which is why there is exactly one definition of who may read an RFQ.
 */

/**
 * A product an RFQ line may reference.
 *
 * The same visibility rule the catalogue listing applies, minus the channel:
 * an RFQ is precisely how a buyer asks about something they cannot simply add
 * to a basket, so `isB2CEnabled` must NOT gate it — that flag is false on every
 * pilot row and gating here would make "Request a quote" refuse the entire
 * catalogue it exists to serve.
 */
const QUOTABLE_PRODUCT = {
  deletedAt: null,
  status: "ACTIVE",
  isPubliclyDiscoverable: true,
  seller: PUBLIC_CATALOG_SELLER,
} as const;

/**
 * Read one RFQ through the buyer service, or answer nothing.
 *
 * `companyId` WIDENS visibility to the caller's company; it never narrows it.
 * The principal only carries one for an active membership in an active company,
 * which is the same rule `getServerB2BContext` applies on the web.
 */
export async function readRfqDetail(input: {
  rfqId: string;
  principal: Principal;
}): Promise<RfqDetail | null> {
  const rfq = await getRFQForBuyer({
    rfqId: input.rfqId,
    buyerId: input.principal.userId,
    ...(input.principal.companyId ? { companyId: input.principal.companyId } : {}),
  });
  return rfq ? toRfqDetail(rfq as unknown as RfqDetailRow) : null;
}

export async function createRfqForBuyer(input: {
  request: CreateRfqRequest;
  principal: Principal;
}): Promise<RfqDetail> {
  const { request, principal } = input;

  /*
    NAMES FOR CATALOGUE LINES COME FROM THE CATALOGUE.

    `RFQItem.nameEn` is what the supplier reads as the buyer's specification.
    Taking it from the client on a line that also carries a `productId` lets the
    two disagree — a request that says "500 of [cement]" while pointing at a
    different product — and the supplier has no way to tell which one is meant.
    So a `productId` line is named by the catalogue and anything the client sent
    is ignored; a line with no `productId` is genuinely free text and the
    contract already requires it to carry its own name.
  */
  const productIds = [...new Set(request.items.flatMap((line) => (line.productId ? [line.productId] : [])))];
  const products = productIds.length === 0
    ? []
    : await db.product.findMany({
        where: { id: { in: productIds }, ...QUOTABLE_PRODUCT },
        select: { id: true, nameEn: true },
      });
  const nameById = new Map(products.map((product) => [product.id, product.nameEn]));

  const items = request.items.map((line, index) => {
    if (!line.productId) {
      // The contract's cross-field rule guarantees a name here; this narrows it
      // for the compiler rather than re-checking it.
      return { nameEn: line.nameEn!, quantity: line.quantity, notes: line.notes };
    }
    const nameEn = nameById.get(line.productId);
    if (!nameEn) {
      // Same answer the checkout quote gives a line whose product is gone: a
      // product that is not in the quotable catalogue is not found, rather than
      // an RFQ raised against something no supplier can be asked about.
      throw notFound(`The product on line ${index + 1} is not available to quote.`);
    }
    return { productId: line.productId, nameEn, quantity: line.quantity, notes: line.notes };
  });

  const created = await createRFQ({
    buyerId: principal.userId,
    // Attaching the company makes the request visible to colleagues, which is
    // what `getRFQsForBuyer`'s company arm exists for. A consumer with no
    // membership raises a personal RFQ — the service allows one, and the
    // quote-only catalogue means a consumer is the common case, not the rare one.
    ...(principal.companyId ? { companyId: principal.companyId } : {}),
    currency: request.currency,
    notes: request.notes,
    ...(request.requiredBy ? { requiredBy: new Date(request.requiredBy) } : {}),
    items,
  });

  // Re-read rather than project the create's return value: `createRFQ` includes
  // the items but neither the seller nor the message count, and one projection
  // path means the RFQ the app sees now is the RFQ it sees on the next open.
  const detail = await readRfqDetail({ rfqId: created.id, principal });
  if (!detail) {
    // Written a moment ago, under this buyer's id. Not reachable; a fault.
    throw new V1Error("internal", "Something went wrong. Quote the request id.");
  }
  return detail;
}
