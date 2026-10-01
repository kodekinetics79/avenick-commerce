import type { PageMeta } from "@avenick/contracts/envelope";

import { validationFailed } from "./errors";

/**
 * Cursor pagination, in the shape the contract's `meta` block declares:
 * `{ cursor, hasMore }` and deliberately no `total`.
 *
 * The reason there is no count is in `envelope.ts` in the contracts package:
 * `/api/products` runs an unbounded `count()` beside every page query, against
 * the same pool the checkout transactions queue on. A phone scrolling a list
 * needs "is there more", and `hasMore` answers that from a row this query has
 * already fetched.
 *
 * The cursor is opaque to the client and base64url on the wire — not for
 * secrecy, but so that a key containing a comma, a slash or a non-ASCII
 * character survives a query string unchanged and comes back byte for byte.
 */

export function encodeCursor(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): string {
  // A cursor is echoed back from a previous response, so a malformed one is a
  // client bug or a hand-edited URL — a 400 naming the field, never a 500.
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (decoded.length === 0 || Buffer.from(decoded, "utf8").toString("base64url") !== cursor) {
    throw validationFailed("The cursor is not one this endpoint issued.", {
      cursor: ["Send back the `meta.cursor` value from the previous page, unchanged."],
    });
  }
  return decoded;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

/**
 * Turn an over-fetched row set into a page.
 *
 * The caller asks the database for `limit + 1` rows. The extra row is never
 * returned; its existence IS `hasMore`. That is one row of overhead instead of
 * a second query, and it cannot disagree with the page it describes the way a
 * separately-counted total can.
 */
export function paginate<T>(rows: readonly T[], limit: number, cursorOf: (row: T) => string): Page<T> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`paginate() needs a positive integer limit, received ${String(limit)}`);
  }
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : [...rows];
  const last = data[data.length - 1];
  return {
    data,
    // The cursor points at the last row RETURNED, never at the probe row: the
    // next page must start after what the client has seen, not after a row it
    // was never shown.
    meta: { cursor: hasMore && last !== undefined ? encodeCursor(cursorOf(last)) : null, hasMore },
  };
}
