"use client";

import { useState, useEffect, useId } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import Link from "next/link";
import { CheckCircle2, XCircle, FileText, AlertTriangle, Store } from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
  Button,
  CommitRow,
  EmptyState,
  Eyebrow,
  Field,
  FieldWell,
  PageHeader,
  SkeletonList,
  Surface,
  Textarea,
  useCommitState,
} from "@avenick/ui";
import { DecisionNotice } from "@/app/approvals/decision-notice";
import { documentTypeLabel, sellerTypeLabel, statusLabel } from "@/app/approvals/status-labels";

interface SellerDoc { id: string; type: string; fileName: string; status: string }
interface PendingSeller {
  id: string; businessNameEn: string; businessNameAr?: string; crNumber: string;
  type: string; country: string; city: string; createdAt: string;
  user: { firstName: string; lastName: string; email: string };
  documents: SellerDoc[];
}

type Notice = { sellerId: string; message: string; currentStatus?: string };

/** A filed document's own state, in the three tones an operator distinguishes. */
const DOC_INK: Record<string, string> = {
  APPROVED: "text-success-ink",
  REJECTED: "text-danger-ink",
  PENDING_REVIEW: "text-warning-ink",
  EXPIRED: "text-warning-ink",
};

/** One recorded fact about the applicant, as a real definition pair. */
function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd className={`u-meta text-ink-1${mono ? " u-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export default function PendingSellersPage() {
  const t = useTranslations("adminReview");
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [loading, setLoading] = useState(true);
  // An empty queue and a queue that could not be read are different facts. The
  // old handler collapsed both into [], so a 403, a 500 or a dropped connection
  // rendered as "no supplier application is waiting on an administrator" — the
  // most consequential thing this console could say untruthfully.
  const [loadError, setLoadError] = useState(false);
  // A decision that did not land must not vanish from the queue as if it had.
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sellers?status=PENDING_REVIEW")
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        // The route answers { success, data } and uses a real status code for
        // every refusal, so both are checked before anything is rendered as a
        // queue. This adds a response check; it removes none.
        if (!response.ok || !body?.success || !Array.isArray(body.data)) throw new Error("Queue unreadable");
        setSellers(body.data as PendingSeller[]);
        setLoading(false);
      })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  /**
   * Record a decision and only then drop the card. The API refuses an
   * application another admin already decided (409, carrying the real status)
   * and a row that is gone (404); removing the card on either would tell the
   * reviewer their click was honoured when nothing was written.
   *
   * The card now leaves on the row-commit exit rather than at the instant the
   * response arrives. That is presentation only — the write has already landed
   * either way — and it answers the one real question in a queue of forty:
   * which application did I just decide.
   */
  async function decide(id: string, path: "approve" | "reject", init: RequestInit): Promise<boolean> {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/${path}`, { method: "PUT", ...init });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setNotice({
          sellerId: id,
          // The route's own wording when it sent one — it names the row's real
          // state — and only otherwise the console's generic refusal.
          message: typeof body?.error === "string" ? body.error : t("notice.notRecorded"),
          currentStatus: typeof body?.currentStatus === "string" ? body.currentStatus : undefined,
        });
        return false;
      }
      return true;
    } catch {
      setNotice({ sellerId: id, message: t("notice.notRecorded") });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminLayout pendingCount={sellers.length}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("pendingSellers.eyebrow")}
          title={t("pendingSellers.title")}
          description={
            loading
              ? t("pendingSellers.descriptionLoading")
              : loadError
                ? t("pendingSellers.descriptionUnread")
                : t("pendingSellers.description", {
                    count: sellers.length,
                    total: sellers.length.toLocaleString("en-US"),
                  })
          }
          // LAW E, and the reason the refusal notice below is not a surprise:
          // this list is a snapshot, and the write is checked against the row.
          // The route takes 100, which is stated rather than left to be assumed.
          dateline={t("pendingSellers.dateline")}
        />

        {loading ? (
          <SkeletonList rows={3} />
        ) : loadError ? (
          <Surface rung={1}>
            <EmptyState
              variant="certificate"
              glyph={<AlertTriangle />}
              eyebrow={t("pendingSellers.unread.eyebrow")}
              headline={t("pendingSellers.unread.headline")}
              body={t("pendingSellers.unread.body")}
              action={
                <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                  {t("pendingSellers.unread.action")}
                </Button>
              }
            />
          </Surface>
        ) : sellers.length === 0 ? (
          <Surface rung={1}>
            <EmptyState
              variant="certificate"
              glyph={<Store />}
              eyebrow={t("pendingSellers.empty.eyebrow")}
              headline={t("pendingSellers.empty.headline")}
              body={t("pendingSellers.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/sellers">{t("pendingSellers.empty.action")}</Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <Surface rung={1} className="overflow-hidden">
            {sellers.map((seller) => (
              <ApplicationRow
                key={seller.id}
                seller={seller}
                busy={busy === seller.id}
                notice={notice?.sellerId === seller.id ? notice : null}
                onApprove={() => decide(seller.id, "approve", {})}
                onReject={(reason) =>
                  decide(seller.id, "reject", {
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason }),
                  })
                }
                onDropped={() => setSellers((list) => list.filter((x) => x.id !== seller.id))}
              />
            ))}
          </Surface>
        )}
      </div>
    </AdminLayout>
  );
}

interface RowProps {
  seller: PendingSeller;
  busy: boolean;
  notice: Notice | null;
  onApprove: () => Promise<boolean>;
  onReject: (reason: string) => Promise<boolean>;
  onDropped: () => void;
}

/**
 * One application, with everything the decision rests on in one place: who
 * applied, what they registered, and what evidence they filed. The two controls
 * are deliberately different weights rather than two identical coloured blocks —
 * in a queue worked at speed, weight is what stops the wrong one being hit.
 */
function ApplicationRow({ seller, busy, notice, onApprove, onReject, onDropped }: RowProps) {
  const t = useTranslations("adminReview");
  const commit = useCommitState({ onExit: onDropped });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger" | "warning">("success");
  // Which decision is in flight, not merely THAT one is. The queue's busy flag
  // is per-application, so with only that the Approve button spun a spinner
  // while the reviewer was confirming a rejection — two controls both claiming
  // to be the one doing the work.
  const [inFlight, setInFlight] = useState<"approve" | "reject" | null>(null);
  const reasonId = useId();

  /**
   * A refusal is shown as a committed WARNING rather than as a failure in
   * danger: nothing was written, and painting a refused approval in the reject
   * colour would say the opposite of what happened. The row keeps the mark so it
   * stays findable in a long queue, and it does not exit.
   */
  function markRefused() {
    setTone("warning");
    commit.commit({ exit: false });
  }

  async function approve() {
    setTone("success");
    setInFlight("approve");
    commit.begin();
    const recorded = await onApprove();
    setInFlight(null);
    if (recorded) commit.commit();
    else markRefused();
  }

  async function reject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      // The applicant is told this reason, so an empty one is worse than no
      // rejection at all. The guard is the server's too; this only says so here.
      setReasonError(t("pendingSellers.reasonRequired"));
      return;
    }
    setReasonError(null);
    setTone("danger");
    setInFlight("reject");
    commit.begin();
    const recorded = await onReject(trimmed);
    setInFlight(null);
    if (recorded) {
      setRejecting(false);
      setReason("");
      commit.commit();
    } else {
      markRefused();
    }
  }

  return (
    <CommitRow
      as="article"
      state={commit.state}
      tone={tone}
      onTransitionEnd={commit.onTransitionEnd}
      aria-label={seller.businessNameEn}
      // border-b-hairline, not border-hairline: .u-commit reserves a 3px
      // transparent border-inline-start for the commit rule, and an all-sides
      // border-colour utility would paint it hairline on every row at rest.
      className="space-y-3 border-b border-b-hairline px-4 py-4 last:border-b-0"
    >
      {/* When a decision does not land this is the most important thing on the
          page, so it is the first thing in the row rather than a footnote. */}
      {notice && (
        <DecisionNotice message={notice.message} currentStatus={notice.currentStatus} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="u-h3 text-ink-1">{seller.businessNameEn}</h2>
          {seller.businessNameAr && (
            <p className="u-body text-ink-2" dir="rtl">{seller.businessNameAr}</p>
          )}
          {/* A definition list, because these are recorded facts with names —
              the old middot-separated run of spans said none of that. */}
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            <Fact label={t("pendingSellers.facts.cr")} value={seller.crNumber} mono />
            <Fact label={t("pendingSellers.facts.type")} value={sellerTypeLabel(t, seller.type)} />
            <Fact
              label={t("pendingSellers.facts.registeredIn")}
              value={t("pendingSellers.facts.location", { country: seller.country, city: seller.city })}
            />
            <Fact
              label={t("pendingSellers.facts.owner")}
              value={t("pendingSellers.facts.ownerName", {
                firstName: seller.user.firstName,
                lastName: seller.user.lastName,
              })}
            />
            <Fact label={t("pendingSellers.facts.contact")} value={seller.user.email} />
            <Fact label={t("pendingSellers.facts.applied")} value={format(new Date(seller.createdAt), "MMM d, yyyy")} />
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={approve}
            loading={inFlight === "approve"}
            disabled={busy}
            className="text-success-ink"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("pendingSellers.approve")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setRejecting(true)}
            className="hover:text-danger-ink"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t("pendingSellers.reject")}
          </Button>
        </div>
      </div>

      {/* The evidence. Recessed, because law A reads "recessed = context". */}
      <FieldWell className="p-3">
        <Eyebrow className="mb-2">{t("pendingSellers.evidence")}</Eyebrow>
        {seller.documents.length === 0 ? (
          // Silence here would read as "nothing to check"; the reviewer
          // must see that approval would rest on no filed evidence.
          <p className="u-ui text-warning-ink">{t("pendingSellers.noDocuments")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {seller.documents.map((doc) => (
              <li key={doc.id}>
                {/* The stored file reference is a private object key, not a
                    link; the view route mints a short-lived signed URL per request. */}
                <Button variant="secondary" size="sm" asChild>
                  <a
                    href={`/documents/${encodeURIComponent(doc.id)}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={doc.fileName}
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{documentTypeLabel(t, doc.type)}</span>
                    <span className={`u-meta ${DOC_INK[doc.status] ?? "text-ink-3"}`}>
                      {statusLabel(t, doc.status)}
                    </span>
                    <span className="sr-only">{t("pendingSellers.documentSr", { fileName: doc.fileName })}</span>
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </FieldWell>

      {rejecting && (
        <FieldWell as="form" className="p-3" onSubmit={(event) => { event.preventDefault(); void reject(); }}>
          <Field
            label={t("pendingSellers.rejectLabel")}
            htmlFor={reasonId}
            error={reasonError ?? undefined}
            hint={t("pendingSellers.rejectHint")}
            required
          >
            <Textarea
              id={reasonId}
              autoFocus
              rows={2}
              aria-invalid={reasonError ? true : undefined}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              placeholder={t("pendingSellers.rejectPlaceholder")}
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => { setRejecting(false); setReason(""); setReasonError(null); }}
            >
              {t("pendingSellers.cancel")}
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={inFlight === "reject"} disabled={busy}>
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t("pendingSellers.confirmReject")}
            </Button>
          </div>
        </FieldWell>
      )}
    </CommitRow>
  );
}
