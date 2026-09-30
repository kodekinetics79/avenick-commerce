# Invited RFQ Commercial Policy

This policy is the binding Wave 1 contract for private, competitive supplier quotations. It separates the buyer's requirement from each supplier's commercial offer and deliberately limits Wave 1 to one complete winning quotation.

## Visibility and invitation

- RFQs are private by default. Only active suppliers with an explicit invitation may view or quote them.
- Invitations are unique per RFQ and seller and move independently through invited, viewed, quoted, declined, and closed states.
- Suppliers never see competing supplier identities, pricing, notes, revisions, messages, or award rationale.
- Cross-scope lookups return no record-existence disclosure.

## Quote scope

- One quote covers every RFQ line and the full requested quantity exactly once.
- One quote uses the RFQ currency.
- Partial quotes, alternate quantities, split awards, and multi-currency offers are deferred.
- Every quoted line maps to an active catalogue product, and optional variant, owned by the submitting seller.
- A revision is a new immutable version. The prior current version becomes superseded and remains auditable.

## Commercial terms

- Unit prices and freight are entered as VAT-exclusive net amounts.
- The platform calculates line net, line VAT, freight VAT, and grand total using decimal arithmetic.
- Freight is recorded as a VAT-exclusive net amount plus an explicit freight VAT rate. A zero amount means no separate freight charge; Incoterm and pickup classification are deferred from Wave 1.
- The seller provides an exact quote-valid-until timestamp.
- The seller records a delivery commitment separately from the buyer's requested delivery date.
- Payment terms are recorded as a bounded whole-number day term; free text cannot create credit eligibility.
- Messages and notes may explain terms but never modify binding prices, tax, freight, validity, delivery, or payment terms.

The buyer comparison must reconcile:

`item net + freight net + item VAT + freight VAT = grand total`

Any lowest-price label ranks comparable grand totals in the same currency. The product must not invent a composite “best supplier” score.

## Revision and closure

- A seller may revise only its current, unawarded quote before the response deadline.
- Expired, superseded, withdrawn, declined, cancelled, or losing quote versions are never awardable.
- Supplier decline and quote-withdrawal actions are deferred from Wave 1; no inactive controls are exposed for them.
- An awarded quote cannot be revised. Subsequent failure belongs to purchase-order or order cancellation handling.

## Award

- The RFQ requester or a current company administrator may award in Wave 1. Company approvers remain responsible for later purchase-order approval.
- Award selects one exact quote ID, version, and commercial fingerprint.
- Award revalidates company authority, supplier status, invitation, currency, completeness, product ownership, quote status, and validity inside the transaction.
- Award atomically:
  1. marks the selected quote accepted;
  2. closes competing current quotations without disclosing their contents;
  3. marks the RFQ accepted and records the winning quote;
  4. creates exactly one linked `DRAFT` purchase order;
  5. copies the accepted commercial snapshot without catalogue repricing;
  6. writes audit evidence and durable notifications.
- Retrying the same award returns the existing draft PO. Attempting to award another quote after a winner exists returns a conflict.
- Losing suppliers are notified only after the award transaction commits. The winner, winning price, and buyer rationale remain confidential.
- Cancelling or failing a winning PO never silently promotes the next quote. A losing supplier must issue a fresh valid version before a new award.

## Evidence and retention

- The accepted quote and quote-sourced PO are the authoritative commercial evidence.
- Audit records contain identifiers, actors, scope, timestamps, versions, totals, status changes, and fingerprints—not private message bodies or attachments.
- Historical single-supplier RFQs may be retained as legacy, non-orderable evidence where catalogue mappings cannot be proven. The migration must not invent missing revisions or product identity.
