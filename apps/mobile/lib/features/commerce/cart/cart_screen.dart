import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../checkout/checkout_screen.dart';
import '../data/commerce_gateways.dart';
import '../data/local_cart.dart';
import '../shared/commerce_ui.dart';
import 'cart_line_tile.dart';

/// THE BASKET.
///
/// Grouped by seller, because this is a marketplace: one basket becomes N
/// orders and N deliveries, and a flat list hides that until the parcels
/// arrive on three different days and the buyer opens a ticket about it.
///
/// DELIBERATELY NOT PULL-TO-REFRESH. Re-pricing or re-ordering a basket under
/// the user's thumb, mid-purchase, is hostile — the buyer is reading figures
/// and deciding, and a gesture that silently changes them is the one thing
/// this screen must never do. Nothing here is stale anyway: the basket is
/// local, and prices are settled by the checkout quote.
class CartScreen extends ConsumerWidget {
  const CartScreen({
    this.onCheckout,
    this.onBrowse,
    this.onRequestQuote,
    super.key,
  });

  /// Supplied by the router when there is a `/checkout` route to go to. Until
  /// then the screen pushes the checkout itself, so the flow works today.
  final VoidCallback? onCheckout;

  /// Where "browse the catalogue" goes. Null leaves the empty state's action
  /// off rather than offering a button that goes nowhere.
  final VoidCallback? onBrowse;

  /// Where a quote-only line goes when the buyer asks for a quote. Called with
  /// the product id. Null omits the action.
  final void Function(String productId)? onRequestQuote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final AsyncValue<LocalCart> cart = ref.watch(cartControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Basket')),
      body: SafeArea(
        child: AsyncStateView<LocalCart>.standard(
          value: cart,
          isEmpty: (LocalCart c) => c.isEmpty,
          onRetry: () => ref.invalidate(cartControllerProvider),
          skeleton: const MeridianSkeleton(shape: MeridianSkeletonShape.list),
          emptyTitle: 'Nothing in the basket yet',
          emptyBody: 'Items you add are kept on this device — this basket does '
              'not follow you to another phone or to the website, and nothing '
              'is reserved until you check out.',
          emptyAction: onBrowse == null
              ? null
              : KeyButton(
                  label: 'Browse the catalogue',
                  size: KeyButtonSize.large,
                  icon: const Icon(LucideIcons.package),
                  onPressed: onBrowse,
                ),
          data: (BuildContext context, LocalCart c) => Column(
            children: <Widget>[
              Expanded(
                child: ListView(
                  padding: EdgeInsetsDirectional.all(t.spaceStack),
                  children: <Widget>[
                    for (final SellerGroup group in c.groups) ...<Widget>[
                      _SellerGroupCard(
                        group: group,
                        onRequestQuote: onRequestQuote,
                      ),
                      SizedBox(height: t.spaceStack),
                    ],
                    const _DeviceLocalNote(),
                  ],
                ),
              ),
              _CartFooter(
                cart: c,
                onCheckout: onCheckout ??
                    () => Navigator.of(context).push<void>(
                          MaterialPageRoute<void>(
                            builder: (BuildContext _) => const CheckoutScreen(),
                          ),
                        ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One seller's lines, with the delivery they will arrive under.
class _SellerGroupCard extends ConsumerWidget {
  const _SellerGroupCard({required this.group, required this.onRequestQuote});

  final SellerGroup group;
  final void Function(String productId)? onRequestQuote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final String? name = ref.watch(sellerNamesProvider)[group.sellerId];
    final Money? subtotal = group.subtotal;

    return SectionPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(LucideIcons.store, size: 18, color: t.ink2),
              SizedBox(width: t.spaceTight),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (name != null)
                      Text(name, style: type.ui)
                    else
                      // `CartLine` carries a sellerId and no name — see
                      // sellerNamesProvider. The id is machine-readable, so it
                      // is isolated rather than left to the bidi algorithm.
                      DirectionalText.rich(
                        <TextSegment>[
                          const TextSegment.prose('Seller '),
                          TextSegment.token(
                            group.sellerId,
                            kind: LtrToken.reference,
                          ),
                        ],
                        style: type.ui,
                      ),
                    Text(
                      '${Numerals.quantity(group.lines.length)} '
                      '${group.lines.length == 1 ? 'line' : 'lines'} · '
                      'ships as one delivery',
                      style: type.meta.copyWith(color: t.ink3),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Divider(height: t.spaceStack * 2, color: t.hairline),
          for (int i = 0; i < group.lines.length; i++) ...<Widget>[
            if (i > 0) Divider(height: t.spaceStack * 2, color: t.hairline),
            _Line(
              line: group.lines[i],
              language: language,
              onRequestQuote: onRequestQuote,
            ),
          ],
          Divider(height: t.spaceStack * 2, color: t.hairline),
          const _GroupDeliveryEstimate(),
          if (subtotal != null)
            MoneyRow(label: 'Seller subtotal', value: subtotal)
          else
            const MoneyRow.absent(
              label: 'Seller subtotal',
              absentNote: 'Settled at checkout',
              note: 'A line in this group re-prices when the quantity changes, '
                  'so there is no subtotal to state yet.',
            ),
        ],
      ),
    );
  }
}

/// The per-seller delivery slot.
///
/// It says what is knowable and nothing more. Freight on this platform is
/// priced by `POST /v1/checkout/quote`, which takes a destination address and
/// returns ONE `ShippingQuote` for the whole basket — there is no per-seller
/// shipping figure and no delivery estimate anywhere on the cart surface. So
/// this states when the estimate arrives instead of inventing "2–4 days",
/// which is the kind of number a buyer plans a site visit around.
class _GroupDeliveryEstimate extends StatelessWidget {
  const _GroupDeliveryEstimate();

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Padding(
      padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(LucideIcons.truck, size: 16, color: t.ink3),
          SizedBox(width: t.spaceTight),
          Expanded(
            child: Text(
              'Delivery for this seller is priced and dated at checkout, '
              'once there is an address to price it against.',
              style: type.meta.copyWith(color: t.ink3),
            ),
          ),
        ],
      ),
    );
  }
}

class _Line extends ConsumerWidget {
  const _Line({
    required this.line,
    required this.language,
    required this.onRequestQuote,
  });

  final LocalCartLine line;
  final Language language;
  final void Function(String productId)? onRequestQuote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CartController controller = ref.read(cartControllerProvider.notifier);
    final void Function(String)? quote = onRequestQuote;
    return CartLineTile(
      line: line,
      language: language,
      onQuantityChanged: (int qty) =>
          controller.setQuantity(lineId: line.id, qty: qty),
      onRemove: () => controller.remove(line.id),
      onRaiseToMoq: () => controller.raiseToMoq(line.id),
      onRequestQuote:
          quote == null ? null : () => quote(line.snapshot.productId),
    );
  }
}

/// Where the basket actually lives. Stated, not implied.
class _DeviceLocalNote extends StatelessWidget {
  const _DeviceLocalNote();

  @override
  Widget build(BuildContext context) {
    return const CommerceNotice(
      tone: CommerceTone.neutral,
      icon: LucideIcons.smartphone,
      title: 'This basket is kept on this device',
      body: 'There is no synced basket yet, so what you add here will not '
          'appear on the website or on another phone. Nothing is reserved '
          'until an order is placed.',
    );
  }
}

/// The pinned foot of the screen: what is known, what is not, and the way on.
class _CartFooter extends StatelessWidget {
  const _CartFooter({required this.cart, required this.onCheckout});

  final LocalCart cart;
  final VoidCallback onCheckout;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Money? subtotal = cart.knownSubtotal;
    final int repricing = cart.repricingLineCount;
    final int quoteOnly = cart.quoteOnlyLines.length;
    // Counted by REASON, not by subtraction: a line can be both quote-only and
    // below its minimum, and a difference of counts would hide the second
    // problem the moment the first appeared.
    final int needsAttention = cart.lines
        .where((LocalCartLine l) => l.isBelowMoq || l.isOutOfStock)
        .length;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.surface1,
        border: BorderDirectional(top: BorderSide(color: t.hairline)),
      ),
      child: ConstrainedBox(
        // At 200% type this whole block is taller than a phone. It gets half
        // the screen and scrolls inside itself rather than pushing the total
        // off the bottom or clipping it.
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.5,
        ),
        child: SingleChildScrollView(
          padding: EdgeInsetsDirectional.all(t.spaceStack),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              if (cart.hasMixedCurrency)
                const CommerceNotice(
                  tone: CommerceTone.danger,
                  icon: LucideIcons.triangleAlert,
                  title: 'This basket holds more than one currency',
                  body: 'A basket is single-currency by contract, so there is '
                      'no subtotal to show and no rate this app is allowed to '
                      'invent. Remove the lines in the other currency.',
                )
              else if (subtotal != null)
                MoneyRow(
                  label: 'Subtotal',
                  value: subtotal,
                  emphasis: true,
                  note: repricing > 0
                      ? 'Excludes ${Numerals.quantity(repricing)} '
                          '${repricing == 1 ? 'line' : 'lines'} whose quantity '
                          'changed — those re-price at checkout.'
                      : null,
                )
              else
                const MoneyRow.absent(
                  label: 'Subtotal',
                  absentNote: 'Settled at checkout',
                  note: 'Every line is waiting to be re-priced, so there is no '
                      'figure this app can state without making one up.',
                ),
              Text(
                'VAT and delivery are added by the checkout quote. This '
                'subtotal is not the amount you will pay.',
                style: type.meta.copyWith(color: t.ink3),
              ),
              SizedBox(height: t.spaceStack),
              if (quoteOnly > 0) ...<Widget>[
                CommerceNotice(
                  tone: CommerceTone.warning,
                  icon: LucideIcons.handCoins,
                  title: '${Numerals.quantity(quoteOnly)} '
                      '${quoteOnly == 1 ? 'item is' : 'items are'} '
                      'quote-only',
                  body: 'These are priced by quotation and cannot be bought '
                      'outright, so checkout would be refused. Remove them or '
                      'ask the seller for a quote — the rest of the basket is '
                      'unaffected.',
                ),
                SizedBox(height: t.spaceStack),
              ],
              if (needsAttention > 0) ...<Widget>[
                CommerceNotice(
                  tone: CommerceTone.warning,
                  icon: LucideIcons.circleAlert,
                  title: '${Numerals.quantity(needsAttention)} '
                      '${needsAttention == 1 ? 'line needs' : 'lines need'} '
                      'attention before checkout',
                  body: 'Fix them above — a line below its minimum order '
                      'quantity, or one that went out of stock, is refused by '
                      'the checkout rather than quietly dropped.',
                ),
                SizedBox(height: t.spaceStack),
              ],
              KeyButton(
                label: 'Check out',
                size: KeyButtonSize.large,
                expand: true,
                trailingIcon: const Icon(LucideIcons.arrowRight),
                onPressed: cart.canCheckOut ? onCheckout : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
