import 'dart:async';

import 'package:avenick/api/models/enums.dart';
import 'package:avenick/api/models/requests.dart';
import 'package:avenick/api/models/rfq.dart';
import 'package:avenick/core/error/failures.dart';
import 'package:avenick/core/l10n/directional_text.dart';
import 'package:avenick/features/rfq/rfq.dart';
import 'package:avenick/theme/meridian_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:riverpod/misc.dart' show Override;

// ---------------------------------------------------------------------------
// FIXTURES
//
// Shapes taken from `packages/contracts/openapi.json` — `RfqCard` and
// `RfqDetail` — and built through `fromJson` rather than through the
// constructors, so a change to the wire contract fails these tests the way it
// would fail the app.
//
// Every money field is a JSON number in major units with two decimal places,
// which is what the server's `toMoney` actually produces. Note the KWD
// fixtures: the wire carries two places even for a three-decimal currency, and
// `Money` widens exactly. That widening is why a KWD total must never be
// formatted by anything but `Money`.
// ---------------------------------------------------------------------------

Map<String, dynamic> rfqSellerJson({
  String businessNameEn = 'Gulf Steel Trading LLC',
  String tier = 'VERIFIED',
}) =>
    <String, dynamic>{'businessNameEn': businessNameEn, 'tier': tier};

Map<String, dynamic> rfqItemJson({
  String id = 'rfi_1',
  String? productId = 'prd_1',
  String nameEn = 'Galvanised scaffold tube 48.3mm',
  int quantity = 500,
  num? unitQuoted = 24.90,
  String? notes,
}) =>
    <String, dynamic>{
      'id': id,
      'productId': productId,
      'nameEn': nameEn,
      'quantity': quantity,
      'unitQuoted': unitQuoted,
      'notes': notes,
    };

Map<String, dynamic> rfqCardJson({
  String id = 'rfq_1',
  String rfqNumber = 'RFQ-2026-K3P9X441',
  String status = 'QUOTED',
  String currency = 'AED',
  int itemCount = 1,
  num? totalQuoted = 12450.00,
  int quoteVersion = 1,
  Map<String, dynamic>? seller,
  bool noSeller = false,
  String? requiredBy,
  String createdAt = '2026-09-03T07:30:00.000Z',
  int messageCount = 0,
}) =>
    <String, dynamic>{
      'id': id,
      'rfqNumber': rfqNumber,
      'status': status,
      'currency': currency,
      'itemCount': itemCount,
      'totalQuoted': totalQuoted,
      'quoteVersion': quoteVersion,
      // Null until a seller claims the request — `submitQuote` is the only
      // writer of `sellerId`, so this is the normal state of a live RFQ.
      'seller': noSeller ? null : (seller ?? rfqSellerJson()),
      'requiredBy': requiredBy,
      'createdAt': createdAt,
      'messageCount': messageCount,
    };

RfqCard rfqCard({
  String id = 'rfq_1',
  String rfqNumber = 'RFQ-2026-K3P9X441',
  String status = 'QUOTED',
  String currency = 'AED',
  num? totalQuoted = 12450.00,
  Map<String, dynamic>? seller,
  bool noSeller = false,
  int messageCount = 0,
}) =>
    RfqCard.fromJson(
      rfqCardJson(
        id: id,
        rfqNumber: rfqNumber,
        status: status,
        currency: currency,
        totalQuoted: totalQuoted,
        seller: seller,
        noSeller: noSeller,
        messageCount: messageCount,
      ),
    );

/// A request nobody has picked up: no supplier, no price. The normal state of
/// a freshly submitted RFQ, and the one a "waiting" row must render correctly.
RfqCard unclaimedCard({String id = 'rfq_2'}) => RfqCard.fromJson(
      rfqCardJson(
        id: id,
        rfqNumber: 'RFQ-2026-K3P9X442',
        status: 'SUBMITTED',
        totalQuoted: null,
        noSeller: true,
        quoteVersion: 0,
      ),
    );

RfqDetail rfqDetail({
  String id = 'rfq_1',
  String rfqNumber = 'RFQ-2026-K3P9X441',
  String status = 'QUOTED',
  String currency = 'AED',
  num? totalQuoted = 12450.00,
  int quoteVersion = 1,
  Map<String, dynamic>? seller,
  bool noSeller = false,
  List<Map<String, dynamic>>? items,
  String? notes,
  String? requiredBy,
  int messageCount = 0,
}) =>
    RfqDetail.fromJson(<String, dynamic>{
      ...rfqCardJson(
        id: id,
        rfqNumber: rfqNumber,
        status: status,
        currency: currency,
        itemCount: (items ?? <Map<String, dynamic>>[rfqItemJson()]).length,
        totalQuoted: totalQuoted,
        quoteVersion: quoteVersion,
        seller: seller,
        noSeller: noSeller,
        requiredBy: requiredBy,
        messageCount: messageCount,
      ),
      'items': items ?? <dynamic>[rfqItemJson()],
      'notes': notes,
      // NOTHING WRITES THIS COLUMN. Null is its truthful value, and it stays
      // null in every fixture here so that a screen which started rendering an
      // expiry from it would have nothing to render — see
      // rfq_no_invented_expiry_test.dart, which checks the source directly.
      'expiresAt': null,
      'updatedAt': '2026-09-04T08:00:00.000Z',
    });

/// The unclaimed detail: submitted, no supplier, no prices anywhere.
RfqDetail unquotedDetail() => rfqDetail(
      status: 'SUBMITTED',
      totalQuoted: null,
      quoteVersion: 0,
      noSeller: true,
      items: <Map<String, dynamic>>[rfqItemJson(unitQuoted: null)],
    );

/// A quote in KWD — a three-decimal currency, quoted on a two-decimal wire.
RfqDetail kuwaitiDetail() => rfqDetail(
      currency: 'KWD',
      totalQuoted: 1234.50,
      items: <Map<String, dynamic>>[rfqItemJson(unitQuoted: 2.47)],
    );

QuotedProduct quotedProduct({
  String id = 'prd_1',
  String nameEn = 'Galvanised scaffold tube 48.3mm',
  String? sku = 'GST-483',
  int moq = 25,
}) =>
    QuotedProduct(
      id: id,
      slug: 'galvanised-scaffold-tube-48-3mm',
      nameEn: nameEn,
      nameAr: 'أنبوب سقالة مجلفن ٤٨٫٣ مم',
      sku: sku,
      moq: moq,
    );

/// The failure the server answers when `expectedQuoteVersion` no longer
/// matches. `decideRFQ` throws, the route maps it through `conflict()`, and it
/// reaches the app as a [ServerFailure] carrying `ApiErrorCode.conflict`.
ApiFailure staleQuoteConflict() => const ApiFailure.server(
      code: ApiErrorCode.conflict,
      message:
          'Quote changed since it was viewed; review the latest quote before '
          'deciding',
      requestId: 'req_stale_1',
      statusCode: 409,
    );

/// The other `conflict` on this endpoint: a decision on a request that is not
/// in a decidable state at all.
ApiFailure notDecidableConflict() => const ApiFailure.server(
      code: ApiErrorCode.conflict,
      message: 'Only quoted RFQs can be accepted or rejected',
      requestId: 'req_blocked_1',
      statusCode: 409,
    );

/// `POST /v1/rfqs` is `auth: "required"` and `/rfq/new` is not behind the
/// app's auth guard, so this is a normal path, not an exotic one.
ApiFailure unauthenticated() => const ApiFailure.auth(
      code: ApiErrorCode.unauthenticated,
      message: 'Missing or expired credential.',
      requiresReauth: true,
      requestId: 'req_401_1',
    );

// ---------------------------------------------------------------------------
// FAKES
// ---------------------------------------------------------------------------

/// Answers with whatever it was built with, and records what it was asked.
///
/// Every field is mutable so a test can change the server's mind BETWEEN two
/// calls — which is exactly the situation the stale-quote path exists for: the
/// first `decide` conflicts, the following `rfq` read comes back revised, and
/// the second `decide` succeeds.
class FakeRfqRepository implements RfqRepository {
  FakeRfqRepository({
    this.cards = const <RfqCard>[],
    this.detail,
    this.created,
    this.listFailure,
    this.detailFailure,
    this.createFailure,
    this.decideFailure,
    this.decideResult,
    this.pending = false,
    this.decidePending = false,
  });

  List<RfqCard> cards;
  RfqDetail? detail;
  RfqDetail? created;

  Object? listFailure;
  Object? detailFailure;
  Object? createFailure;
  Object? decideFailure;
  RfqDetail? decideResult;

  /// Never completes. How the loading branch is held open for an assertion.
  bool pending;

  /// Holds the DECISION open while the read still answers — the only way to
  /// observe the in-flight state of a screen that must first render a quote.
  bool decidePending;

  int listCalls = 0;
  int detailCalls = 0;
  int createCalls = 0;
  int decideCalls = 0;

  final List<CreateRfqRequest> createdRequests = <CreateRfqRequest>[];
  final List<RfqDecisionRequest> decisions = <RfqDecisionRequest>[];

  @override
  Future<List<RfqCard>> myRfqs() {
    listCalls++;
    if (pending) return Completer<List<RfqCard>>().future;
    if (listFailure != null) return Future<List<RfqCard>>.error(listFailure!);
    return Future<List<RfqCard>>.value(cards);
  }

  @override
  Future<RfqDetail> rfq(String id) {
    detailCalls++;
    if (pending) return Completer<RfqDetail>().future;
    if (detailFailure != null) return Future<RfqDetail>.error(detailFailure!);
    return Future<RfqDetail>.value(detail ?? rfqDetail());
  }

  @override
  Future<RfqDetail> create(CreateRfqRequest request) {
    createCalls++;
    createdRequests.add(request);
    if (pending) return Completer<RfqDetail>().future;
    if (createFailure != null) return Future<RfqDetail>.error(createFailure!);
    return Future<RfqDetail>.value(created ?? detail ?? rfqDetail());
  }

  @override
  Future<RfqDetail> decide(String id, RfqDecisionRequest decision) {
    decideCalls++;
    decisions.add(decision);
    if (decidePending) return Completer<RfqDetail>().future;
    if (decideFailure != null) return Future<RfqDetail>.error(decideFailure!);
    return Future<RfqDetail>.value(
      decideResult ?? detail ?? rfqDetail(status: 'ACCEPTED'),
    );
  }
}

/// The product lookup, in its four states.
class FakeQuotedProductSource implements QuotedProductSource {
  FakeQuotedProductSource({this.product, this.failure, this.pending = false});

  final QuotedProduct? product;
  final Object? failure;
  final bool pending;

  int calls = 0;

  @override
  Future<QuotedProduct?> load(QuoteSubject subject) {
    calls++;
    if (pending) return Completer<QuotedProduct?>().future;
    if (failure != null) return Future<QuotedProduct?>.error(failure!);
    return Future<QuotedProduct?>.value(product);
  }
}

// ---------------------------------------------------------------------------
// PUMP
// ---------------------------------------------------------------------------

List<Override> rfqOverrides({
  RfqRepository? repository,
  QuotedProductSource? productSource,
  Currency? currency = Currency.aed,
}) =>
    <Override>[
      if (repository != null)
        rfqRepositoryProvider.overrideWithValue(repository),
      if (productSource != null)
        quotedProductSourceProvider.overrideWithValue(productSource),
      quoteCurrencyProvider.overrideWithValue(currency),
    ];

/// Puts one quote screen on screen with the real theme, the real localisations
/// and a real `ProviderScope`.
///
/// [textScale] is a first-class parameter because "do the accept and decline
/// buttons survive 200% dynamic type" is a question this feature has to
/// answer, and it cannot be answered by looking at a tree built at 1.0.
Future<void> pumpRfq(
  WidgetTester tester,
  Widget screen, {
  List<Override> overrides = const <Override>[],
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  Size size = const Size(420, 900),
  Brightness brightness = Brightness.light,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        locale: locale,
        supportedLocales: const <Locale>[Locale('en'), Locale('ar')],
        localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: brightness == Brightness.dark
            ? MeridianTheme.dark(viewportWidth: size.width)
            : MeridianTheme.light(viewportWidth: size.width),
        builder: (BuildContext context, Widget? child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScale),
          ),
          child: child ?? const SizedBox.shrink(),
        ),
        home: screen,
      ),
    ),
  );
  // Not `pumpAndSettle`: the skeleton shimmer repeats forever by design and
  // would hang it.
  await tester.pump();
}

/// Finds a machine-readable token the way it is actually rendered.
///
/// The isolate marks are produced by `LtrToken.wrap` rather than written as
/// literal U+2066/U+2069 characters: those are invisible in an editor, so a
/// literal here is a character no reviewer can see in a diff.
Finder findToken(String value, LtrToken kind) => find.text(kind.wrap(value));

/// Finds a money figure the way it is actually rendered.
///
/// [QuoteMoney] wraps every figure in a left-to-right isolate, so
/// `find.text('12,450.00 AED')` matches nothing. Going through here means a
/// missing isolate fails loudly instead of a test quietly asserting the
/// unisolated form.
Finder findMoney(String formatted) => find.text(Bidi.ltr(formatted));

/// Brings [finder] into view, whether it is merely off-screen or not built yet.
Future<void> scrollTo(WidgetTester tester, Finder finder) async {
  final Finder viewport = find.byType(Scrollable).first;
  for (int i = 0; i < 25 && !tester.any(finder); i++) {
    await tester.drag(viewport, const Offset(0, -300));
    await tester.pump();
  }
  if (tester.any(finder)) {
    await tester.ensureVisible(finder.first);
    await tester.pump(const Duration(milliseconds: 400));
  }
}
