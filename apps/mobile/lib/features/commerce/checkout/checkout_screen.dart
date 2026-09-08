import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/checkout.dart';
import '../../../api/models/enums.dart';
import '../../../core/l10n/directional_icon.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/commerce_gateways.dart';
import '../orders/order_confirmed_screen.dart';
import '../shared/commerce_ui.dart';
import 'checkout_controller.dart';
import 'payment_methods.dart';
import 'quote_totals_panel.dart';

/// CHECKOUT — address, delivery, payment, review.
///
/// THE MONEY RULE, stated once for the whole file: this screen computes
/// nothing. It sends the basket to `POST /v1/checkout/quote` and renders what
/// comes back, field by field, through `Money.format`. There is no arithmetic
/// on an amount anywhere in this directory and
/// `test/features/commerce/checkout_no_arithmetic_test.dart` reads the source
/// to prove it.
///
/// DELIBERATELY NOT PULL-TO-REFRESH. A re-quote changes the number the buyer
/// is looking at, so it happens only when they ask for one — entering an
/// address, or tapping "get a new price" on a quote that has expired.
class CheckoutScreen extends ConsumerWidget {
  const CheckoutScreen({this.onOrderPlaced, super.key});

  /// Called with the new order's id once an order is genuinely placed. Null
  /// pushes the confirmation itself.
  final void Function(String orderId)? onOrderPlaced;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final CheckoutState state = ref.watch(checkoutControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: _StepBar(state: state),
            ),
            Expanded(
              child: switch (state.step) {
                CheckoutStep.address => _AddressStep(state: state),
                CheckoutStep.delivery => _QuoteBackedStep(
                    state: state,
                    builder: (BuildContext context, CheckoutQuote quote) =>
                        _DeliveryStep(quote: quote),
                  ),
                CheckoutStep.payment => state.unsellableLinesPresent
                    ? const _QuoteOnlyBlock()
                    : _QuoteBackedStep(
                        state: state,
                        builder: (BuildContext context, CheckoutQuote quote) =>
                            _PaymentStep(state: state),
                      ),
                CheckoutStep.review => _QuoteBackedStep(
                    state: state,
                    builder: (BuildContext context, CheckoutQuote quote) =>
                        _ReviewStep(
                      state: state,
                      quote: quote,
                      onOrderPlaced: onOrderPlaced,
                    ),
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// The four steps as a bar.
///
/// A `Wrap`, not a `Row`: at 200% dynamic type four labels and three
/// connectors do not fit across a phone, and a `Row` would either overflow or
/// ellipse the step the buyer is on. The connector is a [DirectionalIcon] —
/// the one glyph on this screen that genuinely encodes travel through the
/// interface, so it is also the one that mirrors in Arabic.
class _StepBar extends ConsumerWidget {
  const _StepBar({required this.state});

  final CheckoutState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: t.spaceTight,
      runSpacing: t.spaceTight,
      children: <Widget>[
        for (final CheckoutStep step in CheckoutStep.values) ...<Widget>[
          if (step.index > 0)
            DirectionalIcon(
              LucideIcons.chevronRight,
              name: 'chevron-right',
              size: 14,
              color: t.ink3,
            ),
          Semantics(
            button: state.canOpen(step),
            selected: step == state.step,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: state.canOpen(step)
                  ? () =>
                      ref.read(checkoutControllerProvider.notifier).goTo(step)
                  : null,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: kMinTouchTarget),
                child: Center(
                  child: Text(
                    '${Numerals.integer(step.number)}. ${step.title}',
                    style: type.ui.copyWith(
                      color: step == state.step
                          ? t.ink1
                          : (state.canOpen(step) ? t.ink2 : t.ink3),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Every step after the first is a view of one quote, so they all share the
/// same four-state treatment.
class _QuoteBackedStep extends ConsumerWidget {
  const _QuoteBackedStep({required this.state, required this.builder});

  final CheckoutState state;
  final Widget Function(BuildContext context, CheckoutQuote quote) builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<CheckoutQuote> quote =
        state.quote ?? const AsyncLoading<CheckoutQuote>();

    return AsyncStateView<CheckoutQuote>.standard(
      value: quote,
      isEmpty: (CheckoutQuote q) => q.lines.isEmpty,
      onRetry: () =>
          ref.read(checkoutControllerProvider.notifier).requestQuote(),
      skeleton: const MeridianSkeleton(shape: MeridianSkeletonShape.detail),
      emptyTitle: 'This quote priced nothing',
      emptyBody: 'The server accepted the request and returned no lines, so '
          'there is nothing to charge for. Go back and check the basket.',
      data: builder,
    );
  }
}

/// Step one. Nothing downstream can be priced without this.
class _AddressStep extends ConsumerStatefulWidget {
  const _AddressStep({required this.state});

  final CheckoutState state;

  @override
  ConsumerState<_AddressStep> createState() => _AddressStepState();
}

class _AddressStepState extends ConsumerState<_AddressStep> {
  final GlobalKey<FormState> _form = GlobalKey<FormState>();
  final TextEditingController _label = TextEditingController();
  final TextEditingController _line1 = TextEditingController();
  final TextEditingController _line2 = TextEditingController();
  final TextEditingController _city = TextEditingController();
  final TextEditingController _postalCode = TextEditingController();
  Country _country = Country.ae;

  @override
  void dispose() {
    _label.dispose();
    _line1.dispose();
    _line2.dispose();
    _city.dispose();
    _postalCode.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false)) return;
    ref.read(checkoutControllerProvider.notifier).useAddress(
          ShippingAddress(
            label: _label.text.trim(),
            line1: _line1.text.trim(),
            city: _city.text.trim(),
            country: _country,
            line2: _line2.text.trim().isEmpty ? null : _line2.text.trim(),
            postalCode: _postalCode.text.trim().isEmpty
                ? null
                : _postalCode.text.trim(),
          ),
        );
  }

  String? _required(String? value, String field) =>
      (value == null || value.trim().isEmpty) ? '$field is needed' : null;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final List<ShippingAddress> saved = ref.watch(savedAddressesProvider);

    return ListView(
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      children: <Widget>[
        if (saved.isNotEmpty) ...<Widget>[
          SectionPanel(
            title: 'Saved addresses',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                for (final ShippingAddress address in saved)
                  _SavedAddressRow(
                    address: address,
                    onUse: () => ref
                        .read(checkoutControllerProvider.notifier)
                        .useAddress(address),
                  ),
              ],
            ),
          ),
          SizedBox(height: t.spaceStack),
        ],
        SectionPanel(
          title: 'Deliver to',
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'These are the only fields the checkout accepts, so they are '
                  'the only ones asked for.',
                  style: type.meta.copyWith(color: t.ink3),
                ),
                SizedBox(height: t.spaceTight),
                _Field(
                  controller: _label,
                  label: 'Name for this address',
                  validator: (String? v) => _required(v, 'A name'),
                ),
                _Field(
                  controller: _line1,
                  label: 'Address line 1',
                  validator: (String? v) => _required(v, 'The street address'),
                ),
                _Field(controller: _line2, label: 'Address line 2 (optional)'),
                _Field(
                  controller: _city,
                  label: 'City',
                  validator: (String? v) => _required(v, 'A city'),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.only(top: t.spaceTight),
                  child: DropdownButtonFormField<Country>(
                    initialValue: _country,
                    decoration: const InputDecoration(labelText: 'Country'),
                    items: <DropdownMenuItem<Country>>[
                      for (final Country country in Country.values)
                        DropdownMenuItem<Country>(
                          value: country,
                          child: Text(country.code),
                        ),
                    ],
                    onChanged: (Country? value) {
                      if (value != null) setState(() => _country = value);
                    },
                  ),
                ),
                _Field(
                  controller: _postalCode,
                  label: 'Postal code (optional)',
                ),
                SizedBox(height: t.spaceStack),
                KeyButton(
                  label: 'Price this basket',
                  size: KeyButtonSize.large,
                  expand: true,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.label, this.validator});

  final TextEditingController controller;
  final String label;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Padding(
      padding: EdgeInsetsDirectional.only(top: t.spaceTight),
      child: TextFormField(
        controller: controller,
        validator: validator,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }
}

class _SavedAddressRow extends StatelessWidget {
  const _SavedAddressRow({required this.address, required this.onUse});

  final ShippingAddress address;
  final VoidCallback onUse;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    // A Column, not a Row with a button on the end: KeyButton asserts in the
    // unbounded width a Row hands its children — see InlineKeyAction.
    return Padding(
      padding: EdgeInsetsDirectional.only(bottom: t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(address.label, style: type.ui),
          Text(
            '${address.line1}, ${address.city} · ${address.country.code}',
            style: type.meta.copyWith(color: t.ink2),
          ),
          SizedBox(height: t.spaceTight),
          KeyButton(
            label: 'Deliver here',
            size: KeyButtonSize.small,
            tone: KeyButtonTone.accent,
            expand: true,
            semanticLabel: 'Deliver to ${address.label}',
            onPressed: onUse,
          ),
        ],
      ),
    );
  }
}

/// Step two: what the server said about getting it there.
class _DeliveryStep extends ConsumerWidget {
  const _DeliveryStep({required this.quote});

  final CheckoutQuote quote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final bool blocked =
        ref.watch(checkoutControllerProvider).unsellableLinesPresent;

    return ListView(
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      children: <Widget>[
        ShippingQuoteSummary(shipping: quote.shipping),
        SizedBox(height: t.spaceStack),
        if (blocked) ...<Widget>[
          const _QuoteOnlyBlock(),
          SizedBox(height: t.spaceStack),
        ],
        KeyButton(
          label: 'Continue to payment',
          size: KeyButtonSize.large,
          expand: true,
          trailingIcon: const Icon(LucideIcons.arrowRight),
          onPressed: blocked ||
                  quote.shipping.status == ShippingQuoteStatus.unavailable
              ? null
              : () => ref
                  .read(checkoutControllerProvider.notifier)
                  .goTo(CheckoutStep.payment),
        ),
        if (quote.shipping.status == ShippingQuoteStatus.unavailable)
          Padding(
            padding: EdgeInsetsDirectional.only(top: t.spaceTight),
            child: const CommerceNotice(
              tone: CommerceTone.danger,
              icon: LucideIcons.ban,
              title: 'Checkout cannot continue to this address',
              body: 'Go back to the address step and choose another one.',
            ),
          ),
      ],
    );
  }
}

/// A basket the server would refuse never reaches a payment step.
///
/// `orders.ts` rejects a B2C order containing a product that is not
/// B2C-enabled. Collecting a payment method for that order would be asking the
/// buyer to choose how to pay for something that cannot be sold to them, and
/// the refusal would land after they had entered an address.
class _QuoteOnlyBlock extends StatelessWidget {
  const _QuoteOnlyBlock();

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    return Padding(
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          CommerceNotice(
            tone: CommerceTone.warning,
            icon: LucideIcons.handCoins,
            title: 'A quote-only item is still in the basket',
            body: 'Some of these products are priced by quotation and cannot '
                'be bought outright, so there is no payment step to show. Go '
                'back to the basket to remove them or ask for a quote — the '
                'price above is still good for the rest.',
          ),
        ],
      ),
    );
  }
}

/// Step three. What the buyer may pay with, and what they may not.
class _PaymentStep extends ConsumerWidget {
  const _PaymentStep({required this.state});

  final CheckoutState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final List<PaymentMethodOption> methods = ref.watch(paymentMethodsProvider);
    final List<PaymentMethodOption> available =
        methods.where((PaymentMethodOption m) => m.enabled).toList();
    final List<PaymentMethodOption> unavailable =
        methods.where((PaymentMethodOption m) => !m.enabled).toList();

    return ListView(
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      children: <Widget>[
        SectionPanel(
          title: 'How you will pay',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              for (final PaymentMethodOption method in available)
                _PaymentRow(
                  option: method,
                  selected: state.paymentMethod == method.method,
                  onSelect: () => ref
                      .read(checkoutControllerProvider.notifier)
                      .selectPaymentMethod(method.method),
                ),
            ],
          ),
        ),
        if (unavailable.isNotEmpty) ...<Widget>[
          SizedBox(height: t.spaceStack),
          SectionPanel(
            title: 'Not available yet',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'These are shown so you know they are coming, not as '
                  'choices. This deployment cannot initiate an online payment '
                  'yet, and a button that failed at the last step of a '
                  'purchase would be worse than an honest one that is off.',
                  style: type.meta.copyWith(color: t.ink3),
                ),
                SizedBox(height: t.spaceTight),
                for (final PaymentMethodOption method in unavailable)
                  _PaymentRow(option: method, selected: false, onSelect: null),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({
    required this.option,
    required this.selected,
    required this.onSelect,
  });

  final PaymentMethodOption option;
  final bool selected;
  final VoidCallback? onSelect;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final bool enabled = option.enabled && onSelect != null;
    final Color ink = enabled ? t.ink1 : t.ink3;

    return Semantics(
      button: enabled,
      enabled: enabled,
      selected: selected,
      label: enabled ? option.label : '${option.label}. ${option.description}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onSelect : null,
        child: Padding(
          padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceUnit),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: kMinTouchTarget),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                Icon(option.icon, size: 20, color: ink),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: <Widget>[
                      Text(option.label, style: type.ui.copyWith(color: ink)),
                      Text(
                        option.description,
                        style: type.meta.copyWith(color: t.ink3),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  Icon(LucideIcons.circleCheck, size: 20, color: t.successInk)
                else if (!enabled)
                  Icon(LucideIcons.ban, size: 18, color: t.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Step four. The figures, and the way out.
class _ReviewStep extends ConsumerWidget {
  const _ReviewStep({
    required this.state,
    required this.quote,
    required this.onOrderPlaced,
  });

  final CheckoutState state;
  final CheckoutQuote quote;
  final void Function(String orderId)? onOrderPlaced;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final ShippingAddress? address = state.address;
    final bool expired = quote.isExpired(DateTime.now());

    return ListView(
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      children: <Widget>[
        if (expired) ...<Widget>[
          CommerceNotice(
            tone: CommerceTone.warning,
            icon: LucideIcons.clock,
            title: 'This price has expired',
            body: 'Prices, stock and freight all move. Placing an order '
                'against an expired quote is refused by the server, which is '
                'it declining to honour a figure it no longer stands behind.',
            action: KeyButton(
              label: 'Get a new price',
              size: KeyButtonSize.small,
              tone: KeyButtonTone.accent,
              onPressed: () =>
                  ref.read(checkoutControllerProvider.notifier).requestQuote(),
            ),
          ),
          SizedBox(height: t.spaceStack),
        ],
        SectionPanel(
          title: 'What you are buying',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              for (final QuoteLine line in quote.lines)
                Padding(
                  padding: EdgeInsetsDirectional.symmetric(
                    vertical: t.spaceUnit,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(line.name(language), style: type.body),
                            DirectionalText.rich(
                              <TextSegment>[
                                TextSegment.token(line.sku, kind: LtrToken.sku),
                                TextSegment.prose(
                                  ' · ${Numerals.quantity(line.quantity)} × ',
                                ),
                              ],
                              style: type.meta.copyWith(color: t.ink3),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: t.spaceTight),
                      MoneyText(
                        line.lineTotalIn(quote.currency),
                        style: type.body,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        SizedBox(height: t.spaceStack),
        QuoteTotalsPanel(quote: quote),
        SizedBox(height: t.spaceStack),
        if (address != null)
          SectionPanel(
            title: 'Delivering to',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                DetailRow(label: 'Address', value: address.label),
                DetailRow(
                  label: 'Where',
                  value: '${address.line1}, ${address.city} · '
                      '${address.country.code}',
                ),
                if (state.paymentMethod != null)
                  DetailRow(
                    label: 'Paying by',
                    value: ref
                        .watch(paymentMethodsProvider)
                        .firstWhere(
                          (PaymentMethodOption o) =>
                              o.method == state.paymentMethod,
                        )
                        .label,
                  ),
              ],
            ),
          ),
        SizedBox(height: t.spaceStack),
        _PlaceOrderBlock(state: state, onOrderPlaced: onOrderPlaced),
      ],
    );
  }
}

/// The last control on the screen — or the reason there is not one.
///
/// THE CONTRACT HAS NO `POST /v1/orders`. `orders_api.dart` says so in its
/// header: a quote is priced by `/v1/checkout/quote` and the order itself is
/// placed by the existing web checkout. So unless something has overridden
/// [orderPlacementProvider], this app can price a basket and cannot place it,
/// and the honest rendering of that is the reason — not a "Place order" button
/// that throws at the end of a purchase.
class _PlaceOrderBlock extends ConsumerWidget {
  const _PlaceOrderBlock({required this.state, required this.onOrderPlaced});

  final CheckoutState state;
  final void Function(String orderId)? onOrderPlaced;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final OrderPlacement? placement = ref.watch(orderPlacementProvider);
    final AsyncValue<String>? progress = state.placement;

    if (placement == null) {
      return const CommerceNotice(
        tone: CommerceTone.neutral,
        icon: LucideIcons.info,
        title: 'This build cannot place the order',
        body: 'The price above is real and came from the server. Placing the '
            'order needs an endpoint the contract does not define yet, so the '
            'purchase is finished on the website with this quote.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (progress is AsyncError<String>)
          CommerceNotice(
            tone: CommerceTone.danger,
            icon: LucideIcons.circleAlert,
            title: 'The order was not placed',
            body: progress.error.toString(),
          ),
        KeyButton(
          label: 'Place order',
          size: KeyButtonSize.large,
          expand: true,
          busy: progress is AsyncLoading<String>,
          onPressed: () async {
            final String? orderId =
                await ref.read(checkoutControllerProvider.notifier).place();
            if (orderId == null || !context.mounted) return;
            final void Function(String)? handler = onOrderPlaced;
            if (handler != null) {
              handler(orderId);
            } else {
              await Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (BuildContext _) =>
                      OrderConfirmedScreen(orderId: orderId),
                ),
              );
            }
          },
        ),
      ],
    );
  }
}
