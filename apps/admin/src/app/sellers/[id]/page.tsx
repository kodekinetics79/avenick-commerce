"use client";

import { useState, useEffect, useId, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { isRecordId } from "@avenick/utils";
import Link from "next/link";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  Field,
  FieldWell,
  Num,
  PageHeader,
  SkeletonCellGrid,
  SkeletonList,
  StatusPill,
  Surface,
  Textarea,
  TierMark,
  type PillTone,
} from "@avenick/ui";
import { DecisionNotice } from "@/app/approvals/decision-notice";

/**
 * What a document decision came back with when it did not land. A 409 carries
 * the row's real status so the reviewer sees what the queue missed; a 404 or a
 * network failure carries only the message.
 */
type DocumentNotice = { docId: string; message: string; currentStatus?: string };

/** Enum → tone. Four semantic states, which is all an operator distinguishes. */
const STATUS_TONE: Record<string, PillTone> = {
  ACTIVE: "success",
  APPROVED: "success",
  PENDING_REVIEW: "warning",
  EXPIRED: "warning",
  SUSPENDED: "danger",
  REJECTED: "danger",
};

/** One recorded fact, as a cell of the identity band. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [seller, setSeller] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  // "No such record" and "we could not read the record" are different facts, and
  // the old handler rendered both as the first — telling a reviewer the account
  // may have been removed when in truth the request had failed.
  const [loadError, setLoadError] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDocError, setRejectDocError] = useState<string | null>(null);
  const [rejectSellerOpen, setRejectSellerOpen] = useState(false);
  const [sellerRejectReason, setSellerRejectReason] = useState("");
  const [sellerRejectError, setSellerRejectError] = useState<string | null>(null);
  const [sellerDecisionError, setSellerDecisionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [docNotice, setDocNotice] = useState<DocumentNotice | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  // WHICH decision is in flight, not merely that one is. Approve and Confirm
  // rejection both read the same busy flag, so without this both controls spun a
  // spinner at once and neither said which one the reviewer had actually fired.
  const [docAction, setDocAction] = useState<"approve" | "reject" | null>(null);
  const [sellerAction, setSellerAction] = useState<"approve" | "reject" | null>(null);
  const sellerReasonId = useId();
  const docReasonId = useId();

  useEffect(() => {
    // A malformed id is never a seller; skip the request and fall through to
    // the not-found state rather than asking the API to say so.
    if (!isRecordId(id)) { setLoading(false); return; }
    fetch(`/api/admin/sellers/${id}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        // The route answers 404 for a record that is not there and a real error
        // status for everything else, so the two are told apart here rather than
        // both falling through to the not-found state. This adds a response
        // check; it removes none.
        if (response.status === 404) { setSeller(null); setLoading(false); return; }
        if (!response.ok || !body?.success || !body.data) throw new Error("Record unreadable");
        setSeller(body.data as Record<string, unknown>);
        setLoading(false);
      })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, [id]);

  // A document decision is only reloaded into view when the API says it was
  // recorded. A 409 means the page was stale (already decided or replaced by a
  // newer upload) and a 404 means the row is gone; both are shown beside the
  // row instead of reloading into a state that quietly disagrees with the click.
  async function decideDoc(docId: string, path: "approve" | "reject", init: RequestInit): Promise<boolean> {
    setDocBusy(docId);
    setDocAction(path);
    setDocNotice(null);
    try {
      const res = await fetch(`/api/admin/compliance/${docId}/${path}`, { method: "PUT", ...init });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setDocNotice({
          docId,
          message: typeof body?.error === "string" ? body.error : "The decision was not recorded.",
          currentStatus: typeof body?.currentStatus === "string" ? body.currentStatus : undefined,
        });
        return false;
      }
      return true;
    } catch {
      setDocNotice({ docId, message: "The decision was not recorded." });
      return false;
    } finally {
      setDocBusy(null);
      setDocAction(null);
    }
  }

  async function approveDoc(docId: string) {
    if (await decideDoc(docId, "approve", {})) window.location.reload();
  }

  async function rejectDoc(docId: string) {
    const reason = rejectReason.trim();
    // The route requires a reason (min 1) and writes it to the audit log, so an
    // empty one can only ever come back as a 400. Saying so on the field is
    // faster and clearer than a round trip; the server check is unchanged.
    if (!reason) { setRejectDocError("A reason is required — it is written to the audit log."); return; }
    setRejectDocError(null);
    const recorded = await decideDoc(docId, "reject", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (recorded) window.location.reload();
  }

  // Approval is a recorded decision like the rejection below: the API refuses a
  // seller who is no longer pending, and reloading on any response would show a
  // page that quietly disagrees with the click. Read the body, reload only when
  // it says the decision landed.
  async function approveSeller() {
    setSubmitting(true);
    setSellerAction("approve");
    setSellerRejectError(null);
    setSellerDecisionError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/approve`, { method: "PUT" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setSellerDecisionError(typeof body?.error === "string" ? body.error : "Approval was not recorded.");
        setSubmitting(false);
        setSellerAction(null);
        return;
      }
      window.location.reload();
    } catch {
      setSellerDecisionError("Approval was not recorded.");
      setSubmitting(false);
      setSellerAction(null);
    }
  }

  // Seller rejection is a recorded decision: the API requires a reason and
  // writes it to the audit log, so the button only fires once one is given.
  async function rejectSeller() {
    const reason = sellerRejectReason.trim();
    if (!reason) { setSellerRejectError("A reason is required."); return; }
    setSubmitting(true);
    setSellerAction("reject");
    setSellerRejectError(null);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setSellerRejectError(typeof body?.error === "string" ? body.error : "Rejection was not recorded.");
        setSubmitting(false);
        setSellerAction(null);
        return;
      }
      window.location.reload();
    } catch {
      setSellerRejectError("Rejection was not recorded.");
      setSubmitting(false);
      setSellerAction(null);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-block">
          <SkeletonCellGrid count={8} />
          <SkeletonList rows={4} />
        </div>
      </AdminLayout>
    );
  }

  if (loadError) {
    return (
      <AdminLayout>
        <Surface rung={1}>
          <EmptyState
            eyebrow="Not read"
            headline="This supplier record could not be read."
            body="The platform did not answer, so nothing about this account can be shown. Reload to try again."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/sellers">Back to sellers</Link>
              </Button>
            }
          />
        </Surface>
      </AdminLayout>
    );
  }

  if (!seller) {
    return (
      <AdminLayout>
        <Surface rung={1}>
          <EmptyState
            eyebrow="Not found"
            headline="No supplier record matches this reference."
            body="The link may be stale, or the account may have been removed."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/sellers">Back to sellers</Link>
              </Button>
            }
          />
        </Surface>
      </AdminLayout>
    );
  }

  const s = seller as Record<string, unknown>;
  const docs = (s.documents as Record<string, unknown>[]) ?? [];
  // Computed by the API from the seller's own recent activity; null when there
  // is too little data. The stored `accountHealth` column is never recomputed
  // and is deliberately not shown.
  const performance = (s.performance as { score: number; windowDays: number } | null | undefined) ?? null;
  const status = String(s.status);
  const tier = String(s.tier);
  const pendingDocs = docs.filter((doc) => String((doc as Record<string, unknown>).status) === "PENDING_REVIEW").length;

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Supplier record"
          title={String(s.businessNameEn)}
          breadcrumbs={[{ label: "Sellers", href: "/sellers" }, { label: String(s.businessNameEn) }]}
          linkComponent={Link}
          dateline="Every field below is as recorded by the platform · a decision is written against this record's state at the moment of the click"
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone={STATUS_TONE[status] ?? "neutral"} dot>{status.replace(/_/g, " ")}</StatusPill>
              {(tier === "GOLD" || tier === "PLATINUM") && <TierMark tier={tier} />}
            </div>
          }
        />

        {Boolean(s.businessNameAr) && (
          <p className="u-lead -mt-2 text-ink-2" dir="rtl">{String(s.businessNameAr)}</p>
        )}

        {/* One panel divided by hairlines. Eight independently bordered boxes is
            what made a commission rate and a commercial registration number read
            as equally important objects. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Fact label="Account status">
            <StatusPill tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</StatusPill>
          </Fact>
          <Fact label="Tier">
            {tier === "GOLD" || tier === "PLATINUM" ? (
              <TierMark tier={tier} />
            ) : tier === "VERIFIED" ? (
              <StatusPill tone="accent">Verified</StatusPill>
            ) : (
              <p className="u-ui text-ink-1">{tier.replace(/_/g, " ")}</p>
            )}
          </Fact>
          <Fact label="CR number">
            {/* Mono is for identifiers. A commercial registration number is one. */}
            <p className="u-ui u-mono text-ink-1">{String(s.crNumber)}</p>
          </Fact>
          <Fact label="Commission">
            <Num value={Number(s.commissionRate)} unit="%" />
          </Fact>
          <Fact label="Registered in">
            <p className="u-ui text-ink-1">{String(s.country)} — {String(s.city)}</p>
          </Fact>
          <Fact label="Business type">
            <p className="u-ui text-ink-1">{String(s.type).replace(/_/g, " ")}</p>
          </Fact>
          <Fact label="Product rating">
            {/* Averaged by the API over this seller's product reviews; the stored
                SellerProfile.rating column is never recomputed and is not read. */}
            {s.rating ? (
              <>
                <Num value={Number(s.rating).toFixed(1)} />
                <Dateline>{`Averaged over ${Number(s.reviewCount)} product reviews`}</Dateline>
              </>
            ) : (
              <p className="u-ui text-ink-2">No reviews yet</p>
            )}
          </Fact>
          <Fact label="Performance score">
            {performance ? (
              <>
                <Num value={performance.score} unit="/ 100" />
                <Dateline>{`This seller's own activity over the last ${performance.windowDays} days`}</Dateline>
              </>
            ) : (
              <p className="u-ui text-ink-2">Not enough data</p>
            )}
          </Fact>
        </CellGrid>

        {/* Evidence first, decision after it. */}
        <Surface rung={1} className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-3">
            <div>
              <Eyebrow>Evidence</Eyebrow>
              <h2 className="u-h3 text-ink-1">Compliance documents</h2>
            </div>
            {pendingDocs > 0 && <StatusPill tone="warning">{pendingDocs} awaiting a decision</StatusPill>}
          </div>

          <div className="border-t border-hairline">
            {/* An empty card is indistinguishable from a broken one; say that
                nothing was filed so the reviewer does not approve on silence. */}
            {docs.length === 0 && (
              <EmptyState
                eyebrow="Nothing filed"
                headline="This seller has filed no compliance documents."
                body="Any decision on this application would rest on no filed evidence."
              />
            )}
            {docs.map((doc) => {
              const d = doc as Record<string, unknown>;
              const docId = String(d.id);
              const docStatus = String(d.status);
              return (
                <div key={docId} className="space-y-2 border-b border-hairline px-4 py-3 last:border-b-0">
                  {docNotice?.docId === docId && (
                    <DecisionNotice message={docNotice.message} currentStatus={docNotice.currentStatus} />
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="u-ui font-medium text-ink-1">{String(d.type).replace(/_/g, " ")}</p>
                      {/* The stored file reference is a private object key, not a
                          link, and the API does not ship it; the view route mints a
                          short-lived signed URL per request. */}
                      <a
                        href={`/documents/${encodeURIComponent(docId)}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="u-focus u-meta u-mono inline-flex items-center gap-1.5 rounded-nested text-primary-ink hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {String(d.fileName)}
                        <span className="sr-only">, opens in a new tab</span>
                      </a>
                      {Boolean(d.rejectionReason) && (
                        <p className="u-meta mt-1 text-danger-ink">Rejected: {String(d.rejectionReason)}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill tone={STATUS_TONE[docStatus] ?? "neutral"}>{docStatus.replace(/_/g, " ")}</StatusPill>
                      {docStatus === "PENDING_REVIEW" && (
                        <>
                          <Button
                            variant="secondary"
                            size="xs"
                            className="text-success-ink"
                            onClick={() => approveDoc(docId)}
                            loading={docBusy === docId && docAction === "approve"}
                            disabled={docBusy === docId}
                          >
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            Approve<span className="sr-only"> {String(d.type).replace(/_/g, " ")}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="hover:text-danger-ink"
                            disabled={docBusy === docId}
                            onClick={() => { setRejectDocId(docId); setRejectReason(""); setRejectDocError(null); }}
                          >
                            <XCircle className="h-3 w-3" aria-hidden="true" />
                            Reject<span className="sr-only"> {String(d.type).replace(/_/g, " ")}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* The reason form belongs to the document being rejected. It
                      used to open at the bottom of the page, where nothing said
                      WHICH document the reason would be attached to. */}
                  {rejectDocId === docId && (
                    <FieldWell
                      as="form"
                      className="p-3"
                      onSubmit={(event) => { event.preventDefault(); void rejectDoc(docId); }}
                    >
                      <Field
                        label={`Reason for rejecting ${String(d.type).replace(/_/g, " ")}`}
                        htmlFor={`${docReasonId}-${docId}`}
                        error={rejectDocError ?? undefined}
                        hint="Written to the audit log and shown to the seller."
                        required
                      >
                        <Textarea
                          id={`${docReasonId}-${docId}`}
                          autoFocus
                          rows={2}
                          aria-invalid={rejectDocError ? true : undefined}
                          value={rejectReason}
                          onChange={(event) => setRejectReason(event.target.value)}
                          disabled={docBusy === docId}
                          placeholder="What is wrong with this filing"
                        />
                      </Field>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={docBusy === docId}
                          onClick={() => { setRejectDocId(null); setRejectReason(""); setRejectDocError(null); setDocNotice(null); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="danger"
                          size="sm"
                          loading={docBusy === docId && docAction === "reject"}
                          disabled={docBusy === docId}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Confirm rejection
                        </Button>
                      </div>
                    </FieldWell>
                  )}
                </div>
              );
            })}
          </div>
        </Surface>

        {/* The application decision sits BELOW the evidence, not above it. A
            reviewer reaches it having passed the filed documents, which is both
            the right reading order and the reason it is hard to hit by accident. */}
        {status === "PENDING_REVIEW" && (
          <Surface rung={1} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Eyebrow>Decision</Eyebrow>
                <h2 className="u-h3 text-ink-1">Approve or reject this application</h2>
                <p className="u-ui max-w-desc text-ink-2">
                  Approving activates the account and lets this supplier publish listings. Rejecting writes the reason
                  to the audit log and shows it to the applicant. {docs.length === 0 && "No documents have been filed against this application."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={approveSeller}
                  loading={sellerAction === "approve"}
                  disabled={submitting}
                  className="text-success-ink"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Approve seller
                </Button>
                <Button
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => { setRejectSellerOpen(true); setSellerRejectError(null); }}
                  className="hover:text-danger-ink"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                </Button>
              </div>
            </div>

            {sellerDecisionError && <DecisionNotice message={sellerDecisionError} />}

            {rejectSellerOpen && (
              <FieldWell
                as="form"
                className="p-3"
                onSubmit={(event) => { event.preventDefault(); void rejectSeller(); }}
              >
                <Field
                  label="Reason for rejecting this application"
                  htmlFor={sellerReasonId}
                  error={sellerRejectError ?? undefined}
                  hint="Written to the audit log and shown to the applicant."
                  required
                >
                  <Textarea
                    id={sellerReasonId}
                    autoFocus
                    rows={2}
                    aria-invalid={sellerRejectError ? true : undefined}
                    value={sellerRejectReason}
                    onChange={(event) => setSellerRejectReason(event.target.value)}
                    disabled={submitting}
                    placeholder="Why this application cannot be accepted"
                  />
                </Field>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting}
                    onClick={() => { setRejectSellerOpen(false); setSellerRejectReason(""); setSellerRejectError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="danger" size="sm" loading={sellerAction === "reject"} disabled={submitting}>
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Confirm rejection
                  </Button>
                </div>
              </FieldWell>
            )}
          </Surface>
        )}
      </div>
    </AdminLayout>
  );
}
