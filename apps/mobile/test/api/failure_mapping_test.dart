import 'package:avenick/api/avenick_api.dart';
import 'package:avenick/api/models/models.dart';
import 'package:avenick/core/error/failure_mapper.dart';
import 'package:avenick/core/error/failures.dart';
import 'package:avenick/core/network/api_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_transport.dart';

/// Every server `code` maps to exactly one sealed failure, and the mapping is
/// driven by the CODE rather than by the status.
///
/// The distinction matters most at 401/403: `unauthenticated` is recoverable
/// by refreshing or signing in, `forbidden` is not, and bouncing a `forbidden`
/// to the login screen is a loop the user cannot escape. A status-based mapper
/// cannot tell those apart when both arrive as "not allowed".
void main() {
  const config =
      ApiConfig(flavour: ApiFlavour.dev, baseUrl: 'https://example.test');

  AvenickApi apiAnswering(FakeResponse answer) => AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(),
        adapter: FakeAdapter((_) => answer),
      );

  Future<ApiFailure> failureFrom(FakeResponse answer) async {
    final api = apiAnswering(answer);
    try {
      await api.catalogue.categories();
      fail('expected a failure');
    } on ApiFailure catch (failure) {
      return failure;
    } finally {
      await api.dispose();
    }
  }

  group('each server code maps to the right sealed failure', () {
    test('unauthenticated → AuthFailure requiring re-auth', () async {
      final failure = await failureFrom(
        FakeResponse.error(
          401,
          'unauthenticated',
          message: 'Sign in to continue.',
        ),
      );
      expect(failure, isA<AuthFailure>());
      expect((failure as AuthFailure).requiresReauth, isTrue);
      expect(failure.code, ApiErrorCode.unauthenticated);
      expect(failure.requestId, 'req_fake');
    });

    test('forbidden → AuthFailure NOT requiring re-auth', () async {
      final failure = await failureFrom(FakeResponse.error(403, 'forbidden'));
      expect(failure, isA<AuthFailure>());
      // Signing in again lands in exactly the same place. This flag is what
      // stops the app sending them there.
      expect((failure as AuthFailure).requiresReauth, isFalse);
      expect(failure.isRetryable, isFalse);
    });

    test('validation_failed → ValidationFailure with dotted field paths',
        () async {
      final failure = await failureFrom(
        FakeResponse.error(
          400,
          'validation_failed',
          message: 'The request is not valid.',
          fieldErrors: <String, dynamic>{
            'items.2.quantity': <dynamic>[
              'Must be at least 25.',
              'Must be a whole number.',
            ],
            'shippingAddress.country': <dynamic>['Unsupported destination.'],
          },
        ),
      );
      expect(failure, isA<ValidationFailure>());
      final validation = failure as ValidationFailure;
      expect(validation.fieldErrors, hasLength(2));
      expect(validation.messagesFor('items.2.quantity'), hasLength(2));
      expect(
        validation.messagesForIndex('items', 2),
        containsPair('quantity', hasLength(2)),
      );
      expect(validation.messagesFor('nothing.here'), isEmpty);
      expect(validation.firstMessage, isNotNull);
    });

    test('rate_limited → RateLimitFailure carrying Retry-After', () async {
      final failure = await failureFrom(
        FakeResponse.error(
          429,
          'rate_limited',
          headers: const <String, String>{'retry-after': '30'},
        ),
      );
      expect(failure, isA<RateLimitFailure>());
      expect(
        (failure as RateLimitFailure).retryAfter,
        const Duration(seconds: 30),
      );
      expect(failure.isRetryable, isTrue);
    });

    test('rate_limited with no Retry-After does NOT invent a backoff',
        () async {
      final failure =
          await failureFrom(FakeResponse.error(429, 'rate_limited'));
      // A client-invented backoff turns a throttled app into a synchronised
      // thundering herd. Null means "the server did not say".
      expect((failure as RateLimitFailure).retryAfter, isNull);
    });

    test('not_found → ServerFailure carrying the code, not swallowed',
        () async {
      final failure = await failureFrom(FakeResponse.error(404, 'not_found'));
      expect(failure, isA<ServerFailure>());
      final server = failure as ServerFailure;
      expect(server.isNotFound, isTrue);
      expect(server.code, ApiErrorCode.notFound);
      expect(server.statusCode, 404);
      expect(server.isRetryable, isFalse);
    });

    test('conflict → ServerFailure.isConflict', () async {
      final failure = await failureFrom(FakeResponse.error(409, 'conflict'));
      expect((failure as ServerFailure).isConflict, isTrue);
      expect(failure.isRetryable, isFalse);
    });

    test('payment_required → ServerFailure.isPaymentRequired', () async {
      final failure =
          await failureFrom(FakeResponse.error(402, 'payment_required'));
      expect((failure as ServerFailure).isPaymentRequired, isTrue);
    });

    test('upstream_unavailable → ServerFailure, retryable', () async {
      final failure =
          await failureFrom(FakeResponse.error(503, 'upstream_unavailable'));
      expect((failure as ServerFailure).isUpstreamUnavailable, isTrue);
      expect(failure.isRetryable, isTrue);
    });

    test('internal → ServerFailure carrying the requestId for support',
        () async {
      final failure = await failureFrom(
        FakeResponse.error(500, 'internal', requestId: 'req_traceable'),
      );
      expect(failure, isA<ServerFailure>());
      // This is the field that makes a user-visible error findable in a log.
      expect((failure as ServerFailure).requestId, 'req_traceable');
      expect(failure.traceId, 'req_traceable');
      expect(failure.isRetryable, isTrue);
    });

    test('every code in the enum is covered by the table', () {
      // Exhaustiveness, so a code added to the contract cannot quietly fall
      // through to `unexpected`.
      for (final code in ApiErrorCode.values) {
        final failure = FailureMapper.fromApiError(
          ApiError(code: code, message: 'm', requestId: 'r'),
        );
        expect(
          failure,
          isNot(isA<UnexpectedFailure>()),
          reason: 'code ${code.wire}',
        );
        expect(failure.displayMessage, 'm');
      }
    });
  });

  group('transport failures', () {
    ApiFailure mapDio(DioExceptionType type) => FailureMapper.fromDioException(
          DioException(
            requestOptions: RequestOptions(path: '/v1/me'),
            type: type,
          ),
        );

    test('connection errors and timeouts become NetworkFailure', () {
      expect(
        (mapDio(DioExceptionType.connectionError) as NetworkFailure).kind,
        NetworkFailureKind.offline,
      );
      expect(
        (mapDio(DioExceptionType.connectionTimeout) as NetworkFailure).kind,
        NetworkFailureKind.timeout,
      );
      expect(
        (mapDio(DioExceptionType.receiveTimeout) as NetworkFailure).kind,
        NetworkFailureKind.timeout,
      );
      expect(
        (mapDio(DioExceptionType.badCertificate) as NetworkFailure).kind,
        NetworkFailureKind.badCertificate,
      );
      expect(
        (mapDio(DioExceptionType.cancel) as NetworkFailure).kind,
        NetworkFailureKind.cancelled,
      );
      // A network failure has nothing to trace: the request never got an id.
      expect(mapDio(DioExceptionType.connectionError).traceId, isNull);
    });
  });

  group('bodies the contract does not describe', () {
    test('an HTML error page is UnexpectedFailure, not a guessed code',
        () async {
      final api = AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(),
        adapter: FakeAdapter(
          (_) => const FakeResponse(
            404,
            '<html><body>Not Found</body></html>',
            headers: <String, String>{'x-request-id': 'req_edge'},
          ),
        ),
      );
      try {
        await api.catalogue.categories();
        fail('expected a failure');
      } on ApiFailure catch (failure) {
        // A 404 page from a proxy is an infrastructure fault. Reporting it as
        // `not_found` would let it masquerade as a business outcome.
        expect(failure, isA<UnexpectedFailure>());
        expect((failure as UnexpectedFailure).statusCode, 404);
        expect(failure.requestId, 'req_edge');
      } finally {
        await api.dispose();
      }
    });

    test('an unknown error code is not coerced into `internal`', () async {
      final api = AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(),
        adapter: FakeAdapter(
          (_) => const FakeResponse(400, <String, dynamic>{
            'error': <String, dynamic>{
              'code': 'teapot',
              'message': 'no',
              'requestId': 'req_x',
            },
          }),
        ),
      );
      try {
        await api.catalogue.categories();
        fail('expected a failure');
      } on ApiFailure catch (failure) {
        expect(failure, isA<UnexpectedFailure>());
      } finally {
        await api.dispose();
      }
    });

    test('a 200 whose totals do not add up never reaches the caller', () async {
      final api = AvenickApi.build(
        config: config,
        store: InMemoryTokenStore(),
        adapter: FakeAdapter(
          (_) => FakeResponse.data(
            <String, dynamic>{
              'quoteId': 'quo_1',
              'currency': 'AED',
              'channel': 'B2C',
              'vatRatePercent': 5,
              'lines': <dynamic>[
                <String, dynamic>{
                  'productId': 'p',
                  'variantId': null,
                  'sellerId': 's',
                  'sku': 'k',
                  'nameEn': 'n',
                  'nameAr': 'n',
                  'quantity': 1,
                  'unitPrice': 24.68,
                  'vatRatePercent': 5,
                  'vatAmount': 1.23,
                  'lineTotal': 24.68,
                },
              ],
              'shipping': <String, dynamic>{
                'status': 'priced',
                'zoneName': null,
                'amount': 20.00,
                'vatRatePercent': 5,
                'estimatedDaysMin': null,
                'estimatedDaysMax': null,
              },
              'promotions': <dynamic>[],
              // The PR #21 shape: VAT on the goods only.
              'totals': <String, dynamic>{
                'subtotal': 24.68,
                'discountAmount': 2.47,
                'goodsVatAmount': 1.11,
                'shippingAmount': 20.00,
                'shippingVatAmount': 1.00,
                'vatAmount': 1.11,
                'total': 43.32,
              },
              'expiresAt': '2026-09-05T10:15:00.000Z',
            },
            requestId: 'req_bad_totals',
          ),
        ),
      );
      try {
        await api.checkout.quote(
          const CheckoutQuoteRequest(
            items: <QuoteLineInput>[
              QuoteLineInput(productId: 'p', quantity: 1),
            ],
            shippingAddress: ShippingAddressInput(
              label: 'W',
              line1: 'Somewhere',
              city: 'Dubai',
              country: Country.ae,
            ),
            currency: Currency.aed,
          ),
        );
        fail('expected the contract violation to stop this');
      } on ApiFailure catch (failure) {
        expect(failure, isA<UnexpectedFailure>());
        final unexpected = failure as UnexpectedFailure;
        expect(unexpected.cause, isA<ContractViolation>());
        // The request id survives, so the bad response can be found in a log.
        expect(unexpected.requestId, 'req_bad_totals');
      } finally {
        await api.dispose();
      }
    });
  });
}
