import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Tripwires between this feature and the two things it does not own: the
/// `/v1` contract, and the generated models.
///
/// These are source-level checks for the same reason `design_lint_test.dart`
/// is: the drift they catch compiles cleanly, passes every widget test, and is
/// invisible in a screenshot.
void main() {
  final File contract = File('../../packages/contracts/openapi.json');
  final File models = File('lib/api/models/catalogue.dart');
  final File offer = File('lib/features/catalogue/data/catalogue_offer.dart');

  /// The property names on one OpenAPI schema.
  Set<String> propertiesOf(String schema) {
    final Map<String, dynamic> doc =
        jsonDecode(contract.readAsStringSync()) as Map<String, dynamic>;
    final Map<String, dynamic> components =
        doc['components'] as Map<String, dynamic>;
    final Map<String, dynamic> schemas =
        components['schemas'] as Map<String, dynamic>;
    final Map<String, dynamic>? target =
        schemas[schema] as Map<String, dynamic>?;
    if (target == null) return const <String>{};
    final Map<String, dynamic>? props =
        target['properties'] as Map<String, dynamic>?;
    return props?.keys.toSet() ?? const <String>{};
  }

  test(
    'CatalogueOffer switches to sellableInChannel the moment the model has it',
    () {
      // `sellableInChannel` is the contract's REQUIRED answer to "can this be
      // ordered, in the channel this DTO was built for" — the same question
      // three server-side guards ask before refusing an order. It is what the
      // primary action on a product page should be driven from.
      //
      // Today the generated Dart models do not carry it, so CatalogueOffer
      // infers it from the resolved price. That inference is safe but weaker,
      // and it must not survive the day the field arrives: a client that keeps
      // guessing while the wire is telling it the answer is a client that will
      // eventually guess wrong on a live order.
      //
      // This test passes while the model lacks the field, and fails the moment
      // it gains it without CatalogueOffer being switched over.
      if (!contract.existsSync() || !models.existsSync()) return;

      final bool modelCarriesFlag =
          models.readAsStringSync().contains('sellableInChannel');
      final bool offerReadsFlag =
          offer.readAsStringSync().contains('card.sellableInChannel');

      expect(
        !modelCarriesFlag || offerReadsFlag,
        isTrue,
        reason:
            'lib/api/models/catalogue.dart now carries `sellableInChannel`, '
            'but CatalogueOffer is still inferring sellability from the '
            'resolved price.\n\n'
            'Switch it over — two lines:\n'
            '  forCard:   mode: card.sellableInChannel ? purchase : quote\n'
            '  forDetail: mode: detail.sellableInChannel ? purchase : quote\n\n'
            'Then delete the price-based fallback and its note, and update '
            'the class doc.',
      );
    },
  );

  test('the contract still carries the fields this feature reads', () {
    if (!contract.existsSync()) return;

    // A field disappearing from the contract is the other direction of the
    // same drift, and it is the one that produces a blank screen rather than a
    // wrong button. Named explicitly so the failure says which.
    final Set<String> card = propertiesOf('ProductCard');
    if (card.isEmpty) return;
    expect(
      card,
      containsAll(<String>[
        'price',
        'moq',
        'availability',
        'priceTiered',
        'rating',
        'brandName',
        'image',
      ]),
      reason: 'ProductCard lost a property the card renders.',
    );

    final Set<String> detail = propertiesOf('ProductDetail');
    expect(
      detail,
      containsAll(<String>[
        'prices',
        'variants',
        'seller',
        'channel',
        'origin',
        'weightKg',
        'tags',
      ]),
      reason: 'ProductDetail lost a property the product page renders.',
    );

    // Documented absences. If either of these ever appears, the widget that
    // fakes around it can be deleted — see PriceBlock.wasPrice and the
    // Ratings section on ProductDetailScreen.
    expect(
      card.contains('compareAtPrice'),
      isFalse,
      reason:
          'ProductCard now has a compare-at price: wire PriceBlock.wasPrice '
          'to it and delete the note saying nothing fills it in.',
    );
    expect(
      detail.contains('reviews'),
      isFalse,
      reason: 'ProductDetail now carries reviews: the Ratings section can show '
          'them instead of the aggregate alone.',
    );
  });
}
