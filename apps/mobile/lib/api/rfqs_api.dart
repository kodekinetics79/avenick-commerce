import '../core/network/api_client.dart';
import 'models/requests.dart';
import 'models/rfq.dart';

/// `/v1/rfqs` — the buyer's side of asking a supplier for a price.
///
/// This is the OTHER HALF of the quote-only rule. A product whose
/// `sellableInChannel` is false has no Add to cart; what it has instead is
/// [create], and without this client that button has nowhere to go.
///
/// ## One RFQ, one supplier
///
/// `RFQRequest.sellerId` is a single nullable column and `submitQuote` is its
/// only writer, so a request is answered by at most ONE supplier.
/// [RfqDetail] therefore has no `quotes` array — the schema refuses the key
/// outright and a test in the contracts package asserts it — and this client
/// does not invent one. A buyer who wants three prices raises three requests.
class RfqsApi {
  const RfqsApi(this._client);

  final ApiClient _client;

  static const String rfqsPath = '/v1/rfqs';

  /// `GET /v1/rfqs` — the caller's own RFQs, plus their company's when they
  /// hold an active membership. Newest first.
  ///
  /// UNPAGINATED, and deliberately: the buyer service reads a fixed page of at
  /// most 50 with no cursor, so the response carries `data` and no `meta`.
  /// This returns a plain list rather than a `Page` with an invented
  /// "no more" — a `hasMore: false` this client made up would be a claim the
  /// server never makes, and it would go quietly wrong the day the cap starts
  /// truncating.
  Future<List<RfqCard>> rfqs() => _client.getList<RfqCard>(
        rfqsPath,
        itemDecoder: RfqCard.fromJson,
      );

  /// `GET /v1/rfqs/{id}` — one request and its lines.
  Future<RfqDetail> rfq(String id) => _client.get<RfqDetail>(
        '$rfqsPath/${Uri.encodeComponent(id)}',
        decoder: RfqDetail.fromJson,
      );

  /// `POST /v1/rfqs` — ask for a quote.
  ///
  /// A line naming a catalogue product takes its name from the catalogue; a
  /// free-text line must carry its own. See [RfqLineInput.product] and
  /// [RfqLineInput.freeText] — and [CreateRfqRequest.isWellFormed], which is
  /// the check to make before sending rather than after the 400.
  Future<RfqDetail> create(CreateRfqRequest request) => _client.post<RfqDetail>(
        rfqsPath,
        decoder: RfqDetail.fromJson,
        body: request.toJson(),
      );

  /// `POST /v1/rfqs/{id}/decision` — accept or reject the supplier's quote.
  ///
  /// [RfqDecisionRequest.expectedQuoteVersion] is compared against the stored
  /// version under the RFQ's advisory lock. A `conflict` back from here is the
  /// server correctly refusing to bind the buyer to a price the supplier
  /// revised after the screen was drawn: re-fetch with [rfq], show what
  /// changed, and ask again. Do NOT re-read the version and resend — that
  /// turns the guard into a rubber stamp on whatever the price is now.
  Future<RfqDetail> decide(String id, RfqDecisionRequest decision) =>
      _client.post<RfqDetail>(
        '$rfqsPath/${Uri.encodeComponent(id)}/decision',
        decoder: RfqDetail.fromJson,
        body: decision.toJson(),
      );
}
