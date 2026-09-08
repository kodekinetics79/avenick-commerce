import '../../../api/models/requests.dart';
import '../../../api/models/rfq.dart';
import '../../../api/rfqs_api.dart';

/// THE PORT THIS FEATURE REACHES THE NETWORK THROUGH.
///
/// A narrow interface rather than [RfqsApi] itself, for the reason the commerce
/// feature states in `commerce_gateways.dart`: the real client takes an
/// `ApiClient`, which takes a real `SecureTokenStore` and a real socket, so a
/// widget test that wanted to render a quote would have to stand up the whole
/// networking stack to do it. An interface here means a test overrides one
/// provider with a few lines of fake, and the screens under test are the real
/// ones.
///
/// The four methods are the four endpoints, and there are no others. In
/// particular there is no "list quotes for this RFQ": `RFQRequest.sellerId` is
/// a single nullable supplier and `submitQuote` is its only writer, so a
/// request is answered by at most ONE supplier and there is no comparison to
/// fetch. See [RfqDetail]'s own doc, and the report.
abstract interface class RfqRepository {
  /// `GET /v1/rfqs` — the caller's own requests, plus their company's when
  /// they hold an active membership. Newest first.
  ///
  /// RETURNS AT MOST `kRfqListMax` AND TAKES NO CURSOR. That is not an
  /// omission to be filled in later: the buyer service reads a fixed page and
  /// the response carries no `meta`, so a `cursor` parameter here would be an
  /// invitation to build an infinite scroll on top of a fixed page.
  Future<List<RfqCard>> myRfqs();

  /// `GET /v1/rfqs/{id}` — one request and its lines.
  Future<RfqDetail> rfq(String id);

  /// `POST /v1/rfqs` — ask for a quote. Answers with the created request.
  Future<RfqDetail> create(CreateRfqRequest request);

  /// `POST /v1/rfqs/{id}/decision` — accept or decline.
  ///
  /// Throws a `ServerFailure` carrying `ApiErrorCode.conflict` when
  /// `expectedQuoteVersion` does not match what the server holds under the
  /// RFQ's advisory lock. **That is not a generic error and must not be
  /// rendered as one** — a buyer who is shown "something went wrong" and taps
  /// again is a buyer being asked to accept a price they have not read. See
  /// `RfqDecisionController`.
  Future<RfqDetail> decide(String id, RfqDecisionRequest decision);
}

/// Thrown when a screen reaches for the repository the app never wired.
///
/// Loud, and it names the provider. The alternative — a default returning an
/// empty list — renders a plausible "no quote requests yet" to a buyer who has
/// twelve, which is indistinguishable from the real thing and gets shipped.
class RfqNotWired implements Exception {
  const RfqNotWired(this.providerName);

  final String providerName;

  @override
  String toString() =>
      '$providerName was never overridden. Wire it in the composition root — '
      'see the header of lib/features/rfq/rfq.dart.';
}

/// [RfqRepository] backed by the real client.
class ApiRfqRepository implements RfqRepository {
  const ApiRfqRepository(this._api);

  final RfqsApi _api;

  @override
  Future<List<RfqCard>> myRfqs() => _api.rfqs();

  @override
  Future<RfqDetail> rfq(String id) => _api.rfq(id);

  @override
  Future<RfqDetail> create(CreateRfqRequest request) => _api.create(request);

  @override
  Future<RfqDetail> decide(String id, RfqDecisionRequest decision) =>
      _api.decide(id, decision);
}
