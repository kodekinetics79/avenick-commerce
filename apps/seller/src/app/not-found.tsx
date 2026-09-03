import Link from "next/link";
import { Button, Divider, EmptyState, Eyebrow } from "@avenick/ui";
import { Compass } from "lucide-react";

/**
 * The 404.
 *
 * What was here: `text-5xl font-extrabold tracking-tighter text-gradient` on the
 * digits "404". Every part of that is something round one deliberately removed —
 * `.text-gradient` is an indigo→violet clip-text headline (the most-copied move
 * on the internet, unselectable in some engines and invisible under
 * forced-colors), `font-extrabold` is a weight this system does not have, and a
 * gradient tile with `shadow-glow` was the button beneath it.
 *
 * A not-found page is an empty state — the most literal one in the product — so
 * it gets the certificate: a brass hairline, ruled ground, a cropped mark
 * bleeding off the outer corner, the fact stated plainly, and exactly one real
 * thing to do. No status code shouted at 48px: the code is metadata, and the
 * reader already knows the page is not there.
 */
export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <Divider drawn on className="w-12" />
      <Eyebrow className="mt-4">Seller Central · 404</Eyebrow>

      <EmptyState
        className="mt-4"
        variant="certificate"
        glyph={<Compass />}
        eyebrow="Not found"
        headline="There is no page at this address in Seller Central."
        body="It may have moved, or the link that brought you here may be out of date. Nothing on your account has changed."
        action={
          <Button variant="primary" size="sm" asChild>
            <Link href="/dashboard">Back to your dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
