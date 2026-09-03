"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@avenick/utils";
import { LogOut } from "lucide-react";
import { Button, Divider, Eyebrow, Layer, ThemeToggle } from "@avenick/ui";
import { LocaleToggle } from "./locale-toggle";

/**
 * The mobile navigation.
 *
 * It used to be a <details> dropdown hanging off the top-right corner: a 64px
 * wide panel of 36px rows, anchored at the far end of the screen — the single
 * hardest place on a phone for a thumb to reach — with no focus trap, no
 * Escape, and no scroll lock behind it.
 *
 * It is now the shared <Layer> docked to the BOTTOM edge, which is what makes
 * it one-handed: the sheet opens into the thumb zone, every row is 48px, and
 * the one commit action sits in the pinned footer, closest of all to the thumb.
 * It is the same object as the seller's bulk-edit sheet and the admin's
 * approval modal, which is a large part of why the three portals read as one
 * product.
 *
 * The hrefs come from header.tsx — the registered navigation source CI checks
 * every destination against — so this file carries none of its own.
 */
export interface MobileNavItem {
  href: string;
  label: string;
  icon?: React.ElementType;
}

export interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Accessible name for the sheet's dismiss control, in the active locale. */
  closeLabel: string;
  navLabel: string;
  accountLabel: string;
  items: MobileNavItem[];
  accountItems: MobileNavItem[];
  /*
   * The session control. Without it the sheet was the only chrome a phone has
   * and it offered no way to sign in and NO WAY TO SIGN OUT AT ALL — that
   * control existed only in the desktop account menu, which is hidden below lg.
   * Sign-out is a real <button> because it is an action, not a destination, so
   * it cannot be one of the link rows above.
   */
  signIn: MobileNavItem;
  signOut?: { label: string; onSelect: () => void } | null;
  /** Identity line shown above the session control when there is a session. */
  signedInAs?: string | null;
  action: { href: string; label: string; icon?: React.ElementType };
  isActive: (href: string) => boolean;
}

/** One row shape for the sheet, so a link row and the sign-out button cannot
 *  drift apart in height, focus ring or hit area. */
const ROW =
  "u-body relative flex min-h-12 w-full items-center gap-3 rounded-nested ps-4 pe-3 text-start outline-none transition-colors duration-hover ease-standard";

export function MobileNav({
  open,
  onOpenChange,
  title,
  closeLabel,
  navLabel,
  accountLabel,
  items,
  accountItems,
  signIn,
  signOut,
  signedInAs,
  action,
  isActive,
}: MobileNavProps) {
  const pathname = usePathname();
  const ActionIcon = action.icon;

  // A tap on a row navigates client-side, which leaves the sheet mounted over
  // the page it just took you to. The route is the signal that it is done.
  //
  // The first run is skipped deliberately: the effect fires once on mount, and
  // an unconditional close there would slam the sheet shut on any caller that
  // mounts this component already open.
  const seenRoute = React.useRef(pathname);
  React.useEffect(() => {
    if (seenRoute.current === pathname) return;
    seenRoute.current = pathname;
    onOpenChange(false);
    // onOpenChange is a setState wrapper from the header and is stable enough;
    // the dependency that matters is the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Layer
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      size="full"
      title={title}
      closeLabel={closeLabel}
      footer={
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href={action.href}>
            {ActionIcon && <ActionIcon className="h-4 w-4" aria-hidden="true" />}
            {action.label}
          </Link>
        </Button>
      }
    >
      <nav aria-label={navLabel} className="space-y-0.5">
        {items.map((item) => (
          <MobileRow key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      <Divider className="my-4" />

      <Eyebrow as="h3" className="mb-2 px-3">
        {accountLabel}
      </Eyebrow>
      <nav aria-label={accountLabel} className="space-y-0.5">
        {accountItems.map((item) => (
          <MobileRow key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      {signedInAs && (
        <p className="u-meta mt-2 truncate px-4 text-ink-3">{signedInAs}</p>
      )}
      <div className="mt-0.5">
        {signOut ? (
          <button
            type="button"
            onClick={signOut.onSelect}
            data-rung={0}
            data-focus-lift=""
            className={cn(ROW, "text-ink-2 hover:bg-ink-1/[0.05] hover:text-ink-1")}
          >
            <LogOut aria-hidden="true" className="h-[1.15rem] w-[1.15rem] shrink-0 text-ink-3" />
            <span className="truncate">{signOut.label}</span>
          </button>
        ) : (
          <MobileRow item={signIn} active={isActive(signIn.href)} />
        )}
      </div>

      <Divider className="my-4" />

      <div className="flex items-center gap-2">
        <LocaleToggle size="lg" className="flex-1" />
        <ThemeToggle />
      </div>
    </Layer>
  );
}

function MobileRow({ item, active }: { item: MobileNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : "false"}
      // Raised current position — the same mark as <NavItem>, at touch density.
      data-rung={active ? 3 : 0}
      data-focus-lift=""
      className={cn(
        ROW,
        active ? "font-medium text-ink-1" : "text-ink-2 hover:bg-ink-1/[0.05] hover:text-ink-1",
      )}
    >
      <span
        aria-hidden="true"
        className="u-drawn absolute inset-y-0 start-0 my-auto"
        data-orientation="vertical"
        data-on={active ? "true" : "false"}
        style={{ height: "55%" }}
      />
      {Icon && <Icon className="h-[1.15rem] w-[1.15rem] shrink-0 text-ink-3" aria-hidden="true" />}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
