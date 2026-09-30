import 'package:avenick/api/models/models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Money is not a `double`, and these tests are what says so.
///
/// The failure this guards against is silent. `12.34` decoded into a Dart
/// double is 12.3399999999999998578…; it survives `toStringAsFixed(2)` and
/// only shows up after a few hundred additions, in a settlement report nobody
/// is watching. So the assertions here are on EXACT equality throughout, and
/// on the three-decimal GCC currencies, which a two-decimal assumption gets
/// wrong by a factor of ten in the last place a buyer reads.
void main() {
  group('Decimal is exact', () {
    test('the classic float failure does not happen here', () {
      final tenth = Decimal.parse('0.1');
      final fifth = Decimal.parse('0.2');
      expect(tenth + fifth, Decimal.parse('0.3'));
      // For contrast, and to make the reason for this whole type concrete:
      expect(0.1 + 0.2 == 0.3, isFalse);
    });

    test('a JSON double is recovered through its text, not by multiplying', () {
      final value = Decimal.fromJson(12.34);
      expect(value.units, BigInt.from(1234));
      expect(value.scale, 2);
      expect(value.toString(), '12.34');
    });

    test('an integer JSON number keeps scale zero', () {
      final value = Decimal.fromJson(20);
      expect(value.scale, 0);
      expect(value.toString(), '20');
      expect(value, Decimal.parse('20.00'));
    });

    test('exact decimal text parses, including exponent notation', () {
      expect(Decimal.parse('1e2'), Decimal.parse('100'));
      expect(Decimal.parse('-0.05').isNegative, isTrue);
      expect(Decimal.parse('1.5e-2'), Decimal.parse('0.015'));
      expect(() => Decimal.parse('twelve'), throwsFormatException);
      expect(() => Decimal.fromJson(double.nan), throwsFormatException);
    });

    test('equality ignores trailing zeros but keeps the value', () {
      expect(Decimal.parse('1.50'), Decimal.parse('1.5'));
      expect(Decimal.parse('1.50').hashCode, Decimal.parse('1.5').hashCode);
      expect(Decimal.parse('1.50'), isNot(Decimal.parse('1.05')));
    });

    test('widening a scale is exact; narrowing away a digit is refused', () {
      expect(Decimal.parse('12.34').rescale(3).toString(), '12.340');
      expect(Decimal.parse('12.300').rescale(2).toString(), '12.30');
      // Rounding money is the SERVER's job. A client that rounds again
      // produces a second answer no invoice agrees with.
      expect(() => Decimal.parse('12.345').rescale(2), throwsStateError);
    });

    test('a thousand additions of a fils stay exact', () {
      var total = Decimal.zero;
      for (var i = 0; i < 1000; i++) {
        total = total + Decimal.parse('0.01');
      }
      expect(total, Decimal.parse('10.00'));
      // The same loop in binary floating point does not land on 10.0.
      var floating = 0.0;
      for (var i = 0; i < 1000; i++) {
        floating += 0.01;
      }
      expect(floating == 10.0, isFalse);
    });

    test('grouping is done on digits, never through a number formatter', () {
      expect(Decimal.parse('1234567.89').toGrouped(2), '1,234,567.89');
      expect(Decimal.parse('-1234.5').toGrouped(3), '-1,234.500');
      expect(
        Decimal.parse('999999999999.99').toGrouped(2),
        '999,999,999,999.99',
      );
    });
  });

  group('the three-minor-digit GCC currencies keep three decimals', () {
    test('KWD, BHD and OMR carry an exponent of 3; the rest carry 2', () {
      expect(Currency.kwd.decimalDigits, 3);
      expect(Currency.bhd.decimalDigits, 3);
      expect(Currency.omr.decimalDigits, 3);
      expect(Currency.aed.decimalDigits, 2);
      expect(Currency.sar.decimalDigits, 2);
      expect(Currency.qar.decimalDigits, 2);
      expect(Currency.usd.decimalDigits, 2);
    });

    test('a KWD amount formats with three places, not two', () {
      final money = Money.of(Decimal.fromJson(12.5), Currency.kwd);
      expect(money.format(), '12.500 KWD');
      expect(money.minorUnits, BigInt.from(12500));
      // The same number in a two-digit currency is a different string, and
      // that difference is the whole point.
      expect(
        Money.of(Decimal.fromJson(12.5), Currency.aed).format(),
        '12.50 AED',
      );
    });

    test('BHD and OMR do the same', () {
      expect(
        Money.of(Decimal.parse('0.5'), Currency.bhd).format(),
        '0.500 BHD',
      );
      expect(
        Money.of(Decimal.parse('1234.5'), Currency.omr).format(withCode: false),
        '1,234.500',
      );
    });

    test('the server only sends two places, and widening to three is lossless',
        () {
      // KNOWN LIMITATION, mirrored rather than hidden: every money column is
      // Decimal(12,2) and `composeOrderTotals` rounds to two places, so a KWD
      // figure arrives with two. Widening it is exact; inventing a third digit
      // would be a precision the ledger does not have.
      final fromWire = Decimal.fromJson(12.34);
      expect(fromWire.scale, 2);
      final money = Money.of(fromWire, Currency.kwd);
      expect(money.format(), '12.340 KWD');
      expect(money.amount, Decimal.parse('12.340'));
      expect(money.amount, Decimal.parse('12.34'));
    });

    test('a figure with more precision than the currency has is refused', () {
      // Not rounded into shape — refused. A third decimal in an AED payload is
      // a figure the ledger cannot store, and displaying a rounded version of
      // it would hide that.
      expect(
        () => Money.of(Decimal.parse('12.345'), Currency.aed),
        throwsStateError,
      );
    });
  });

  group('Money arithmetic never goes through a double', () {
    test('minor units are BigInt and the amount is an exact Decimal', () {
      final money = Money.of(Decimal.parse('12.34'), Currency.aed);
      expect(money.minorUnits, isA<BigInt>());
      expect(money.amount, isA<Decimal>());
      expect(money.amount.units, isA<BigInt>());
      // Nothing on Money exposes a double at all.
      expect(money.amount.toString(), '12.34');
    });

    test('addition of a hundred lines is exact', () {
      var total = Money.zero(Currency.kwd);
      for (var i = 0; i < 100; i++) {
        total += Money.of(Decimal.parse('0.001'), Currency.kwd);
      }
      expect(total.format(), '0.100 KWD');
      expect(total.minorUnits, BigInt.from(100));
    });

    test('quantity multiplication is integer multiplication', () {
      final line =
          Money.of(Decimal.parse('12.34'), Currency.aed).timesQuantity(3);
      expect(line.format(), '37.02 AED');
      expect(line.minorUnits, BigInt.from(3702));
    });

    test('there is no divide and no multiply by a rate', () {
      // Both need a rounding rule, and the rounding rule lives in
      // `composeOrderTotals` on the server. Two roundings produce two answers.
      final money = Money.of(Decimal.parse('12.34'), Currency.aed);
      expect(money.timesQuantity, isA<Function>());
      // The API surface is deliberately narrow: add, subtract, times-quantity,
      // compare, format. Nothing here can produce an unrounded fraction.
      expect(money - money, Money.zero(Currency.aed));
      expect(money.compareTo(money), 0);
    });

    test('mixing currencies throws rather than inventing a rate', () {
      final aed = Money.of(Decimal.parse('10.00'), Currency.aed);
      final kwd = Money.of(Decimal.parse('10.000'), Currency.kwd);
      expect(() => aed + kwd, throwsArgumentError);
      expect(() => aed.compareTo(kwd), throwsArgumentError);
    });

    test('equality is by currency AND amount', () {
      expect(
        Money.of(Decimal.parse('10.00'), Currency.aed),
        Money.of(Decimal.parse('10'), Currency.aed),
      );
      expect(
        Money.of(Decimal.parse('10.00'), Currency.aed),
        isNot(Money.of(Decimal.parse('10.000'), Currency.kwd)),
      );
    });
  });

  group('models expose Money, never a double', () {
    test('a KWD cart line formats with three decimals end to end', () {
      final line = CartLine.fromJson(<String, dynamic>{
        'id': 'cl_1',
        'productId': 'prd_1',
        'variantId': null,
        'sellerId': 'sel_1',
        'slug': 'kuwaiti-widget',
        'sku': 'KW-1',
        'nameEn': 'Widget',
        'nameAr': 'أداة',
        'image': null,
        'channel': 'B2C',
        'qty': 3,
        'moq': 1,
        'unitPrice': 1.25,
        'currency': 'KWD',
        'vatRatePercent': 0,
        'priceTiered': false,
        'availability': 'IN_STOCK',
        'sellableInChannel': true,
        'lineTotal': 3.75,
      });
      expect(line.unitPriceMoney.format(), '1.250 KWD');
      expect(line.lineTotalMoney.format(), '3.750 KWD');
      // The identity the server computed holds exactly on the client too.
      expect(line.unitPriceMoney.timesQuantity(3), line.lineTotalMoney);
    });
  });
}
