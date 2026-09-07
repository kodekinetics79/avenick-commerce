import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@avenick/utils";
import { Dateline, DisplayPlate, Divider, Eyebrow, Reveal, Surface } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import { MainLayout } from "@/components/layout/main-layout";
import { identityCopy, type IdentityLocale } from "./identity-copy";

/**
 * The shell every identity screen sits in: sign in, register, forgot password,
 * reset password.
 *
 * ROUND ONE'S DIAGNOSIS, AND WHERE IT STOPPED. Before it, each of these four
 * pages carried its own grid background, two 120px-blurred orbs and a gradient
 * logo tile, and then put the form in a 384px glass box floating in the middle
 * of nothing. Round one replaced all of that with one panel split by a hairline.
 * That was correct and it was also the whole problem: a single flat white box on
 * a warm ground, every element within one order of magnitude of every other one.
 * Competent. Not impressive. Signing in is the first thing a Gulf procurement
 * manager ever sees of this platform, and it looked like a form.
 *
 * SIJILL'S ANSWER IS RANGE AND MATERIAL, not decoration.
 *
 *   · TWO OBJECTS AT DIFFERENT DEPTHS, not one box divided. The context half is
 *     a <DisplayPlate> — the generated object: a mirrored conic field in the
 *     product's own three hues, ledger ruling at exactly --lh-body, tiled grain,
 *     the fresnel shoulder, and a real cast shadow at rung 3. It is abstract but
 *     PHYSICAL, and it is honest because it claims nothing. The form half stays
 *     flat card ground at rung 2, because that is where the work happens.
 *     Budget: display plates are one per route and customer-only; each identity
 *     screen is one route, and this is its one plate.
 *
 *   · SIX LEVERS BETWEEN THE MASTHEAD AND THE LEDGER, not two. The register's
 *     name is set at --fs-display (34→52px fluid) in the display family with the
 *     optical-size axis engaged, against 13px ui labels and 12px metadata: size,
 *     weight, tracking, family, colour and space-before all differ. Blur the
 *     page until no word is legible and you can still tell which block is the
 *     masthead, which is a row and which is a route. That is the acceptance
 *     test, and round one's version failed it.
 *
 *   · THE LEDGER IS DENSITY OF TRUE FACT where a template puts an illustration.
 *     Each row names a record the account holds and, underneath it, the LIMIT on
 *     that record. Nothing here promises a delivery window, a response time, a
 *     discount or a reply, because the platform measures and stores none of
 *     those.
 *
 *     It used to print each row's ROUTE — "/account/orders", set in the mono
 *     face in its own column — under the line "Every surface named here exists
 *     on this deployment". That was defended as checkable fact, and it was fact.
 *     It was also addressed to a reviewer auditing the build rather than to the
 *     buyer signing in, who reads a raw URL on a sign-in page as an unfinished
 *     screen. The mono column is gone and the third line of each row now carries
 *     the disclosure instead, which is the part a competitor's login page cannot
 *     copy: saying "the seller records this status, we do not estimate it" costs
 *     something to say. See the note on AccountSurface in identity-copy.ts.
 *
 *   · ONE BRASS GESTURE, not a sixth one invented here. The rule above the
 *     masthead is the same .u-drawn rule as active nav, the selected tab, the
 *     certificate's top edge and the ladder's active band.
 *
 * There is no seal on this page and there must never be one: a visitor has no
 * reviewed SellerDocument behind them, and a brass arc travelling around a mark
 * that cites nothing is a fabricated trust signal rendered in CSS.
 *
 * THE SPLIT IS LOGICAL, NOT PHYSICAL. `order`, `ms/me`, `text-start` and
 * `border-s` only; every shadow in the system has a zero x-offset, so the light
 * needs no mirroring. On a phone the form comes FIRST: it is what the visitor
 * came for, and it must not sit below a fold of explanation.
 *
 * Server Component. It never becomes "use client" — the two client forms are
 * passed in as children.
 */

export interface AuthShellProps {
  /** The reading locale, resolved by the page from the AVENICK_LOCALE cookie. */
  locale: IdentityLocale;
  /** Micro-caps label above the title. Names the task. */
  eyebrow: string;
  /** The task, at h2 rank. The masthead on the plate is the page's largest thing. */
  title: string;
  /** One sentence under the title. */
  subtitle?: string;
  /**
   * Provenance for the context plate — a fact the system genuinely enforces,
   * such as how long a reset link stays valid. Never a claim.
   */
  note?: string;
  /** Sits under the form behind a hairline: the "no account?" links. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({ locale, eyebrow, title, subtitle, note, footer, children }: AuthShellProps) {
  const copy = identityCopy(locale);

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-block lg:py-section">
        {/* align-items: start, not center. The two halves are set to a shared
            top edge like a spread, and the plate stays with the reader on the
            one form long enough to scroll — business registration — instead of
            floating out of view. `self-stretch` is what gives the sticky child
            a track to stick inside; without it the grid item is only as tall as
            the plate and sticky does nothing. */}
        <div className="grid items-start gap-block lg:grid-cols-12 lg:gap-[clamp(24px,4vw,56px)]">
          {/* ── THE FORM. Ordered first on a phone, second on a desktop: the
              visitor came to sign in, not to read about the account. */}
          <Reveal index={1} className="order-1 lg:order-2 lg:col-span-7">
            <Surface rung={2} className="overflow-hidden p-6 sm:p-8">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="u-h2 mt-1.5 text-ink-1">{title}</h1>
              {subtitle && <p className="u-body mt-2 max-w-desc text-ink-2">{subtitle}</p>}

              <div className="mt-7">{children}</div>

              {footer && <div className="mt-7 border-t border-hairline pt-4">{footer}</div>}
            </Surface>
          </Reveal>

          {/* ── THE PLATE. The page's one rung-3 object and its one lit material:
              conic field, ruled ground, grain, fresnel shoulder, cast shadow.
              It carries no body-sized text over a translucent layer — the plate
              is opaque paint, not glass, so every line below has a deterministic
              contrast against a colour that does not move. */}
          <Reveal index={0} className="order-2 lg:order-1 lg:col-span-5 lg:self-stretch">
            <div className="lg:sticky lg:top-24">
              <DisplayPlate className="p-6 sm:p-8">
                {/* The same brass rule as active nav and the certificate's top
                    edge. One gesture in different postures. */}
                <Divider drawn on className="w-14" />

                <Eyebrow className="mt-5">{copy.brand.eyebrow}</Eyebrow>

                {/* THE ENORMOUS THING. --fs-display is the top rung available
                    outside .u-hero, which is reserved for the home page: the hero
                    stage is one per SITE, not one per page. Latin display family
                    in both locales because the operator's name is a Latin string
                    either way; font-size-adjust in the RTL block keeps a Latin run
                    inside an Arabic page from rendering ~15% optically smaller. */}
                <p className="u-display mt-1 font-display text-ink-1">{platformName()}</p>

                <Divider tone="strong" className="mt-5" />

                <p className="u-micro mt-4 text-ink-3">{copy.brand.ledger}</p>

                <ul className="mt-2">
                  {copy.surfaces.map((surface, i) => (
                    <li
                      key={surface.label}
                      className={cn("py-3", i > 0 && "border-t border-hairline")}
                    >
                      <p className="u-ui font-medium text-ink-1">{surface.label}</p>
                      <p className="u-meta mt-1 text-ink-2">{surface.body}</p>
                      {/* The disclosure is the load-bearing line, so it is set at
                          ink-2 rather than the metadata step: ink-3 measures
                          4.62:1 against the plate's lightest conic stop —
                          passing, but with no headroom. Rank is carried by the
                          rule and the indent instead of by a lighter ink. */}
                      <p className="u-meta mt-1.5 border-s border-hairline ps-2.5 text-ink-2">
                        {surface.basis}
                      </p>
                    </li>
                  ))}
                </ul>

                {/* LAW E. `note` is a fact the system enforces (a TTL read from
                    the constant the verifier checks), never a reassurance. With no
                    note, the plate still cites what the list above it is. */}
                <Dateline className="mt-5">{note ?? copy.brand.provenance}</Dateline>
              </DisplayPlate>
            </div>
          </Reveal>
        </div>
      </div>
    </MainLayout>
  );
}

/**
 * A form-level message that cannot be attached to one field — a rejected sign-in,
 * a registration the server refused.
 *
 * Its slot is ALWAYS in the layout, empty or not. An error that arrives after a
 * network round trip therefore never shoves the submit button out from under the
 * pointer, which is the single most annoying thing a login form can do.
 *
 * The container itself carries role="alert", so the message is announced when it
 * appears rather than needing a live region wrapped around a node that does not
 * exist yet.
 *
 * The message is REVEALED, not faded: the danger surface is opaque underneath
 * the whole time and the wash arrives as a colour transition, so no frame of the
 * sentence is ever half-transparent and unreadable. Motion here is a readout of
 * a state that has already changed, never a gate on reading it.
 */
export function FormErrorSlot({ message }: { message?: string }) {
  return (
    <div role="alert" className="min-h-[2.5rem]">
      {message ? (
        <Surface rung={1} tone="danger" className="u-pop flex items-start gap-2 p-2.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-ink" aria-hidden="true" />
          <p className="u-meta text-danger-ink">{message}</p>
        </Surface>
      ) : null}
    </div>
  );
}

/**
 * The outcome panel an identity form becomes once it has succeeded — the reset
 * link was sent, the password was changed. A tone wash on a recessed surface
 * rather than the old `bg-green-50 border-green-200 text-green-800`, which had no
 * dark-mode counterpart at all and rendered as cream on cream.
 *
 * IT ARRIVES RATHER THAN APPEARING. `.u-pop` is the system's one entry gesture:
 * @starting-style, 180ms, --ease-out, scaling from .965 and translating 8px from
 * the TRIGGER's inline start rather than from the viewport centre — a panel that
 * arrives from nowhere is the cheapest cheapness in the product. Zero JS, and it
 * is already wrapped in `prefers-reduced-motion: no-preference` in globals.css,
 * so a motion-sensitive reader gets the panel instantly and completely.
 *
 * Sending a reset link and changing a password are RARE events, which is the one
 * frequency band where the system licenses delight. Nothing on the hot path
 * (typing, tabbing, pressing) gained a single millisecond.
 */
export function AuthNotice({
  tone = "success",
  icon,
  children,
}: {
  tone?: "success" | "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface
      rung={1}
      tone={tone}
      role={tone === "danger" ? "alert" : "status"}
      className="u-pop flex items-start gap-2.5 p-4"
    >
      {icon && (
        <span
          className={cn("mt-0.5 shrink-0", tone === "danger" ? "text-danger-ink" : "text-success-ink")}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className={cn("u-body", tone === "danger" ? "text-danger-ink" : "text-success-ink")}>
        {children}
      </div>
    </Surface>
  );
}
