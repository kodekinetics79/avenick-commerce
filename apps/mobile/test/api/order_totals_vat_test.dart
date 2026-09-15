import 'package:avenick/api/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart' as f;

/// The PR #21 regression, held down at the parse boundary.
///
/// PR #21 fixed a defect where VAT was charged on the goods and not on the
/// delivery: the total was `net goods + goodsVat + shipping`, freight added
/// AFTER tax. Every figure on the order agreed with every other, the buyer was
/// undercharged, and the understated `vatAmount` was persisted for invoicing
/// and settlement to read.
///
/// A client that models VAT as one number cannot tell that payload from a
/// correct one. These tests exist so that this client can, and so that a
/// future "simplification" of `OrderTotals` down to a single `vatAmount` field
/// fails here instead of on an invoice.
void main() {
  group('OrderTotals keeps the two VAT components separate', () {
    test('a correct payload parses and both identities hold exactly', () {
      final totals = OrderTotals.fromJson(f.orderTotals());

      expect(totals.goodsVatAmount, Decimal.parse('1.11'));
      expect(totals.shippingVatAmount, Decimal.parse('1.00'));
      expect(totals.vatAmount, Decimal.parse('2.11'));

      expect(totals.vatComponentsAgree, isTrue);
      expect(totals.totalAgrees, isTrue);
      expect(totals.isConsistent, isTrue);
    });

    test('a COLLAPSED VAT payload is REJECTED, not displayed', () {
      // `vatAmount` carries only the goods VAT and the total omits the VAT on
      // freight. This is the exact shape of the PR #21 defect.
      expect(
        () => OrderTotals.fromJson(f.orderTotalsWithCollapsedVat()),
        throwsA(
          isA<ContractViolation>()
              .having((e) => e.subject, 'subject', 'OrderTotals')
              .having((e) => e.detail, 'detail', contains('PR #21')),
        ),
      );
    });

    test('a total that does not equal its parts is rejected too', () {
      final tampered = f.orderTotals()..['total'] = 40.00;
      expect(
        () => OrderTotals.fromJson(tampered),
        throwsA(
          isA<ContractViolation>()
              .having((e) => e.detail, 'detail', contains('total')),
        ),
      );
    });

    test('a zero-rated jurisdiction is a zero component, not a missing one',
        () {
      // QA and KW carry rate 0. The shipping VAT is PRESENT and zero, and both
      // identities still hold — no special case needed, and no way to confuse
      // "zero VAT" with "VAT not recorded".
      final totals = OrderTotals.fromJson(f.orderTotalsZeroRated());
      expect(totals.shippingVatAmount, Decimal.zero);
      expect(totals.shippingVatAmount, isNotNull);
      expect(totals.isConsistent, isTrue);
    });

    test('the check is exact, not epsilon-based: one fils out still fails', () {
      final offByOneFils = f.orderTotals()
        ..['vatAmount'] = 2.12
        ..['total'] = 44.33;
      // The components sum to 2.11. An epsilon tolerance here would be a
      // tolerance for precisely the error the check exists to catch.
      expect(
        () => OrderTotals.fromJson(offByOneFils),
        throwsA(isA<ContractViolation>()),
      );
    });

    test('the violation propagates out of the enclosing CheckoutQuote', () {
      // The quote is what a buyer is charged from. A bad totals block must
      // take the whole quote down rather than reaching a screen.
      expect(
        () => CheckoutQuote.fromJson(
          f.checkoutQuote(totals: f.orderTotalsWithCollapsedVat()),
        ),
        throwsA(isA<ContractViolation>()),
      );
    });

    test('every money figure survives as an exact decimal', () {
      final money =
          OrderTotals.fromJson(f.orderTotals()).inCurrency(Currency.aed);
      expect(money.goodsVatAmount.format(), '1.11 AED');
      expect(money.shippingVatAmount.format(), '1.00 AED');
      expect(money.vatAmount.format(), '2.11 AED');
      // The identity holds in Money as well as in Decimal, because both are
      // integer arithmetic.
      expect(money.goodsVatAmount + money.shippingVatAmount, money.vatAmount);
    });
  });

  group('PersistedOrderTotals admits what the Order table does not store', () {
    test('an order WITH the split parses and checks the stronger identity', () {
      final totals = PersistedOrderTotals.fromJson(f.persistedOrderTotals());
      expect(totals.hasVatBreakdown, isTrue);
      expect(totals.vatComponentsAgree, isTrue);
      expect(totals.totalAgrees, isTrue);
    });

    test('an order WITHOUT the split parses, and the components stay null', () {
      // The `Order` table has no column for either component. Null means "not
      // recorded" — defaulting to zero would assert that no VAT was charged on
      // freight, which is the exact false claim PR #21 fixed.
      final totals = PersistedOrderTotals.fromJson(
        f.persistedOrderTotalsWithoutBreakdown(),
      );
      expect(totals.goodsVatAmount, isNull);
      expect(totals.shippingVatAmount, isNull);
      expect(totals.hasVatBreakdown, isFalse);
      // Tri-state: null is "nothing to check", NOT "checked and fine".
      expect(totals.vatComponentsAgree, isNull);
      // The weaker identity is still enforced.
      expect(totals.totalAgrees, isTrue);
    });

    test('typed money keeps the components nullable', () {
      final money = PersistedOrderTotals.fromJson(
        f.persistedOrderTotalsWithoutBreakdown(),
      ).inCurrency(Currency.aed);
      expect(money.goodsVatAmount, isNull);
      expect(money.shippingVatAmount, isNull);
      expect(money.hasVatBreakdown, isFalse);
      expect(money.vatAmount.format(), '2.11 AED');
    });

    test('a recorded split that does not add up is rejected', () {
      final tampered = f.persistedOrderTotals()..['goodsVatAmount'] = 0.50;
      expect(
        () => PersistedOrderTotals.fromJson(tampered),
        throwsA(isA<ContractViolation>()),
      );
    });

    test('a persisted total that does not equal its parts is rejected', () {
      final tampered = f.persistedOrderTotals()..['total'] = 99.99;
      expect(
        () => PersistedOrderTotals.fromJson(tampered),
        throwsA(isA<ContractViolation>()),
      );
    });

    test('an order fetched without a breakdown still renders its VAT total',
        () {
      final order = OrderDetail.fromJson(
        f.orderDetail(totals: f.persistedOrderTotalsWithoutBreakdown()),
      );
      expect(order.hasVatBreakdown, isFalse);
      expect(order.money.vatAmount.format(), '2.11 AED');
    });
  });

  group('the invariant survives the new placement path', () {
    test('a PLACED order with a split that does not add up is refused', () {
      // `POST /v1/orders` is a new route onto the same totals. The check has
      // to hold there too, and at PARSE time: a placed order whose recorded
      // VAT split contradicts the VAT it charged must never reach a
      // confirmation screen, because every figure on that screen would agree
      // with every other and all of them would be wrong together.
      final Map<String, dynamic> tamperedTotals = f.persistedOrderTotals()
        ..['goodsVatAmount'] = 0.50;
      expect(
        () => PlacedOrder.fromJson(<String, dynamic>{
          'order': f.orderDetail(totals: tamperedTotals),
          'replayed': false,
        }),
        throwsA(isA<ContractViolation>()),
      );
    });

    test('a REPLAYED order gets exactly the same scrutiny', () {
      // A replay is still a payload off the wire. "We have seen this order
      // before" is not a reason to stop checking its arithmetic.
      final Map<String, dynamic> tamperedTotals = f.persistedOrderTotals()
        ..['total'] = 99.99;
      expect(
        () => PlacedOrder.fromJson(<String, dynamic>{
          'order': f.orderDetail(totals: tamperedTotals),
          'replayed': true,
        }),
        throwsA(isA<ContractViolation>()),
      );
    });

    test('a well-formed placed order passes through untouched', () {
      final PlacedOrder placed = PlacedOrder.fromJson(f.placedOrder());
      expect(placed.order.money.vatAmount.format(), '2.11 AED');
      expect(placed.order.totals.vatComponentsAgree, isTrue);
      expect(placed.order.totals.totalAgrees, isTrue);
    });
  });
}
