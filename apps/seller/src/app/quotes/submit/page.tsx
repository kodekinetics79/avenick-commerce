import Link from "next/link";
import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { QuoteForm } from "./quote-form";
import { format } from "date-fns";
import { requireSellerPermission } from "@/lib/auth";
import { notFound } from "next/navigation";
import { RECORD_ID } from "@avenick/utils";
import {
  Button,
  EmptyState,
  Eyebrow,
  FieldWell,
  PageHeader,
  StatusPill,
  Surface,
} from "@avenick/ui";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("quoteSubmit.metaTitle") };
}
export const dynamic = "force-dynamic";

// The RFQ enum values this page knows a label for. The KEYS are the Prisma
// enum and are never translated; the labels live under sellerRelations.rfqStatus.
const KNOWN_RFQ_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

interface PageProps {
  searchParams: { rfq?: string };
}

export default async function SubmitQuotePage({ searchParams }: PageProps) {
  const { membership } = await requireSellerPermission("quotes.submit");
  const t = await getTranslations("sellerRelations");
  type RFQRow = {
    id: string;
    rfqNumber: string;
    status: string;
    currency: string;
    notes: string | null;
    requiredBy: string | null;
    company: { nameEn: string } | null;
    items: Array<{ id: string; nameEn: string; quantity: number; notes: string | null }>;
  };
  let rfq: RFQRow | null = null;
  let inbox: RFQRow[] = [];
  if (searchParams.rfq) {
    // This id arrives from the query string, so it is attacker-supplied via a
    // crafted link — and fetchSellerBackend forwards the caller's cookies. An
    // unencoded value containing "../" resolves against the backend origin and
    // reaches a different authenticated route than the one intended. Validate
    // the id shape first, then encode: the guard stops traversal reaching the
    // URL builder at all, and the encoding is the fix if the shape ever widens.
    if (!RECORD_ID.test(searchParams.rfq)) notFound();
    const data = await fetchSellerBackend<{ rfq: RFQRow }>(
      `/api/seller/rfqs/${encodeURIComponent(searchParams.rfq)}`,
    );
    rfq = data.rfq;
  } else {
    const data = await fetchSellerBackend<{ inbox: RFQRow[] }>("/api/seller/rfqs");
    inbox = data.inbox;
  }
  const openInbox = inbox.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status));

  if (rfq) {
    const lineCount = rfq.items.length;
    const buyerLabel = rfq.company?.nameEn ?? t("common.individualBuyer");
    const requiredBy = rfq.requiredBy ? format(new Date(rfq.requiredBy), "MMM d, yyyy") : null;

    return (
      <SellerLayout permissions={membership.permissions}>
        <div className="max-w-3xl space-y-block">
          <PageHeader
            breadcrumbs={[{ label: t("quotes.title"), href: "/quotes" }, { label: rfq.rfqNumber }]}
            linkComponent={Link}
            eyebrow={t("quoteSubmit.eyebrow")}
            title={t("quoteSubmit.title", { rfqNumber: rfq.rfqNumber })}
            // What the seller is quoting, over what deadline, in whose currency.
            dateline={[
              buyerLabel,
              t("quoteSubmit.lineCount", { count: lineCount, n: String(lineCount) }),
              t("quoteSubmit.pricedIn", { currency: rfq.currency }),
              requiredBy ? t("quoteSubmit.neededBy", { date: requiredBy }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <StatusPill tone="neutral">
                {(KNOWN_RFQ_STATUSES as readonly string[]).includes(rfq.status)
                  ? t(`rfqStatus.${rfq.status}`)
                  : rfq.status.replace(/_/g, " ")}
              </StatusPill>
            }
          />

          {/* What the buyer wrote is context for the pricing below, so it is
              recessed rather than presented as another panel competing with it. */}
          {rfq.notes && (
            <FieldWell className="p-4">
              <Eyebrow as="h2" className="mb-1.5">{t("quoteSubmit.whatTheBuyerAsked")}</Eyebrow>
              <p className="u-body u-measure whitespace-pre-wrap text-ink-2">{rfq.notes}</p>
            </FieldWell>
          )}

          <QuoteForm
            rfqId={rfq.id}
            currency={rfq.currency}
            items={rfq.items.map((i) => ({ id: i.id, nameEn: i.nameEn, quantity: i.quantity, notes: i.notes }))}
          />
        </div>
      </SellerLayout>
    );
  }

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
          <Surface rung={1}>
            <EmptyState
              eyebrow={t("quoteSubmit.empty.eyebrow")}
              headline={t("quoteSubmit.empty.headline")}
              body={t("quoteSubmit.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/messages">{t("quotes.empty.action")}</Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <Surface rung={1} className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              {openInbox.map((r) => {
                const requiredBy = r.requiredBy ? format(new Date(r.requiredBy), "MMM d, yyyy") : null;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="u-mono u-micro text-ink-3">{r.rfqNumber}</p>
                      <p className="u-ui font-medium text-ink-1">{r.company?.nameEn ?? t("common.individualBuyer")}</p>
                      <p className="u-meta truncate text-ink-2">
                        {r.items.slice(0, 3).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                        {r.items.length > 3 ? ` ${t("quoteSubmit.moreItems", { n: String(r.items.length - 3) })}` : ""}
                      </p>
                      {requiredBy && (
                        <p className="u-meta mt-0.5 inline-flex items-center gap-1 text-ink-3">
                          <Clock className="h-3 w-3" aria-hidden="true" /> {t("quoteSubmit.neededBy", { date: requiredBy })}
                        </p>
                      )}
                    </div>
                    {/* The id comes from the backend, not the URL, but the same
                        encode discipline as the loader above keeps this link
                        builder safe if the id scheme ever widens. */}
                    <Button variant="secondary" size="sm" asChild className="shrink-0">
                      <Link href={`/quotes/submit?rfq=${encodeURIComponent(r.id)}`}>{t("inbox.row.quoteThisRfq")}</Link>
                    </Button>
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
