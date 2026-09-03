import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Ban, Clock, LogOut, XCircle } from "lucide-react";
import { db } from "@avenick/database";
import { platformContacts, platformName } from "@avenick/utils/portal-config";
import { getSellerAccountState } from "@/lib/auth";
import { signOut } from "@/lib/auth-instance";
import { sellerLandingRoute } from "@/lib/seller-home";

export const metadata: Metadata = { title: "Account status" };

// Everything here is read from the acting seller's own rows; never prerender.
export const dynamic = "force-dynamic";

/**
 * The reviewer's stated reason, if the latest rejection recorded one.
 *
 * rejectSeller (packages/database/src/services/admin.ts) writes the reason
 * into the audit row's `after` JSON and nowhere else, so this is the only
 * place the seller can be told why. Anything but a non-empty string there
 * means no reason was given, and the page says nothing rather than guessing.
 */
async function latestRejectionReason(sellerId: string): Promise<string | null> {
  const row = await db.auditLog.findFirst({
    where: { entityType: "SellerProfile", entityId: sellerId, action: "REJECT" },
    orderBy: { createdAt: "desc" },
    select: { after: true },
  });
  const after = row?.after;
  if (!after || typeof after !== "object" || Array.isArray(after)) return null;
  const reason = (after as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Where a signed-in seller lands when their organisation is not ACTIVE.
 *
 * This page must not use requireSellerSession: that helper is what sends a
 * non-ACTIVE seller here, so calling it would loop. getSellerAccountState
 * applies the same login-level checks and leaves the status verdict to us.
 */
export default async function PendingPage() {
  const state = await getSellerAccountState();
  if (!state) redirect("/login");

  const { user, seller, membership } = state;
  // An ACTIVE seller has a workspace; the landing route honours staff
  // permissions the same way the root page does (owners → /dashboard).
  if (seller?.status === "ACTIVE") redirect(sellerLandingRoute(membership?.permissions ?? []));

  const rejectionReason = seller?.status === "REJECTED" ? await latestRejectionReason(seller.id) : null;
  // /documents admits a seller under review, but for staff it still demands
  // the documents capability; a link that lands on a permission error would
  // be a dead end dressed up as a next step.
  const permissions = membership?.permissions ?? [];
  const canOpenDocuments =
    permissions.includes("*") || permissions.includes("documents.view") || permissions.includes("documents.manage");
  const support = platformContacts().support;
  const brand = platformName();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-600 text-white font-black text-lg mb-3">
            {brand.charAt(0).toUpperCase()}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Seller Central</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          {!seller ? (
            <StatusBlock icon={AlertTriangle} tone="warning" title="Your account is not attached to a seller organisation.">
              <p>
                This login has a seller role but no seller profile behind it, so there is nothing to show here.
                {support ? (
                  <>
                    {" "}
                    If you were invited to a store, ask its owner to add you; otherwise contact support at{" "}
                    <a href={`mailto:${support}`} className="text-primary hover:underline">{support}</a>.
                  </>
                ) : (
                  " If you were invited to a store, ask its owner to add you; otherwise contact support."
                )}
              </p>
            </StatusBlock>
          ) : seller.status === "PENDING_REVIEW" ? (
            <StatusBlock icon={Clock} tone="info" title="Your application is being reviewed.">
              <p>
                <span className="font-medium text-foreground">{seller.businessNameEn}</span> applied on{" "}
                {fmtDate(seller.createdAt)}. You will not receive an email — sign in to check status.
              </p>
              {canOpenDocuments ? (
                <Link
                  href="/documents"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Upload your registration documents to speed up review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <p>Registration documents are uploaded by the store owner or staff with the documents permission.</p>
              )}
            </StatusBlock>
          ) : seller.status === "REJECTED" ? (
            <StatusBlock icon={XCircle} tone="danger" title="Your seller application was not approved.">
              <p>
                The application for <span className="font-medium text-foreground">{seller.businessNameEn}</span> was
                reviewed and declined.
              </p>
              {rejectionReason && (
                <blockquote className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Reason given by the reviewer
                  </p>
                  {rejectionReason}
                </blockquote>
              )}
              <p>
                If you believe this is an error, contact support
                {support ? (
                  <>
                    {" "}at <a href={`mailto:${support}`} className="text-primary hover:underline">{support}</a>
                  </>
                ) : null}
                .
              </p>
            </StatusBlock>
          ) : (
            <StatusBlock icon={Ban} tone="danger" title="Your seller account is suspended.">
              <p>
                <span className="font-medium text-foreground">{seller.businessNameEn}</span> cannot use Seller Central
                while the suspension is in place.
                {support ? (
                  <>
                    {" "}
                    To discuss it, contact support at{" "}
                    <a href={`mailto:${support}`} className="text-primary hover:underline">{support}</a>.
                  </>
                ) : (
                  " To discuss it, contact support."
                )}
              </p>
            </StatusBlock>
          )}

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="pt-2 border-t border-border"
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const TONE_CLASS = {
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
} as const;

function StatusBlock({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASS;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE_CLASS[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  );
}
