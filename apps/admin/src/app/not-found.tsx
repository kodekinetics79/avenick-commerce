import Link from "next/link";
import { Compass, LayoutDashboard, Search } from "lucide-react";
import { Button, EmptyState } from "@avenick/ui";

/**
 * The Certificate plate, not a 404 poster. Round one set the numeral at 48px in
 * a clip-text gradient — `.text-gradient` is banned by name, it is unselectable
 * in some engines and invisible under forced-colors, and "404" is the least
 * useful thing that could occupy the largest type on the screen.
 *
 * What an operator needs here is the two routes back into the console, and
 * saying which one finds an arbitrary screen fastest.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <EmptyState
          variant="certificate"
          glyph={<Compass />}
          eyebrow="No such screen"
          headline="The console has no page at this address."
          // NOT "every screen is reachable from the sidebar": detail routes and
          // the document register are not in it, so the claim is falsifiable by
          // the first operator who checks. The sidebar lists the SECTIONS, which
          // is both true and the useful thing to say here.
          body="It may have been renamed, or the link may have been written by hand. The sidebar lists every section of the console, and the jump-to-page palette on ⌘K / Ctrl K searches those sections by name."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" /> Command center
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/audit">
                  <Search className="h-3.5 w-3.5" aria-hidden="true" /> Audit trail
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
