import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/catalogue.dart';
import '../../../api/models/enums.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../catalogue_context.dart';
import '../data/display_price.dart';
import 'availability_label.dart';

/// Pick a variant. A bottom sheet, because a variant list is a short,
/// reversible choice made in the middle of reading the product page — the same
/// shape of decision as the sort, and the opposite of the facet screen.
///
/// It is `isScrollControlled` and capped at 80% of the viewport, because a
/// product with twenty variants is real and a sheet that grows past the screen
/// is a sheet with no visible edge.
///
/// ## What is shown per row, and why all of it
///
/// A variant carries its OWN price bands, its OWN availability and its OWN
/// stock figure. A picker that shows only the option name — "220V", "XL" —
/// makes the buyer choose blind and then discover on the page behind that the
/// one they picked is out of stock at a different price. All three travel on
/// the row.
///
/// Out-of-stock variants stay selectable. Selecting one is how the buyer sees
/// what it would cost and decides whether to wait; disabling it hides the price
/// they came to compare.
Future<ProductVariant?> showVariantSheet(
  BuildContext context, {
  required ProductDetail product,
  required ProductVariant? selected,
  required Currency? currency,
  required int quantity,
}) {
  return showModalBottomSheet<ProductVariant>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    constraints: BoxConstraints(
      maxHeight: MediaQuery.sizeOf(context).height * 0.8,
    ),
    builder: (BuildContext context) => _VariantSheet(
      product: product,
      selected: selected,
      currency: currency,
      quantity: quantity,
    ),
  );
}

class _VariantSheet extends StatelessWidget {
  const _VariantSheet({
    required this.product,
    required this.selected,
    required this.currency,
    required this.quantity,
  });

  final ProductDetail product;
  final ProductVariant? selected;
  final Currency? currency;
  final int quantity;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: EdgeInsetsDirectional.only(top: t.spaceTight),
            child: Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: t.border,
                  borderRadius: BorderRadius.circular(t.radiusPill),
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(
              t.spaceStack,
              t.spaceStack,
              t.spaceStack,
              t.spaceTight,
            ),
            child: Semantics(
              header: true,
              child: Text('Choose an option', style: type.h3),
            ),
          ),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: EdgeInsetsDirectional.only(bottom: t.spaceStack),
              itemCount: product.variants.length,
              separatorBuilder: (BuildContext context, int i) =>
                  Divider(height: 1, color: t.hairline),
              itemBuilder: (BuildContext context, int index) {
                final ProductVariant variant = product.variants[index];
                return _VariantRow(
                  variant: variant,
                  selected: variant.id == selected?.id,
                  currency: currency,
                  channel: product.channel,
                  quantity: quantity,
                  onTap: () => Navigator.of(context).pop(variant),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _VariantRow extends StatelessWidget {
  const _VariantRow({
    required this.variant,
    required this.selected,
    required this.currency,
    required this.channel,
    required this.quantity,
    required this.onTap,
  });

  final ProductVariant variant;
  final bool selected;
  final Currency? currency;
  final Channel channel;
  final int quantity;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final Language language = languageOf(context);
    final String name = language == Language.ar
        ? variant.nameAr ?? variant.nameEn
        : variant.nameEn;

    final Currency? c = currency ??
        (variant.prices.isEmpty ? null : variant.prices.first.currency);
    final PriceBand? band = c == null
        ? null
        : variant.bandFor(
            quantity: quantity,
            channel: channel,
            currency: c,
          );

    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      label: <String>[
        name,
        variant.sku,
        if (band != null) MoneyFormat.format(DisplayPrice.fromBand(band).gross),
        _availabilityWords(variant.availability),
      ].join(', '),
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        splashFactory: NoSplash.splashFactory,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTouchTarget),
          child: Padding(
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: t.spaceStack,
              vertical: t.spaceTight + t.spaceUnit,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(
                        name,
                        style: type.body.copyWith(
                          color: selected ? t.primaryInk : t.ink1,
                        ),
                      ),
                      SizedBox(height: t.spaceUnit / 2),
                      // The SKU is the string on the invoice, in the warehouse
                      // scanner and in the carrier's portal. It is isolated so
                      // it comes out of an Arabic paragraph exactly as stored.
                      DirectionalText.token(
                        variant.sku,
                        kind: LtrToken.sku,
                        style: type.micro.copyWith(color: t.ink3),
                      ),
                      if (variant.attributes.isNotEmpty) ...<Widget>[
                        SizedBox(height: t.spaceUnit / 2),
                        Text(
                          _attributeSummary(variant.attributes),
                          style: type.meta.copyWith(color: t.ink2),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      SizedBox(height: t.spaceTight),
                      Row(
                        children: <Widget>[
                          AvailabilityLabel(
                            availability: variant.availability,
                            availableQty: variant.availableQty,
                            compact: true,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                SizedBox(width: t.spaceTight),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      band == null
                          ? 'On request'
                          : Bidi.ltr(
                              MoneyFormat.format(
                                DisplayPrice.fromBand(band).gross,
                              ),
                            ),
                      style: type.ui.copyWith(color: t.ink1),
                    ),
                    if (selected) ...<Widget>[
                      SizedBox(height: t.spaceUnit),
                      Icon(LucideIcons.check, size: 18, color: t.primaryInk),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// `{"size": "XL", "voltage": 220}` → `size: XL · voltage: 220`.
  ///
  /// The values arrive as `Object?` because the contract admits string, number
  /// or boolean, and they are printed through [Numerals] rather than
  /// interpolated: `220` decoded as a JSON number is a Dart `double`, and
  /// `'$value'` would print `220.0` on a spec line.
  static String _attributeSummary(Map<String, Object?> attributes) {
    final List<String> parts = <String>[];
    attributes.forEach((String key, Object? value) {
      parts.add('$key: ${_formatValue(value)}');
    });
    return parts.join(' · ');
  }

  static String _formatValue(Object? value) {
    if (value == null) return '—';
    if (value is bool) return value ? 'Yes' : 'No';
    if (value is int) return Numerals.integer(value);
    if (value is double) {
      return value == value.roundToDouble()
          ? Numerals.integer(value.round())
          : Numerals.decimal(value, fractionDigits: 2);
    }
    return Numerals.toWestern(value.toString());
  }

  static String _availabilityWords(Availability availability) =>
      switch (availability) {
        Availability.inStock => 'in stock',
        Availability.outOfStock => 'out of stock',
        Availability.unconfirmed => 'stock not confirmed',
      };
}
