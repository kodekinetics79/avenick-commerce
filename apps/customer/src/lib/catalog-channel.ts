import { NextResponse } from "next/server";
import { getServerB2BContext } from "@/lib/b2b-server";

export type CatalogChannel = "B2C" | "B2B";

export type ChannelResolution =
  | { ok: true; channel: CatalogChannel }
  | { ok: false; response: NextResponse };

/**
 * THE ONE PLACE A REQUEST BECOMES A CHANNEL.
 *
 * `?b2b=true` (or `{"b2b": true}` in a body) is a REQUEST, not an assertion.
 * The channel is a fact about the viewer — whether they hold a live company
 * membership — and the server already knows it. Reading it off the request
 * means the client decides what pricing it may see.
 *
 * That is not hypothetical. `/api/products` and `/api/products/[slug]` checked
 * the session before honouring the flag; the two routes added with the
 * recommendation work did not, and both shipped. On production, anonymously:
 *
 *   GET  /api/products/<slug>/recommendations?b2b=true  → 10 rows of B2B tier prices
 *   POST /api/cart/completions {"b2b": true}            →  8 rows of B2B tier prices
 *
 * Wholesale pricing, with quantity bands, to anyone who could type the flag —
 * on a marketplace where those tiers are the sellers' commercial position.
 *
 * The check was on two of the four doors into the same operation. So it moves
 * here: a route cannot obtain a channel without passing it, because there is
 * nowhere else to obtain one. `catalog-channel-authority.security.test.ts`
 * fails the build if a route that shapes a catalogue DTO stops asking.
 */
export async function resolveCatalogChannel(wantsB2B: boolean): Promise<ChannelResolution> {
  if (!wantsB2B) return { ok: true, channel: "B2C" };

  const ctx = await getServerB2BContext();
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Active company account required for B2B pricing" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { ok: true, channel: "B2B" };
}
