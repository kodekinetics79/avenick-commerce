import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../data/commerce_gateways.dart';

/// WHAT THE BUYER MAY ACTUALLY PAY WITH.
///
/// This mirrors `apps/customer/src/components/checkout/payment-methods.ts`
/// field for field, because the two surfaces must not disagree about what the
/// same backend will accept. The order route fails closed on MADA, Apple Pay,
/// card and STC Pay with
///
///     "Online payment initiation is not enabled for this deployment"  (503)
///
/// so those four are OFFERED WITH THE REASON rather than hidden or, worse,
/// rendered as live buttons. The difference matters in both directions:
///
///  * A live button that 503s teaches the buyer the app is broken, and it
///    happens at the last step of a purchase, after they entered an address.
///  * Hiding the methods entirely reads as a product that never supported
///    cards. The disabled row with a stated reason reads as a regulated
///    product waiting on certification, which is what it is.
///
/// `MOCK` appears only where the route's own gate (`PILOT_MODE &&
/// ALLOW_MOCK_PAYMENTS`) would accept it — see [mockPaymentsEnabledProvider].
///
/// THERE IS NO ENDPOINT FOR THIS. The contract has no
/// `GET /v1/checkout/payment-methods`, so "server-driven" is as server-driven
/// as the wire allows: the list is derived from the deployment flag and the
/// known behaviour of the order route, in one place, rather than hardcoded
/// into the screen. The day the route exists, replace the body of
/// [paymentMethodsFor] and nothing on the screen changes.
@immutable
class PaymentMethodOption {
  const PaymentMethodOption({
    required this.method,
    required this.label,
    required this.description,
    required this.icon,
    required this.enabled,
  });

  final PaymentMethod method;
  final String label;

  /// What choosing it does — or why it cannot be chosen. Never empty: a
  /// disabled row with no stated reason reads as a broken product.
  final String description;

  final IconData icon;

  /// Whether the order route would accept this method today.
  final bool enabled;
}

/// The reason the four card methods are unavailable, in the buyer's words.
const String kCertificationReason = 'Requires certified payment initiation';

/// The server's own words, kept verbatim for a support conversation.
const String kPaymentInitiationDisabled =
    'Online payment initiation is not enabled for this deployment';

List<PaymentMethodOption> paymentMethodsFor({
  required bool mockPaymentsEnabled,
}) {
  return <PaymentMethodOption>[
    if (mockPaymentsEnabled)
      const PaymentMethodOption(
        method: PaymentMethod.mock,
        label: 'Test payment (pilot)',
        description: 'Pilot simulation — no card is charged',
        icon: LucideIcons.circleCheck,
        enabled: true,
      ),
    const PaymentMethodOption(
      method: PaymentMethod.bankTransfer,
      label: 'Bank transfer',
      description: 'Creates an unpaid order for finance confirmation',
      icon: LucideIcons.building2,
      enabled: true,
    ),
    const PaymentMethodOption(
      method: PaymentMethod.creditCard,
      label: 'Credit or debit card',
      description: kCertificationReason,
      icon: LucideIcons.creditCard,
      enabled: false,
    ),
    const PaymentMethodOption(
      method: PaymentMethod.mada,
      label: 'mada',
      description: kCertificationReason,
      icon: LucideIcons.creditCard,
      enabled: false,
    ),
    const PaymentMethodOption(
      method: PaymentMethod.applePay,
      label: 'Apple Pay',
      description: kCertificationReason,
      icon: LucideIcons.smartphone,
      enabled: false,
    ),
    const PaymentMethodOption(
      method: PaymentMethod.stcPay,
      label: 'STC Pay',
      description: kCertificationReason,
      icon: LucideIcons.wallet,
      enabled: false,
    ),
  ];
}

final Provider<List<PaymentMethodOption>> paymentMethodsProvider =
    Provider<List<PaymentMethodOption>>(
  (Ref ref) => paymentMethodsFor(
    mockPaymentsEnabled: ref.watch(mockPaymentsEnabledProvider),
  ),
);

/// The buyer-facing name of a method that was ALREADY used on an order.
///
/// Separate from [paymentMethodsFor] on purpose: that list answers "what may
/// I choose now", which changes with the deployment, while this answers "what
/// was this order paid with", which is a historical fact and must render even
/// for a method the app would no longer offer.
String labelForPaymentMethod(PaymentMethod method) => switch (method) {
      PaymentMethod.mada => 'mada',
      PaymentMethod.applePay => 'Apple Pay',
      PaymentMethod.creditCard => 'Credit or debit card',
      PaymentMethod.bankTransfer => 'Bank transfer',
      PaymentMethod.stcPay => 'STC Pay',
      PaymentMethod.mock => 'Test payment (pilot)',
    };

/// The buyer-facing name of a payment's standing.
String labelForPaymentStatus(PaymentStatus status) => switch (status) {
      PaymentStatus.unpaid => 'Unpaid',
      PaymentStatus.paid => 'Paid',
      PaymentStatus.partiallyPaid => 'Partly paid',
      PaymentStatus.refunded => 'Refunded',
      PaymentStatus.failed => 'Payment failed',
    };
