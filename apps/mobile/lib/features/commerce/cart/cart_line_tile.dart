import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/common.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/local_cart.dart';
import '../shared/commerce_ui.dart';

/// One line of the basket.
///
/// The tile owns three decisions that are easy to get wrong and expensive to
/// get wrong quietly:
///
/// 1. **The minus button stops at the MOQ.** It does not step to 1 and then
///    bounce back, and it does not disappear. It disables, and the reason is
///    on screen next to it.
///
/// 2. **A line that is ALREADY below its minimum is not corrected for you.**
///    That happens when a seller raises the MOQ after the line was added. The
///    tile states the minimum, states what the line holds, and offers a button
///    that raises it — one tap, but the buyer's tap. Silently rewriting a
///    quantity is how a basket of 4 becomes an order for 25.
///
/// 3. **The line total disappears when the quantity moves.** It is the
///    server's figure for the quantity the server priced. Multiplying it — or
///    the unit price — would produce a number that disagrees with the checkout
///    quote for any tiered product, at the exact moment the buyer is watching.
class CartLineTile extends StatelessWidget {
  const CartLineTile({
    required this.line,
    required this.language,
    required this.onQuantityChanged,
    required this.onRemove,
    required this.onRaiseToMoq,
    this.onRequestQuote,
    super.key,
  });

  final LocalCartLine line;
  final Language language;
  final ValueChanged<int> onQuantityChanged;
  final VoidCallback onRemove;
  final VoidCallback onRaiseToMoq;

  /// Where "ask for a quote" goes for a line that can no longer be bought
  /// outright. Null omits the action rather than offering a button that goes
  /// nowhere.
  final VoidCallback? onRequestQuote;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Padding(
      padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceTight),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _Thumb(image: line.snapshot.image),
              SizedBox(width: t.spaceStack),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      line.name(language),
                      style: type.ui,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: t.spaceUnit),
                    DirectionalText.token(
                      line.sku,
                      kind: LtrToken.sku,
                      style: type.meta.copyWith(color: t.ink3),
                    ),
                    SizedBox(height: t.spaceTight),
                    _UnitPrice(line: line),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: t.spaceTight),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: t.spaceStack,
            runSpacing: t.spaceTight,
            children: <Widget>[
              _QuantityStepper(
                qty: line.qty,
                moq: line.moq,
                onChanged: onQuantityChanged,
              ),
              _LineTotal(line: line),
            ],
          ),
          if (line.isQuoteOnly) ...<Widget>[
            SizedBox(height: t.spaceTight),
            CommerceNotice(
              tone: CommerceTone.warning,
              icon: LucideIcons.handCoins,
              title: 'This item is quote-only now',
              body: '${line.name(language)} can no longer be bought outright '
                  '— the seller prices it by quotation. An order containing it '
                  'would be refused, so it has been kept here and flagged '
                  'rather than dropped out of the basket.',
              actions: <Widget>[
                KeyButton(
                  label: 'Remove it',
                  size: KeyButtonSize.small,
                  tone: KeyButtonTone.ghost,
                  expand: true,
                  semanticLabel: 'Remove ${line.name(language)}',
                  onPressed: onRemove,
                ),
                if (onRequestQuote != null)
                  KeyButton(
                    label: 'Ask for a quote',
                    size: KeyButtonSize.small,
                    tone: KeyButtonTone.accent,
                    expand: true,
                    onPressed: onRequestQuote,
                  ),
              ],
            ),
          ],
          if (line.isBelowMoq) ...<Widget>[
            SizedBox(height: t.spaceTight),
            CommerceNotice(
              tone: CommerceTone.warning,
              icon: LucideIcons.triangleAlert,
              title: 'Below the minimum order for this product',
              body: 'This seller ships this item in units of '
                  '${Numerals.quantity(line.moq)} or more. The line holds '
                  '${Numerals.quantity(line.qty)}.',
              action: KeyButton(
                label: 'Raise to ${Numerals.quantity(line.moq)}',
                size: KeyButtonSize.small,
                tone: KeyButtonTone.accent,
                expand: true,
                onPressed: onRaiseToMoq,
              ),
            ),
          ],
          if (line.isOutOfStock) ...<Widget>[
            SizedBox(height: t.spaceTight),
            CommerceNotice(
              tone: CommerceTone.danger,
              icon: LucideIcons.packageX,
              title: 'Out of stock',
              body: 'It went out of stock after it was added. Remove it to '
                  'check out with the rest of the basket.',
              action: KeyButton(
                label: 'Remove',
                size: KeyButtonSize.small,
                tone: KeyButtonTone.ghost,
                expand: true,
                onPressed: onRemove,
              ),
            ),
          ],
          SizedBox(height: t.spaceUnit),
          InlineKeyAction(
            maxWidth: 160,
            child: KeyButton(
              label: 'Remove',
              size: KeyButtonSize.small,
              tone: KeyButtonTone.ghost,
              expand: true,
              icon: const Icon(LucideIcons.trash2),
              semanticLabel: 'Remove ${line.name(language)}',
              onPressed: onRemove,
            ),
          ),
        ],
      ),
    );
  }
}

/// The unit price, and whether it is going to move.
class _UnitPrice extends StatelessWidget {
  const _UnitPrice({required this.line});

  final LocalCartLine line;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        MoneyText(
          line.unitPrice,
          style: type.body.copyWith(color: t.ink2),
        ),
        Text('each', style: type.meta.copyWith(color: t.ink3)),
        if (line.priceTiered)
          Padding(
            padding: EdgeInsetsDirectional.only(top: t.spaceUnit),
            child: Text(
              'Tiered price — the unit price changes with the quantity.',
              style: type.meta.copyWith(color: t.ink3),
            ),
          ),
      ],
    );
  }
}

/// The line total, or an honest absence of one.
class _LineTotal extends StatelessWidget {
  const _LineTotal({required this.line});

  final LocalCartLine line;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Money? total = line.lineTotal;

    if (total == null) {
      return ConstrainedBox(
        constraints: BoxConstraints(maxWidth: t.measureDesc),
        child: Text(
          'Re-priced at checkout',
          style: type.meta.copyWith(color: t.ink3),
        ),
      );
    }
    return MoneyText(total, style: type.figCard);
  }
}

/// The quantity control.
///
/// The floor is the MOQ, not 1. A B2B line with a minimum of 25 that can be
/// stepped down to 24 is a control that lets the buyer build a basket the
/// checkout will refuse.
class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.qty,
    required this.moq,
    required this.onChanged,
  });

  final int qty;
  final int moq;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final int floor = moq < 1 ? 1 : moq;
    final bool canDecrease = qty > floor;

    return Semantics(
      container: true,
      value: Numerals.quantity(qty),
      child: MeridianSurface(
        rung: MeridianRung.recessed,
        radius: t.radiusPill,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _StepButton(
              icon: LucideIcons.minus,
              semanticLabel: canDecrease
                  ? 'Decrease quantity'
                  : 'Minimum order is ${Numerals.quantity(floor)}',
              onPressed: canDecrease ? () => onChanged(qty - 1) : null,
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 44),
              child: Text(
                Numerals.quantity(qty),
                style: type.figCard.copyWith(fontSize: type.ui.fontSize),
                textAlign: TextAlign.center,
              ),
            ),
            _StepButton(
              icon: LucideIcons.plus,
              semanticLabel: 'Increase quantity',
              onPressed: () => onChanged(qty + 1),
            ),
          ],
        ),
      ),
    );
  }
}

/// A 48dp square that is not a Material button.
///
/// `IconButton` brings a ripple with it, and a ripple is the wrong physical
/// story for this design system — see the header of `key_button.dart`. What
/// this keeps from Material is the part that matters: the hit box.
class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.semanticLabel,
    required this.onPressed,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final bool enabled = onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox(
          width: kMinTouchTarget,
          height: kMinTouchTarget,
          child: Center(
            child: Icon(
              icon,
              size: 18,
              color: enabled ? t.ink1 : t.ink3,
            ),
          ),
        ),
      ),
    );
  }
}

/// The line's picture, or the plate it would have sat on.
///
/// `Image.network` rather than `CachedNetworkImage` on purpose: the cache
/// manager reaches for a temporary directory through a platform channel, which
/// is not available in a widget test, so every screen that showed a thumbnail
/// would be untestable. The plate is the placeholder, the error state and the
/// no-image state at once — three ways of saying "there is no picture" that
/// should not look like three different bugs.
class _Thumb extends StatelessWidget {
  const _Thumb({required this.image});

  final ImageRef? image;

  static const double _size = 64.0;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final ImageRef? ref = image;

    final Widget plate = SizedBox(
      width: _size,
      height: _size,
      child: Center(
        child: Icon(LucideIcons.package, size: 22, color: t.ink3),
      ),
    );

    return MeridianSurface(
      rung: MeridianRung.recessed,
      radius: t.radiusSm,
      clipContent: true,
      child: SizedBox(
        width: _size,
        height: _size,
        child: ref == null
            ? plate
            : Image.network(
                ref.url,
                width: _size,
                height: _size,
                fit: BoxFit.cover,
                semanticLabel: ref.alt,
                errorBuilder: (BuildContext context, Object error, StackTrace? s) =>
                    plate,
              ),
      ),
    );
  }
}
