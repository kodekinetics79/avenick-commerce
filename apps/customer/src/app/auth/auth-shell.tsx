import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@avenick/utils";
import { Dateline, Eyebrow, FieldWell, Surface } from "@avenick/ui";
import { platformName } from "@avenick/utils/portal-config";
import { MainLayout } from "@/components/layout/main-layout";

/**
 * The shell every identity screen sits in: sign in, register, forgot password,
 * reset password.
 *
 * Each of those four pages used to carry its own copy of a grid background, two
 * 120px-blurred orbs and a gradient logo tile, and then put the form in a
 * 384px-wide glass box floating in the middle of nothing. Trust does not come
 * from decoration; it comes from the page looking like it was built by someone
 * who knew what they were doing.
 *
 * So: one panel, split by a hairline. The inline-start half is a RECESSED rung-1
 * well because it is context — law A, recessed = context or input — and it says
 * plainly what the account is for. The inline-end half is flat card ground
 * because it is where the work happens. The submit button is the single raised
 * thing on the page. Nothing here is a gradient, a glow or a blur.
 *
 * The split is logical, not physical: the divider is `border-e`, the panes swap
 * sides automatically in Arabic, and every shadow in the system has a zero
 * x-offset, so the light needs no mirroring.
 */

/**
 * What an account actually gets you, stated as fact. Every row names a surface
 * this deployment really ships (/account/orders, /returns, /support). Nothing
 * here promises a delivery window, a response time or a discount, because the
 * platform measures none of those.
 *
 * The labels carry their Arabic alongside, matching the bilingual convention the
 * identity screens already use on their field labels.
 */
const ACCOUNT_SURFACES: ReadonlyArray<{ label: string; body: string }> = [
  {
    label: "Orders / الطلبات",
    body: "Every order you have placed, with the status currently recorded against it.",
  },
  {
    label: "Returns / المرتجعات",
    body: "Request a return on a delivered order, then follow its review.",
  },
  {
    // Deliberately narrow. A SupportTicket row carries a subject, a category, a
    // description and a status and NOTHING ELSE — there is no reply, message or
    // response column in schema.prisma — so promising that answers can be read
    // here would be describing a surface this deployment does not have.
    label: "Support / الدعم",
    body: "Open a support ticket and follow the status recorded against it.",
  },
];

export interface AuthShellProps {
  /** Micro-caps label above the title. */
  eyebrow: string;
  title: string;
  /** One sentence under the title. */
  subtitle?: string;
  /**
   * Provenance for the context pane — a fact the system genuinely enforces,
   * such as how long a reset link stays valid. Never a claim.
   */
  note?: string;
  /** Sits under the form behind a hairline: the "no account?" links. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({ eyebrow, title, subtitle, note, footer, children }: AuthShellProps) {
  return (
    <MainLayout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-block">
        <Surface rung={2} className="w-full max-w-3xl animate-fade-up overflow-hidden">
          <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {/* Context, so it is pressed into the page. It is ordered second on a
                phone: the form is what the visitor came for, and it should not
                be below a fold of explanation. */}
            <FieldWell
              bare
              className="order-2 rounded-none border-t border-hairline p-6 md:order-1 md:border-e md:border-t-0 md:p-8"
            >
              <p className="u-h3 text-ink-1">{platformName()}</p>
              <Eyebrow className="mt-1">Account</Eyebrow>

              <ul className="mt-6">
                {ACCOUNT_SURFACES.map((surface, i) => (
                  <li
                    key={surface.label}
                    className={cn("py-3", i > 0 && "border-t border-hairline")}
                  >
                    <p className="u-ui font-medium text-ink-1">{surface.label}</p>
                    <p className="u-meta mt-0.5 text-ink-2">{surface.body}</p>
                  </li>
                ))}
              </ul>

              {note && <Dateline className="mt-6">{note}</Dateline>}
            </FieldWell>

            <div className="order-1 p-6 md:order-2 md:p-8">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="u-h2 mt-1 text-ink-1">{title}</h1>
              {subtitle && <p className="u-ui mt-2 max-w-desc text-ink-2">{subtitle}</p>}

              <div className="mt-6">{children}</div>

              {footer && (
                <div className="mt-6 border-t border-hairline pt-4">{footer}</div>
              )}
            </div>
          </div>
        </Surface>
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
 * pointer, which is the single most annoying thing a login form can do. Two lines
 * are reserved because the sign-in messages are bilingual and wrap.
 *
 * The container itself carries role="alert", so the message is announced when it
 * appears rather than needing a live region wrapped around a node that does not
 * exist yet.
 */
export function FormErrorSlot({ message }: { message?: string }) {
  return (
    <div role="alert" className="min-h-[2.5rem]">
      {message ? (
        <Surface rung={1} tone="danger" className="flex items-start gap-2 p-2.5">
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
      className="flex items-start gap-2.5 p-4"
    >
      {icon && (
        <span
          className={cn("mt-0.5 shrink-0", tone === "danger" ? "text-danger-ink" : "text-success-ink")}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className={cn("u-ui", tone === "danger" ? "text-danger-ink" : "text-success-ink")}>
        {children}
      </div>
    </Surface>
  );
}
