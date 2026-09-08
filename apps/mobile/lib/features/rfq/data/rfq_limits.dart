/// THE BOUNDS THE CONTRACT STATES, IN ONE PLACE.
///
/// Each of these is a number the server will enforce whether or not this app
/// knows it. Written down here so the form can refuse a request before the
/// round trip, and so the list screen can say *why* it stops at fifty using
/// the same constant the cap is checked against — a screen that names a
/// different number than the query used is telling the buyer their whole
/// record is on screen when it is not.
library;

/// How many requests `GET /v1/rfqs` returns. Ever.
///
/// `getRFQsForBuyer` reads a fixed `take: 50` with NO cursor support, and
/// `packages/contracts/src/rfqs.ts` states the same bound (`RFQ_LIST_MAX`)
/// rather than promising a page the service cannot produce. This is why
/// `RfqListScreen` has no infinite scroll and says so at the boundary: a
/// buyer with more than fifty requests genuinely cannot reach the rest, and
/// pretending otherwise would re-read the same fifty rows forever.
const int kRfqListMax = 50;

/// The most units one line may ask for — `RfqLineInputSchema.quantity.max`.
const int kRfqLineQuantityMax = 1000000;

/// The longest a free-text line's description may be — `nameEn` is 2..300.
const int kRfqLineNameMax = 300;

/// The shortest one the server will accept.
const int kRfqLineNameMin = 2;

/// The longest the request-level note may be —
/// `CreateRfqRequestFieldsSchema.notes`.
const int kRfqNotesMax = 2000;
