import { validationFailed } from "./errors";
import { decodeCursor, encodeCursor } from "./pagination";

/**
 * The composite cursor every v1 list uses.
 *
 * A cursor over a single column is not enough for any ordering this surface
 * offers: `moq` defaults to 1 for most of the catalogue and `nameEn` is not
 * unique, so a cursor holding only the sort value would repeat rows on one page
 * and drop them from another the moment two rows tie. Every ordering therefore
 * ends in `id`, and the cursor carries BOTH halves — which is exactly the
 * tiebreak `listProducts` already appends to its `orderBy` for the same reason.
 *
 * `mode` is carried so a cursor cannot be replayed against a query it was not
 * issued for: the catalogue answers a plain browse by keyset and a relevance
 * search by rank (see `products/product-page.ts`), and a rank cursor fed to the
 * keyset path would silently resume from the wrong place rather than fail.
 */
export type Cursor =
  /** Keyset: resume strictly after (`key`, `id`) in the current ordering. */
  | { mode: "keyset"; key: string; id: string }
  /** Rank: resume at the given position in a precomputed, bounded ranking. */
  | { mode: "rank"; page: number };

const CURSOR_FIELD = {
  cursor: ["Send back the `meta.cursor` value from the previous page, unchanged."],
};

/**
 * The cursor's PLAINTEXT key, before base64url.
 *
 * Exported separately so `paginate()` in pagination.ts can be handed it as its
 * `cursorOf` and do the encoding itself — one encoder, and the page's cursor is
 * built from the last row actually returned rather than recomputed here.
 */
export function keysetCursorKey(key: string, id: string): string {
  return JSON.stringify({ m: "k", k: key, i: id });
}

export function encodeKeysetCursor(key: string, id: string): string {
  return encodeCursor(keysetCursorKey(key, id));
}

export function encodeRankCursor(page: number): string {
  return encodeCursor(JSON.stringify({ m: "r", p: page }));
}

/**
 * Decode a cursor, or refuse it.
 *
 * `decodeCursor` already refuses anything that is not byte-exact base64url. A
 * value that survives that and is still not one of ours — hand-edited JSON, a
 * cursor from another endpoint, a cursor from a different sort — is a 400
 * naming the field, never a 500 and never a silent restart from page one. A
 * silent restart is the worse failure: an infinite-scroll list would loop over
 * its first page forever and look like a catalogue with twenty products in it.
 */
export function parseCursor(cursor: string | undefined, expected: Cursor["mode"]): Cursor | null {
  if (cursor === undefined) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeCursor(cursor));
  } catch (error) {
    // decodeCursor throws the contract's own validation error; only a JSON
    // failure is ours to translate.
    if (error instanceof SyntaxError) {
      throw validationFailed("The cursor is not one this endpoint issued.", CURSOR_FIELD);
    }
    throw error;
  }

  if (typeof decoded !== "object" || decoded === null) {
    throw validationFailed("The cursor is not one this endpoint issued.", CURSOR_FIELD);
  }
  const candidate = decoded as Record<string, unknown>;

  if (expected === "keyset" && candidate.m === "k") {
    if (typeof candidate.k === "string" && typeof candidate.i === "string" && candidate.i.length > 0) {
      return { mode: "keyset", key: candidate.k, id: candidate.i };
    }
  }
  if (expected === "rank" && candidate.m === "r") {
    // Bounded: an unbounded page number is an unbounded OFFSET, which is the
    // deep-scan this surface exists to avoid.
    if (
      typeof candidate.p === "number"
      && Number.isInteger(candidate.p)
      && candidate.p >= 1
      && candidate.p <= 100_000
    ) {
      return { mode: "rank", page: candidate.p };
    }
  }

  throw validationFailed(
    "The cursor was issued for a different query. Start again from the first page.",
    CURSOR_FIELD,
  );
}
