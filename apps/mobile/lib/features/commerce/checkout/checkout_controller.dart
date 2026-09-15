import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/models/checkout.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/requests.dart';
import '../data/commerce_gateways.dart';
import '../data/local_cart.dart';

/// The four steps, in the order a buyer can actually answer them.
///
/// Delivery cannot be priced before there is an address to price it against,
/// and the review cannot state a total before delivery is priced — so the
/// order is a data dependency, not a design preference, and the stepper does
/// not let you skip forward past one.
enum CheckoutStep {
  address,
  delivery,
  payment,
  review;

  String get title => switch (this) {
        CheckoutStep.address => 'Address',
        CheckoutStep.delivery => 'Delivery',
        CheckoutStep.payment => 'Payment',
        CheckoutStep.review => 'Review',
      };

  int get number => index + 1;
}

/// Why a basket cannot be quoted at all.
class CheckoutNotQuotable implements Exception {
  const CheckoutNotQuotable(this.reason);

  final String reason;

  @override
  String toString() => reason;
}

@immutable
class CheckoutState {
  const CheckoutState({
    this.step = CheckoutStep.address,
    this.address,
    this.quote,
    this.paymentMethod,
    this.placement,
    this.unsellableLinesPresent = false,
  });

  final CheckoutStep step;
  final ShippingAddress? address;

  /// Null until an address exists — which is a third state, distinct from
  /// "loading" and from "failed", and it is what the address step renders.
  final AsyncValue<CheckoutQuote>? quote;

  final PaymentMethod? paymentMethod;

  /// The order id, once an order has actually been placed. Null while the app
  /// has no way to place one — see [OrderPlacement].
  final AsyncValue<String>? placement;

  /// True when the basket holds a line the server would refuse to sell.
  ///
  /// `orders.ts` rejects a B2C order containing a product that is not
  /// B2C-enabled, so a checkout that reached a payment step with one in the
  /// basket would be collecting a payment method for an order that cannot be
  /// placed. The payment step is therefore not reachable at all — see
  /// [canOpen] — rather than reachable and then failing.
  final bool unsellableLinesPresent;

  CheckoutQuote? get quotedValue => quote?.value;

  bool get hasAddress => address != null;
  bool get hasQuote => quotedValue != null;
  bool get hasPaymentMethod => paymentMethod != null;

  /// Whether [step] may be opened yet.
  bool canOpen(CheckoutStep target) => switch (target) {
        CheckoutStep.address => true,
        CheckoutStep.delivery => hasAddress,
        CheckoutStep.payment => hasQuote && !unsellableLinesPresent,
        CheckoutStep.review =>
          hasQuote && hasPaymentMethod && !unsellableLinesPresent,
      };

  CheckoutState copyWith({
    CheckoutStep? step,
    ShippingAddress? address,
    AsyncValue<CheckoutQuote>? quote,
    PaymentMethod? paymentMethod,
    AsyncValue<String>? placement,
    bool? unsellableLinesPresent,
  }) =>
      CheckoutState(
        step: step ?? this.step,
        address: address ?? this.address,
        quote: quote ?? this.quote,
        paymentMethod: paymentMethod ?? this.paymentMethod,
        placement: placement ?? this.placement,
        unsellableLinesPresent:
            unsellableLinesPresent ?? this.unsellableLinesPresent,
      );
}

/// The checkout, as a state machine over one quote.
///
/// IT COMPUTES NOTHING ABOUT MONEY. Its whole job on that front is to send the
/// basket to `POST /v1/checkout/quote` and hold what comes back. Every figure
/// the review step renders is a field of [CheckoutQuote.totals]; there is no
/// arithmetic in this file or in the screen, and `checkout_no_arithmetic_test`
/// asserts that against the source.
class CheckoutController extends Notifier<CheckoutState> {
  @override
  CheckoutState build() => const CheckoutState();

  void goTo(CheckoutStep step) {
    if (!state.canOpen(step)) return;
    state = state.copyWith(step: step);
  }

  void back() {
    if (state.step.index == 0) return;
    state = state.copyWith(step: CheckoutStep.values[state.step.index - 1]);
  }

  /// Accept an address and price the basket against it.
  Future<void> useAddress(ShippingAddress address) async {
    state = state.copyWith(address: address, step: CheckoutStep.delivery);
    await requestQuote();
  }

  /// Ask the server what this basket costs.
  ///
  /// ONLY EVER CALLED FROM AN EXPLICIT ACT — entering an address, or tapping
  /// "get a new price" on an expired quote. It is deliberately not wired to a
  /// pull-to-refresh or to a timer: re-pricing under the buyer's thumb while
  /// they are reading a total is the behaviour this whole screen exists to
  /// avoid.
  Future<void> requestQuote() async {
    final ShippingAddress? address = state.address;
    if (address == null) return;

    state = state.copyWith(quote: const AsyncLoading<CheckoutQuote>());
    try {
      // AWAITED, not read synchronously. The basket is loaded asynchronously
      // from its store, and a checkout opened before the cart tab was ever
      // visited would otherwise read an `AsyncLoading` and conclude the
      // basket was empty — a checkout that refuses to price a full basket,
      // exactly once, on the path a deep link takes.
      final LocalCart cart = await ref.read(cartControllerProvider.future);
      // Re-appraised on every quote: the basket is live, and a line can go
      // quote-only between the address step and this one.
      state = state.copyWith(
        unsellableLinesPresent: cart.hasQuoteOnlyLines,
      );
      if (cart.isEmpty) {
        throw const CheckoutNotQuotable(
          'There is nothing in the basket to price.',
        );
      }
      if (cart.hasMixedCurrency) {
        throw const CheckoutNotQuotable(
          'This basket holds more than one currency, and a quote is priced in '
          'exactly one. Remove the lines in the other currency.',
        );
      }
      final CheckoutQuote quote = await ref
          .read(checkoutGatewayProvider)
          .quote(_requestFor(cart, address));
      state = state.copyWith(quote: AsyncData<CheckoutQuote>(quote));
    } catch (error, stack) {
      state = state.copyWith(quote: AsyncError<CheckoutQuote>(error, stack));
    }
  }

  /// The body of `POST /v1/checkout/quote`.
  ///
  /// It carries no prices, no VAT and no freight — all of them are resolved
  /// server-side, deliberately. See the header of `CheckoutQuoteRequest`.
  CheckoutQuoteRequest _requestFor(LocalCart cart, ShippingAddress address) =>
      CheckoutQuoteRequest(
        items: <QuoteLineInput>[
          for (final LocalCartLine line in cart.lines)
            QuoteLineInput(
              productId: line.snapshot.productId,
              variantId: line.snapshot.variantId,
              quantity: line.qty,
            ),
        ],
        shippingAddress: ShippingAddressInput(
          label: address.label,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          country: address.country,
          postalCode: address.postalCode,
        ),
        // Required and never defaulted: a defaulted currency prices an order
        // the buyer never chose.
        currency: cart.currency!,
        channel: cart.lines.first.snapshot.channel,
      );

  void selectPaymentMethod(PaymentMethod method) {
    // The same guard as the step bar, at the other door. A basket the server
    // would refuse does not get a payment method attached to it.
    if (state.unsellableLinesPresent) return;
    state = state.copyWith(paymentMethod: method, step: CheckoutStep.review);
  }

  /// Whether this build can place an order at all.
  ///
  /// False in every build shipped today: the contract has no
  /// `POST /v1/orders`. The review step reads this and renders the reason in
  /// place of the button, rather than offering a control that fails.
  bool get canPlaceOrder => ref.read(orderPlacementProvider) != null;

  /// Place the order. Returns its id, or null if it could not be placed.
  Future<String?> place() async {
    final OrderPlacement? placement = ref.read(orderPlacementProvider);
    final CheckoutQuote? quote = state.quotedValue;
    final PaymentMethod? method = state.paymentMethod;
    final ShippingAddress? address = state.address;
    if (placement == null || quote == null || method == null || address == null) {
      return null;
    }

    state = state.copyWith(placement: const AsyncLoading<String>());
    try {
      final String orderId = await placement.place(
        quote: quote,
        method: method,
        address: address,
      );
      state = state.copyWith(placement: AsyncData<String>(orderId));
      return orderId;
    } catch (error, stack) {
      state = state.copyWith(placement: AsyncError<String>(error, stack));
      return null;
    }
  }
}

final NotifierProvider<CheckoutController, CheckoutState>
    checkoutControllerProvider =
    NotifierProvider<CheckoutController, CheckoutState>(
  CheckoutController.new,
  isAutoDispose: true,
);
