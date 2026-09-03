import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Ban, Clock, LogOut, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button, Eyebrow, FieldWell, Surface } from "@avenick/ui";
import { db } from "@avenick/database";
import { platformContacts, platformName } from "@avenick/utils/portal-config";
import { getSellerAccountState } from "@/lib/auth";
import { signOut } from "@/lib/auth-instance";
import { sellerLandingRoute } from "@/lib/seller-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellerRelations");
  return { title: t("pending.metaTitle") };
}

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
  const t = await getTranslations("sellerRelations");

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
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          {/* The brand mark is a material, not a fill: the seller portal's single
              primary fill belongs to whatever the page's action is, and this page
              has no action beyond signing out. */}
          <Surface as="span" rung={2} className="mb-3 inline-grid h-12 w-12 place-items-center rounded-lg text-lead font-medium text-ink-1">
            {brand.charAt(0).toUpperCase()}
          </Surface>
          <h1 className="u-h2 text-ink-1">{t("pending.sellerCentral")}</h1>
          <p className="u-ui mt-1 text-ink-2">
            {t.rich("pending.signedInAs", {
              email: user.email,
              strong: (chunks) => <span className="font-medium text-ink-1">{chunks}</span>,
            })}
          </p>
        </div>

        <Surface rung={2} className="space-y-4 p-6">
          {!seller ? (
            <StatusBlock icon={AlertTriangle} tone="warning" title={t("pending.noOrg.title")}>
              <p>
                {t("pending.noOrg.body")}
                {support ? (
                  <>
                    {" "}
                    {t.rich("pending.noOrg.askOwnerWithSupport", {
                      support,
                      link: (chunks) => (
                        <a href={`mailto:${support}`} className="u-focus rounded-nested font-medium text-primary-ink underline">{chunks}</a>
                      ),
                    })}
                  </>
                ) : (
                  ` ${t("pending.noOrg.askOwner")}`
                )}
              </p>
            </StatusBlock>
          ) : seller.status === "PENDING_REVIEW" ? (
            <StatusBlock icon={Clock} tone="info" title={t("pending.underReview.title")}>
              <p>
                {t.rich("pending.underReview.body", {
                  date: fmtDate(seller.createdAt),
                  name: seller.businessNameEn,
                  strong: (chunks) => <span className="font-medium text-ink-1">{chunks}</span>,
                })}
              </p>
              {canOpenDocuments ? (
                <Link
                  href="/documents"
                  className="u-focus u-ui inline-flex items-center gap-1.5 rounded-nested font-medium text-primary-ink hover:underline"
                >
                  {t("pending.underReview.uploadCta")}
                  {/* A direction-implying icon must flip in Arabic. */}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                </Link>
              ) : (
                <p>{t("pending.underReview.uploadedByOwner")}</p>
              )}
            </StatusBlock>
          ) : seller.status === "REJECTED" ? (
            <StatusBlock icon={XCircle} tone="danger" title={t("pending.rejected.title")}>
              <p>
                {t.rich("pending.rejected.body", {
                  name: seller.businessNameEn,
                  strong: (chunks) => <span className="font-medium text-ink-1">{chunks}</span>,
                })}
              </p>
              {rejectionReason && (
                // Recessed: the reviewer's words are context quoted into the page,
                // and a well is what this system uses to say so.
                <FieldWell as="blockquote" className="u-ui px-4 py-3 text-ink-1">
                  <Eyebrow className="mb-1">{t("pending.rejected.reasonEyebrow")}</Eyebrow>
                  {rejectionReason}
                </FieldWell>
              )}
              <p>
                {support ? (
                  t.rich("pending.rejected.contactSupportAt", {
                    support,
                    link: (chunks) => (
                      <a href={`mailto:${support}`} className="u-focus rounded-nested font-medium text-primary-ink underline">{chunks}</a>
                    ),
                  })
                ) : (
                  t("pending.rejected.contactSupport")
                )}
              </p>
            </StatusBlock>
          ) : (
            <StatusBlock icon={Ban} tone="danger" title={t("pending.suspended.title")}>
              <p>
                {t.rich("pending.suspended.body", {
                  name: seller.businessNameEn,
                  strong: (chunks) => <span className="font-medium text-ink-1">{chunks}</span>,
                })}
                {support ? (
                  <>
                    {" "}
                    {t.rich("pending.suspended.contactSupportAt", {
                      support,
                      link: (chunks) => (
                        <a href={`mailto:${support}`} className="u-focus rounded-nested font-medium text-primary-ink underline">{chunks}</a>
                      ),
                    })}
                  </>
                ) : (
                  ` ${t("pending.suspended.contactSupport")}`
                )}
              </p>
            </StatusBlock>
          )}

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="border-t border-hairline pt-3"
          >
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" aria-hidden="true" /> {t("pending.signOut")}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}

// Soft wash plus its own ink, both of which have real dark values. The previous
// `bg-primary/10 text-primary` triple used the FILL hue as text, which measures
// about 4.0:1 at this size on a light ground.
const TONE_CLASS = {
  info: "bg-primary-soft text-primary-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
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
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-nested ${TONE_CLASS[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      {/* ink-2, not ink-3: ink-3 is for labels and metadata, and these are
          sentences the seller has to be able to read. */}
      <div className="u-ui space-y-3 text-ink-2">
        <h2 className="u-h3 text-ink-1">{title}</h2>
        {children}
      </div>
    </div>
  );
}
