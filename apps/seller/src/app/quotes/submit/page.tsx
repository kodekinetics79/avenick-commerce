import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { RECORD_ID } from "@avenick/utils";
import { sellerInvitationCanSubmit } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { requireSellerPermission } from "@/lib/auth";
import { QuoteForm } from "./quote-form";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  Num,
  PageHeader,
  StatusPill,
  Surface,
} from "@avenick/ui";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("quoteSubmit.metaTitle") };
}
export const dynamic = "force-dynamic";

type SerializedQuote = {
  id: string;
  revision: number;
  status: string;
  currency: string;
  subtotal: string | number;
  vatAmount: string | number;
  freightAmount: string | number;
  freightVatRate: string | number;
  freightVatAmount: string | number;
  total: string | number;
  validUntil: string;
  leadTimeDays: number;
  paymentTermsDays: number;
  notes: string | null;
  submittedAt: string | null;
  items: Array<{
    rfqItemId: string;
    productId: string;
    variantId: string | null;
    unitPrice: string | number;
    vatRate: string | number;
  }>;
};

type InvitationRow = {
  id: string;
  status: "INVITED" | "VIEWED" | "DECLINED" | "QUOTED" | "CLOSED";
  invitedAt: string;
  rfq: {
    id: string;
    rfqNumber: string;
    status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "QUOTED" | "NEGOTIATING" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";
    currency: string;
    notes: string | null;
    acceptedQuoteId: string | null;
    requiredBy: string | null;
    responseDueAt: string | null;
    awardByAt: string | null;
    expiresAt: string | null;
    company: { nameEn: string } | null;
    items: Array<{ id: string; nameEn: string; quantity: number; notes: string | null; productId: string | null }>;
  };
  quotes: SerializedQuote[];
};

type ProductOption = {
  id: string;
  sku: string;
  nameEn: string;
  variants: Array<{ id: string; sku: string; nameEn: string }>;
};

function canSubmit(invitation: InvitationRow) {
  return sellerInvitationCanSubmit({
    invitationStatus: invitation.status,
    rfqStatus: invitation.rfq.status,
    acceptedQuoteId: invitation.rfq.acceptedQuoteId,
    responseDueAt: invitation.rfq.responseDueAt ? new Date(invitation.rfq.responseDueAt) : null,
    expiresAt: invitation.rfq.expiresAt ? new Date(invitation.rfq.expiresAt) : null,
  });
}

function defaultValidity(invitation: InvitationRow) {
  const preferred = invitation.rfq.awardByAt ?? invitation.rfq.expiresAt;
  const fallback = new Date(Date.now() + 30 * 86_400_000).toISOString();
  return (preferred ?? fallback).slice(0, 10);
}

interface PageProps {
  searchParams: { rfq?: string; submitted?: string };
}

export default async function SubmitQuotePage({ searchParams }: PageProps) {
  const { membership } = await requireSellerPermission("quotes.submit");
  const t = await getTranslations("sellerRelations");

  if (searchParams.rfq) {
    if (!RECORD_ID.test(searchParams.rfq)) notFound();
    let data: { invitation: InvitationRow; products: ProductOption[] };
    try {
      data = await fetchSellerBackend(`/api/seller/rfqs/${encodeURIComponent(searchParams.rfq)}`);
    } catch (error) {
      if (error instanceof Error && /RFQ not found/i.test(error.message)) notFound();
      throw error;
    }
    const { invitation, products } = data;
    const rfq = invitation.rfq;
    const latestQuote = invitation.quotes[0] ?? null;
    const buyerLabel = rfq.company?.nameEn ?? t("common.individualBuyer");
    const requiredBy = rfq.requiredBy ? format(new Date(rfq.requiredBy), "MMM d, yyyy") : null;
    const openForSubmission = canSubmit(invitation);

    return (
      <SellerLayout permissions={membership.permissions}>
        <div className="max-w-5xl space-y-block">
          <PageHeader
            breadcrumbs={[{ label: t("quotes.title"), href: "/quotes" }, { label: rfq.rfqNumber }]}
            linkComponent={Link}
            eyebrow={t("quoteSubmit.eyebrow")}
            title={t("quoteSubmit.title", { rfqNumber: rfq.rfqNumber })}
            dateline={[
              buyerLabel,
              t("quoteSubmit.lineCount", { count: rfq.items.length, n: String(rfq.items.length) }),
              t("quoteSubmit.pricedIn", { currency: rfq.currency }),
              requiredBy ? t("quoteSubmit.neededBy", { date: requiredBy }) : null,
            ].filter(Boolean).join(" · ")}
            actions={<StatusPill tone={latestQuote?.status === "ACCEPTED" ? "success" : openForSubmission ? "warning" : "neutral"}>
              {latestQuote ? t(`quoteStatus.${latestQuote.status}`) : openForSubmission ? t("quoteStatus.SUBMITTED") : t(`rfqStatus.${rfq.status}`)}
            </StatusPill>}
          />

          {searchParams.submitted === "1" && latestQuote && (
            <Surface role="status" rung={2} tone="success" className="flex items-start gap-2 p-4">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
              <div>
                <p className="u-ui font-medium text-ink-1">{t("quoteSubmit.submitted", { revision: latestQuote.revision })}</p>
                <p className="u-meta text-ink-2">{t("quoteSubmit.submittedBody")}</p>
              </div>
            </Surface>
          )}

          {rfq.notes && (
            <FieldWell className="p-4">
              <Eyebrow as="h2" className="mb-1.5">{t("quoteSubmit.whatTheBuyerAsked")}</Eyebrow>
              <p className="u-body u-measure whitespace-pre-wrap text-ink-2">{rfq.notes}</p>
            </FieldWell>
          )}

          {latestQuote && (
            <Surface rung={2} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Eyebrow>{t("quoteSubmit.latestRevision", { revision: latestQuote.revision })}</Eyebrow>
                  <Num value={Number(latestQuote.total).toFixed(2)} currency={latestQuote.currency} rank="section" />
                  <Dateline>{t("quoteSubmit.serverCalculated")}</Dateline>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-end">
                  <div><dt className="u-micro text-ink-3">{t("quoteSubmit.subtotal")}</dt><dd className="u-ui text-ink-1">{latestQuote.currency} {Number(latestQuote.subtotal).toFixed(2)}</dd></div>
                  <div><dt className="u-micro text-ink-3">{t("quoteSubmit.vat")}</dt><dd className="u-ui text-ink-1">{latestQuote.currency} {Number(latestQuote.vatAmount).toFixed(2)}</dd></div>
                  <div><dt className="u-micro text-ink-3">{t("quoteSubmit.freight")}</dt><dd className="u-ui text-ink-1">{latestQuote.currency} {Number(latestQuote.freightAmount).toFixed(2)}</dd></div>
                  <div><dt className="u-micro text-ink-3">{t("quoteSubmit.validUntil")}</dt><dd className="u-ui text-ink-1">{format(new Date(latestQuote.validUntil), "MMM d, yyyy")}</dd></div>
                </dl>
              </div>
              {openForSubmission && <p className="u-meta mt-3 text-ink-2">{t("quoteSubmit.revisionNotice", { next: latestQuote.revision + 1 })}</p>}
            </Surface>
          )}

          {!openForSubmission ? (
            <Surface rung={1} className="p-4">
              <p className="u-ui font-medium text-ink-1">{t("quoteSubmit.closedTitle")}</p>
              <p className="u-meta mt-1 text-ink-2">{t("quoteSubmit.closedBody")}</p>
            </Surface>
          ) : products.length === 0 ? (
            <EmptyState eyebrow={t("quoteSubmit.noProducts.eyebrow")} headline={t("quoteSubmit.noProducts.headline")} body={t("quoteSubmit.noProducts.body")} action={<Button variant="secondary" size="sm" asChild><Link href="/products/new">{t("quoteSubmit.noProducts.action")}</Link></Button>} />
          ) : (
            <QuoteForm
              rfqId={rfq.id}
              currency={rfq.currency}
              items={rfq.items.map((item) => ({ id: item.id, nameEn: item.nameEn, quantity: item.quantity, notes: item.notes }))}
              products={products}
              latestQuote={latestQuote}
              defaultValidUntil={defaultValidity(invitation)}
            />
          )}
        </div>
      </SellerLayout>
    );
  }

  const data = await fetchSellerBackend<{ inbox: InvitationRow[] }>("/api/seller/rfqs");
  const openInbox = data.inbox.filter(canSubmit);
  return (
    <SellerLayout permissions={membership.permissions}>
      <div className="max-w-3xl space-y-block">
        <PageHeader
          breadcrumbs={[{ label: t("quotes.title"), href: "/quotes" }, { label: t("quoteSubmit.newQuote") }]}
          linkComponent={Link}
          eyebrow={t("quoteSubmit.eyebrow")}
          title={t("quoteSubmit.chooseTitle")}
          dateline={t("quoteSubmit.chooseDateline")}
        />
        {openInbox.length === 0 ? (
          <Surface rung={1}><EmptyState eyebrow={t("quoteSubmit.empty.eyebrow")} headline={t("quoteSubmit.empty.headline")} body={t("quoteSubmit.empty.body")} action={<Button variant="secondary" size="sm" asChild><Link href="/messages">{t("quotes.empty.action")}</Link></Button>} /></Surface>
        ) : (
          <Surface rung={1} className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              {openInbox.map((invitation) => {
                const latest = invitation.quotes[0];
                const rfq = invitation.rfq;
                return (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="u-mono u-micro text-ink-3">{rfq.rfqNumber}</p>
                      <p className="u-ui font-medium text-ink-1">{rfq.company?.nameEn ?? t("common.individualBuyer")}</p>
                      <p className="u-meta truncate text-ink-2">{rfq.items.slice(0, 3).map((item) => `${item.quantity}× ${item.nameEn}`).join(", ")}</p>
                      {rfq.responseDueAt && <p className="u-meta mt-0.5 inline-flex items-center gap-1 text-ink-3"><Clock className="h-3 w-3" aria-hidden="true" /> {t("quoteSubmit.respondBy", { date: format(new Date(rfq.responseDueAt), "MMM d, yyyy") })}</p>}
                    </div>
                    <Button variant="secondary" size="sm" asChild><Link href={`/quotes/submit?rfq=${encodeURIComponent(rfq.id)}`}>{latest ? t("quoteSubmit.revise", { revision: latest.revision + 1 }) : t("inbox.row.quoteThisRfq")}</Link></Button>
                  </li>
                );
              })}
            </ul>
          </Surface>
        )}
      </div>
    </SellerLayout>
  );
}
