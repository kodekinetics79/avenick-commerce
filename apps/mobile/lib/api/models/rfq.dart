import 'package:freezed_annotation/freezed_annotation.dart';

import 'converters.dart';
import 'decimal.dart';
import 'enums.dart';
import 'money.dart';

part 'rfq.freezed.dart';
part 'rfq.g.dart';

/// The supplier answering a request, as the RFQ surface names them.
///
/// Narrower than the catalogue's `SellerSummary` on purpose: no id, no city,
/// no rating. This is a name and a badge for a header line, and the RFQ
/// endpoints send nothing more.
@freezed
abstract class RfqSeller with _$RfqSeller {
  const factory RfqSeller({
    required String businessNameEn,
    required SellerTier tier,
  }) = _RfqSeller;

  factory RfqSeller.fromJson(Map<String, dynamic> json) =>
      _$RfqSellerFromJson(json);
}

/// One line of a request, with the supplier's price on it once there is one.
///
/// [productId] is null on a free-text line — a buyer asking for something the
/// catalogue does not list is the ordinary case for an RFQ, not an error — and
/// [nameEn] is then the only description there is.
@freezed
abstract class RfqItem with _$RfqItem {
  const RfqItem._();

  const factory RfqItem({
    required String id,

    /// The catalogue product this line names, or null for a free-text line.
    required String? productId,
    required String nameEn,
    required int quantity,

    /// The supplier's unit price. NULL until they have quoted, and null is not
    /// zero: a line with no price yet must render as awaiting a quote, never
    /// as free.
    @NullableDecimalConverter() required Decimal? unitQuoted,
    required String? notes,
  }) = _RfqItem;

  factory RfqItem.fromJson(Map<String, dynamic> json) =>
      _$RfqItemFromJson(json);

  bool get isQuoted => unitQuoted != null;

  /// True when this line names a row in the catalogue, so the UI can link to
  /// a product page.
  bool get isCatalogueLine => productId != null;

  /// Typed money for display, using the currency the enclosing RFQ stated.
  /// Null while the supplier has not priced this line.
  Money? unitQuotedIn(Currency currency) {
    final Decimal? unit = unitQuoted;
    return unit == null ? null : Money.of(unit, currency);
  }
}

/// A request for quote as the LIST shows it.
@freezed
abstract class RfqCard with _$RfqCard {
  const RfqCard._();

  const factory RfqCard({
    required String id,
    required String rfqNumber,
    required RfqStatus status,
    required Currency currency,
    required int itemCount,

    /// What the supplier has quoted for the whole request, or null before
    /// they have. Null means "not yet quoted", never "nothing to pay".
    @NullableDecimalConverter() required Decimal? totalQuoted,

    /// Bumped every time the supplier revises the quote. It is the value a
    /// decision is made AGAINST — see [RfqDetail].
    required int quoteVersion,

    /// The supplier who picked this request up, or null while none has.
    required RfqSeller? seller,
    @NullableUtcDateTimeConverter() required DateTime? requiredBy,
    @UtcDateTimeConverter() required DateTime createdAt,
    required int messageCount,
  }) = _RfqCard;

  factory RfqCard.fromJson(Map<String, dynamic> json) =>
      _$RfqCardFromJson(json);

  bool get isQuoted => totalQuoted != null;

  Money? get totalQuotedMoney {
    final Decimal? total = totalQuoted;
    return total == null ? null : Money.of(total, currency);
  }

  /// Whether the buyer can accept or reject right now. Both the status and a
  /// quote have to be there: a `QUOTED` row with no total is a supplier who
  /// has responded without pricing, and there is nothing to accept.
  bool get awaitsDecision => status.isDecidable && isQuoted;
}

/// One request for quote, in full.
///
/// ## THERE IS NO `quotes` ARRAY, AND THERE MUST NOT BE ONE
///
/// `RFQRequest.sellerId` is a single nullable supplier and `submitQuote` is its
/// only writer, so a request carries at most ONE supplier's prices. There is no
/// multi-supplier comparison on this surface, the schema forbids the key
/// outright (`additionalProperties: false`, with a test in the contracts
/// package asserting a payload carrying `quotes` is refused), and this model
/// does not model one. A client that added a `List<Quote>` here would be
/// building a comparison screen for data the platform cannot produce — one
/// supplier's price rendered as "the best of the responses", which is a claim
/// about a market that was never surveyed.
///
/// One RFQ, one supplier. A buyer who wants three prices raises three requests.
///
/// ## The version is the safety
///
/// [quoteVersion] is what `POST /v1/rfqs/{id}/decision` compares against, under
/// the RFQ's advisory lock. Send the version the buyer was LOOKING AT, not one
/// re-read at the moment of the tap: that is what makes a supplier's revision
/// land as a `conflict` the buyer is told about, rather than binding them to a
/// price they never saw.
@freezed
abstract class RfqDetail with _$RfqDetail {
  const RfqDetail._();

  const factory RfqDetail({
    required String id,
    required String rfqNumber,
    required RfqStatus status,
    required Currency currency,
    required int itemCount,

    /// The quoted total, or null before the supplier has priced the request.
    @NullableDecimalConverter() required Decimal? totalQuoted,
    required int quoteVersion,
    required RfqSeller? seller,
    @NullableUtcDateTimeConverter() required DateTime? requiredBy,
    @UtcDateTimeConverter() required DateTime createdAt,
    required int messageCount,
    required List<RfqItem> items,
    required String? notes,

    /// When the supplier's price stops standing. Null when they set no expiry.
    @NullableUtcDateTimeConverter() required DateTime? expiresAt,
    @UtcDateTimeConverter() required DateTime updatedAt,
  }) = _RfqDetail;

  factory RfqDetail.fromJson(Map<String, dynamic> json) =>
      _$RfqDetailFromJson(json);

  bool get isQuoted => totalQuoted != null;

  Money? get totalQuotedMoney {
    final Decimal? total = totalQuoted;
    return total == null ? null : Money.of(total, currency);
  }

  /// Whether the buyer can accept or reject right now.
  bool get awaitsDecision => status.isDecidable && isQuoted;

  /// True once the quote has lapsed. A lapsed quote is not a decision the
  /// server will take — show it as expired rather than offering a button that
  /// answers `conflict`.
  bool isExpired(DateTime now) {
    final DateTime? expiry = expiresAt;
    return expiry != null && !now.toUtc().isBefore(expiry);
  }

  /// The lines the supplier has actually priced. A partial quote is a real
  /// state: they can price four of five lines and say so.
  List<RfqItem> get quotedItems =>
      items.where((RfqItem i) => i.isQuoted).toList(growable: false);
}
