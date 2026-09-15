import 'package:avenick/api/models/enums.dart';
import 'package:avenick/api/models/requests.dart';
import 'package:avenick/features/rfq/rfq.dart';
import 'package:flutter_test/flutter_test.dart';

/// THE FORM'S RULES, TESTED WITHOUT A WIDGET IN SIGHT.
///
/// Every one of these is a message a buyer on the app's primary journey can be
/// shown. A widget test would exercise perhaps two of them; this exercises all
/// of them in milliseconds, which is the difference between a rule that is
/// covered and a rule that happened to be typed once.
void main() {
  QuoteRequestDraft draft({
    String? productId = 'prd_1',
    String itemName = '',
    String quantityText = '100',
    String note = '',
    Currency? currency = Currency.aed,
    int moq = 1,
  }) =>
      QuoteRequestDraft(
        productId: productId,
        itemName: itemName,
        quantityText: quantityText,
        note: note,
        currency: currency,
        moq: moq,
      );

  group('quantity', () {
    test('a blank quantity is refused, and says why', () {
      final QuoteRequestDraft d = draft(quantityText: '');
      expect(d.canSubmit, isFalse);
      expect(d.quantityError, contains('Enter how many you need'));
    });

    test('a non-integer is refused as a whole-units message', () {
      expect(
        draft(quantityText: '12.5').quantityError,
        contains('whole units'),
      );
      expect(draft(quantityText: 'lots').quantityError, contains('whole units'));
    });

    test('zero and negatives are refused', () {
      expect(draft(quantityText: '0').quantityError, contains('at least one'));
      expect(draft(quantityText: '-4').quantityError, isNotNull);
    });

    test('the contract ceiling is the ceiling', () {
      // `RfqLineInputSchema.quantity.max` is 1,000,000. Exactly the limit is
      // fine; one more is not — and the message says what to do instead.
      expect(draft(quantityText: '1000000').quantityError, isNull);
      final String? over = draft(quantityText: '1000001').quantityError;
      expect(over, isNotNull);
      expect(over, contains('1,000,000'));
    });

    test('the quantity is rendered in Western digits inside the message', () {
      // Both locales use Western figures — a quantity that has to be typed
      // back in must be typeable. See `Numerals`.
      expect(draft(quantityText: '2', moq: 2500).quantityError, contains('2,500'));
    });
  });

  group('MOQ', () {
    test('below the minimum is refused and names the minimum', () {
      final QuoteRequestDraft d = draft(quantityText: '4', moq: 25);
      expect(d.canSubmit, isFalse);
      expect(d.isBelowMoq, isTrue);
      expect(d.quantityError, contains('minimums of 25'));
    });

    test('exactly the minimum is accepted', () {
      final QuoteRequestDraft d = draft(quantityText: '25', moq: 25);
      expect(d.canSubmit, isTrue);
      expect(d.isBelowMoq, isFalse);
      expect(d.quantityError, isNull);
    });

    test('an UNKNOWN minimum does not bite', () {
      // The product could not be loaded, so `moq` is 1. A guessed minimum
      // would refuse a request the supplier would happily quote.
      expect(draft(quantityText: '1').canSubmit, isTrue);
    });

    test('isBelowMoq is false for a quantity that is not a quantity', () {
      // The "ask for 25 instead" fix-it must not appear next to "0" or "abc":
      // raising 4 to 25 is doing what the buyer implied; raising 0 to 25 would
      // be inventing a number.
      expect(draft(quantityText: '0', moq: 25).isBelowMoq, isFalse);
      expect(draft(quantityText: '', moq: 25).isBelowMoq, isFalse);
      expect(draft(quantityText: 'x', moq: 25).isBelowMoq, isFalse);
    });
  });

  group('the free-text line', () {
    test('a line with no product must describe what is wanted', () {
      final QuoteRequestDraft d = draft(productId: null);
      expect(d.canSubmit, isFalse);
      expect(d.itemNameError, contains('Describe what you need'));
    });

    test('one character is too short for the contract (min 2)', () {
      expect(draft(productId: null, itemName: 'x').itemNameError, isNotNull);
      expect(draft(productId: null, itemName: 'M8').itemNameError, isNull);
    });

    test('300 characters is the ceiling', () {
      expect(
        draft(productId: null, itemName: 'a' * 300).itemNameError,
        isNull,
      );
      expect(
        draft(productId: null, itemName: 'a' * 301).itemNameError,
        contains('300'),
      );
    });

    test('a catalogue line needs no description at all', () {
      expect(draft(itemName: '').itemNameError, isNull);
    });
  });

  group('note and currency', () {
    test('the note ceiling is the contract ceiling', () {
      expect(draft(note: 'a' * 2000).noteError, isNull);
      expect(draft(note: 'a' * 2001).noteError, contains('2,000'));
    });

    test('a currency is REQUIRED and never assumed', () {
      // `createRFQ` falls back to AED for an omitted currency. This app does
      // not omit it, so a draft without one cannot be submitted.
      final QuoteRequestDraft d = draft(currency: null);
      expect(d.canSubmit, isFalse);
      expect(d.currencyError, contains('Choose the currency'));
    });
  });

  group('toRequest', () {
    test('a catalogue line sends the productId and NOT a name', () {
      // The server resolves `nameEn` from the catalogue and ignores anything
      // sent alongside a `productId`. Sending one anyway lets a request say
      // "500 of [X]" while naming something else.
      final CreateRfqRequest request = draft(
        itemName: 'something else entirely',
        quantityText: '500',
      ).toRequest();
      final Map<String, Object?> json = request.toJson();
      final List<Object?> items = json['items']! as List<Object?>;
      final Map<String, Object?> line = items.single! as Map<String, Object?>;

      expect(line['productId'], 'prd_1');
      expect(line.containsKey('nameEn'), isFalse);
      expect(line['quantity'], 500);
      expect(json['currency'], 'AED');
    });

    test('a free-text line sends the name', () {
      final Map<String, Object?> json = draft(
        productId: null,
        itemName: '  Galvanised tube 48.3mm  ',
        quantityText: '20',
      ).toRequest().toJson();
      final Map<String, Object?> line =
          (json['items']! as List<Object?>).single! as Map<String, Object?>;

      expect(line.containsKey('productId'), isFalse);
      expect(line['nameEn'], 'Galvanised tube 48.3mm');
    });

    test('an empty note is omitted, not sent as an empty string', () {
      expect(draft().toRequest().toJson().containsKey('notes'), isFalse);
      expect(
        draft(note: '  Needed in Jebel Ali  ').toRequest().toJson()['notes'],
        'Needed in Jebel Ali',
      );
    });

    test('an unsubmittable draft throws rather than sending a bad body', () {
      expect(draft(quantityText: '0').toRequest, throwsStateError);
    });

    test('every request this form builds is one the client model calls valid',
        () {
      // `CreateRfqRequest.isWellFormed` is the API layer's own check. If the
      // form can build a body that fails it, the form is wrong.
      expect(draft().toRequest().isWellFormed, isTrue);
      expect(
        draft(productId: null, itemName: 'Tube').toRequest().isWellFormed,
        isTrue,
      );
    });
  });
}
