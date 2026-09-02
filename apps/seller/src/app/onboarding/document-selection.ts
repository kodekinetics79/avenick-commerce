import type { DocumentStatus } from "@avenick/database";

/**
 * The columns the selection needs. Kept structural so the page can pass its
 * Prisma select result and the unit test can pass plain objects; nothing here
 * touches the database or the request.
 */
export interface SelectableDocument {
  type: string;
  status: DocumentStatus;
  expiryDate: Date | null;
  uploadedAt: Date;
}

export interface GoverningDocument<Row extends SelectableDocument> {
  /** The row whose status the checklist reports for this type. */
  governing: Row;
  /**
   * The newest row of the same type filed after the governing row — a renewal
   * the seller submitted while an in-date APPROVED row still holds — whatever
   * its status. It is reported regardless of status on purpose: a renewal the
   * admin refused carries a rejection reason the seller has to act on, and
   * hiding it behind "Approved" would withhold that. Null when nothing newer
   * exists, which is always the case when the governing row is itself the
   * newest (the fallback below).
   */
  renewal: Row | null;
}

/**
 * Whether a row's expiry has not yet passed. The boundary is inclusive on the
 * expired side (`expiryDate <= now` is expired) so it matches
 * effectiveDocumentStatus in ./page.tsx exactly; that function reads this one
 * so the two cannot disagree about the same instant.
 */
export function documentIsInDate(doc: { expiryDate: Date | null }, now: Date): boolean {
  return doc.expiryDate === null || doc.expiryDate.getTime() > now.getTime();
}

/**
 * Pick, per document type, the row that actually governs the seller's standing.
 *
 * Taking the newest row per type is wrong the moment a seller files a renewal:
 * the checklist would flip from "Approved" to "Under review" even though the
 * in-date APPROVED row is still what admin approval reads
 * (recordSellerDocument never overwrites an approved row; reviewDocument
 * retires it only when the renewal is approved). So an APPROVED row that has
 * not expired wins over anything newer; only when no such row exists does the
 * newest row of any status speak for the type. When the winner is an approved
 * row and something newer was filed, the caller gets both so it can show the
 * approval AND the state of the renewal.
 *
 * Input order is irrelevant — rows are sorted here by uploadedAt, newest
 * first, with a stable tie-break on input order. Pure: no I/O, no clock other
 * than the `now` it is handed, so the page and the test evaluate the same rule.
 */
export function selectGoverningDocuments<Row extends SelectableDocument>(
  rows: readonly Row[],
  now: Date = new Date(),
): Map<string, GoverningDocument<Row>> {
  const byType = new Map<string, Row[]>();
  for (const row of rows) {
    const bucket = byType.get(row.type);
    if (bucket) bucket.push(row);
    else byType.set(row.type, [row]);
  }

  const result = new Map<string, GoverningDocument<Row>>();
  for (const [type, bucket] of byType) {
    // Array.prototype.sort is stable, so equal timestamps keep input order.
    const newestFirst = [...bucket].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    const governing =
      newestFirst.find((row) => row.status === "APPROVED" && documentIsInDate(row, now)) ?? newestFirst[0]!;
    // Only a row filed after the governing one can be a renewal of it; anything
    // older is history (supersession closes older open reviews anyway). The
    // list is newest-first, so the first hit is the seller's latest attempt.
    const renewal =
      newestFirst.find((row) => row !== governing && row.uploadedAt.getTime() > governing.uploadedAt.getTime()) ??
      null;
    result.set(type, { governing, renewal });
  }
  return result;
}
