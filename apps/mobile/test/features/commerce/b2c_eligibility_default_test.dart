import 'package:avenick/features/commerce/data/commerce_gateways.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness.dart';

/// The guard has to be TOLD, and for a while it wasn't.
///
/// `b2cEligibilityProvider` used to default to [UnstatedB2CEligibility],
/// because the contract carried no sellability field and inferring one from
/// `line.channel` would have been wrong for every row in the production
/// catalogue (those rows are priced in B2C *and* not sellable in it). That was
/// the honest default at the time, but it left the cart guard real and inert:
/// correct about a quote-only line, and never handed one.
///
/// `CartLine.sellableInChannel` is now a required field on the wire, so the
/// default reads it. These tests pin that, because the failure mode if it
/// regresses is silent — the cart accepts a line, checkout offers to take
/// money, and `secureCreateOrder` refuses at the very end.
void main() {
  group('b2cEligibilityProvider default', () {
    test('reads the contract flag rather than answering unstated', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);

      final B2CEligibility eligibility = container.read(b2cEligibilityProvider);
      expect(eligibility, isA<ContractB2CEligibility>());

      expect(
        eligibility.of(cartLine(sellableInChannel: false)),
        B2CSellability.quoteOnly,
        reason: 'a quote-only line must be refused, not merely unknown',
      );
      expect(
        eligibility.of(cartLine(sellableInChannel: true)),
        B2CSellability.sellable,
      );
    });

    test('never answers unstated once the field is required on the wire', () {
      final ProviderContainer container = ProviderContainer();
      addTearDown(container.dispose);
      final B2CEligibility eligibility = container.read(b2cEligibilityProvider);

      for (final bool flag in <bool>[true, false]) {
        expect(
          eligibility.of(cartLine(sellableInChannel: flag)),
          isNot(B2CSellability.unstated),
        );
      }
    });
  });
}
