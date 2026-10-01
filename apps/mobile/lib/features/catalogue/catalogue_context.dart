import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/models/enums.dart';
import '../../app/routes.dart';

/// Small, shared readings of the ambient context that three or more catalogue
/// surfaces each need, gathered so they cannot drift apart.

/// The language to resolve `nameEn` / `nameAr` with.
///
/// Read from [Localizations], not from a setting: both strings travel on every
/// card precisely so a language switch is a rebuild and not a refetch, and the
/// only thing that changes on a switch is this.
Language languageOf(BuildContext context) =>
    (Localizations.maybeLocaleOf(context) ?? const Locale('en')).languageCode ==
            'ar'
        ? Language.ar
        : Language.en;

/// The text scale factor currently in force, as a plain multiplier.
double textScaleOf(BuildContext context) =>
    MediaQuery.textScalerOf(context).scale(1.0);

/// Above this scale the product grid collapses to one column.
///
/// 1.6× is where a two-column card can no longer hold "AED 1,234.50" on one
/// line at `figCard` beside a two-line product name. Past that point the choice
/// is a taller single column or a truncated price, and a truncated price is the
/// worse failure by a distance: a name that ellipsises is still a name, a price
/// that ellipsises is a different number.
const double kSingleColumnTextScale = 1.6;

/// How many columns the product grid should run at.
///
/// [width] is the width the grid ACTUALLY gets, which is not always the screen
/// width — a sliver inside padding, a split view, a tablet master/detail. Pass
/// it wherever a real measurement is available; the [MediaQuery] fallback is
/// for callers laying out before constraints exist.
int gridColumnsFor(BuildContext context, {double? width}) {
  if (textScaleOf(context) > kSingleColumnTextScale) return 1;
  final double w = width ?? MediaQuery.sizeOf(context).width;
  // 600 and 900 are the standard Material breakpoints for a phone, a tablet in
  // portrait and a tablet in landscape. Cards do not get wider past them; there
  // are simply more of them.
  if (w >= 900) return 4;
  if (w >= 600) return 3;
  return 2;
}

/// The smallest square a finger can reliably hit.
///
/// Flutter's own constant rather than a token or a literal: 48dp is a platform
/// accessibility floor from the Material and WCAG target-size guidance, not a
/// design-system decision, and `MeridianTokens` correctly has no opinion about
/// it. Note that `rowH` (44) and `controlHLg` (46) are both BELOW it, so any
/// icon-only control built from those needs padding out to here.
const double kMinTouchTarget = kMinInteractiveDimension;

/// Push the product page. Slug, not id — the same path the web serves, so a
/// link out of a WhatsApp share resolves without a lookup.
void openProduct(BuildContext context, String slug) =>
    GoRouter.of(context).push(Routes.productOf(slug));

/// Push a taxonomy node.
void openCategory(BuildContext context, String slug) =>
    GoRouter.of(context).push(Routes.categoryOf(slug));

/// The route the "Request a quote" action expects.
///
/// **Not in `lib/app/routes.dart` yet** — that file is the router owner's, and
/// there is no RFQ endpoint on the `/v1` contract either. The constant lives
/// here so there is exactly one string to move when the route is wired, and so
/// this feature can be grepped for what it expects rather than guessed at.
///
/// Shape: `/rfq/new?productId=<id>&slug=<slug>&qty=<n>`.
///
/// All three are carried because each answers a case the others cannot:
///
///  * `productId` is what `POST /v1/rfqs` wants — `RfqLineInputSchema` takes
///    `{ productId?, nameEn?, quantity }`.
///  * `slug` is the fallback for the one screen that most needs this action and
///    has no id: a deep link that 404s *because* the product is not sold on
///    this channel never received a product body at all.
///  * `qty` is the quantity from the buy box. An RFQ line requires one, and the
///    buyer has already chosen it — asking again on the next screen is asking
///    them to repeat themselves.
const String kRequestQuoteRoute = '/rfq/new';

/// Open the quote request for a product.
///
/// The RFQ form is out of this feature's scope and is not built here.
void openQuoteRequest(
  BuildContext context, {
  String? productId,
  required String slug,
  int? quantity,
}) {
  final Uri uri = Uri(
    path: kRequestQuoteRoute,
    queryParameters: <String, String>{
      if (productId != null) 'productId': productId,
      'slug': slug,
      if (quantity != null) 'qty': '$quantity',
    },
  );
  GoRouter.of(context).push(uri.toString());
}
