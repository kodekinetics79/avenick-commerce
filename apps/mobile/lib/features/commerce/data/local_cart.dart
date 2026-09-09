import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/models/cart.dart';
import '../../../api/models/enums.dart';
import '../../../api/models/money.dart';
import 'commerce_gateways.dart';

/// THE CART IS DEVICE-LOCAL FOR v1.
///
/// `/v1/cart` is specified and not built — nothing on the server writes a
/// `Cart` or a `CartItem` row — so there is no basket to sync with and no
/// second device to sync it to. This holds the basket on the phone, and the
/// screen says so in words rather than implying a cross-device cart that would
/// silently lose a buyer's work when they picked up a laptop.
///
/// WHAT IT DOES NOT DO IS PRICE ANYTHING. Each line keeps the server-priced
/// `CartLine` it was added with. When the buyer changes the quantity, the
/// snapshot's `lineTotal` stops describing the line and this class says so —
/// it does not multiply. `CartLine`'s own doc is explicit about why:
///
///   "The app must NOT compute `unitPrice * qty` and show that: a tiered
///    product re-bands as the quantity crosses a rung, and the two answers
///    disagree at exactly the moment the buyer is watching."
@immutable
class LocalCartLine {
  const LocalCartLine({
    required this.snapshot,
    required this.qty,
    this.sellability = B2CSellability.unstated,
  });

  /// The line exactly as the catalogue priced it when it was added.
  final CartLine snapshot;

  /// What the buyer wants now — which may no longer be what [snapshot] costs.
  final int qty;

  /// Whether this product can still be BOUGHT, as of the last appraisal.
  ///
  /// Never persisted as truth and never trusted from the store: the flag lives
  /// on the server and can change after a line is saved, so `CartController`
  /// re-appraises every line on load and after every edit. See
  /// [B2CEligibility] for why the default is `unstated` rather than
  /// `sellable`.
  final B2CSellability sellability;

  String get id => snapshot.id;
  String get sellerId => snapshot.sellerId;
  String get sku => snapshot.sku;
  int get moq => snapshot.moq;
  Currency get currency => snapshot.currency;

  /// The unit price the server resolved. Still a true statement about one unit
  /// at the band it was priced in — which is why it stays on screen even while
  /// the line total does not.
  Money get unitPrice => snapshot.unitPriceMoney;

  /// True while the snapshot still describes this line.
  bool get isPricedAtCurrentQty => qty == snapshot.qty;

  /// The server's figure for this line, or NULL once the quantity has moved
  /// off the one it was priced at. Null means "the server has not said", and
  /// the UI renders that rather than a number this app made up.
  Money? get lineTotal => isPricedAtCurrentQty ? snapshot.lineTotalMoney : null;

  bool get repricesAtCheckout => !isPricedAtCurrentQty;

  /// The quantity ladder is live on this product, so the unit price itself
  /// moves with the quantity — not just the line total.
  bool get priceTiered => snapshot.priceTiered;

  bool get isBelowMoq => qty < moq;
  bool get isOutOfStock => snapshot.availability == Availability.outOfStock;

  /// The server would refuse an order containing this line.
  bool get isQuoteOnly => sellability == B2CSellability.quoteOnly;

  /// A line that would stop a checkout.
  bool get isBlocking => isBelowMoq || isOutOfStock || isQuoteOnly;

  String name(Language language) => snapshot.name(language);

  LocalCartLine withQty(int next) => LocalCartLine(
        snapshot: snapshot,
        qty: next,
        sellability: sellability,
      );

  LocalCartLine appraised(B2CSellability next) => LocalCartLine(
        snapshot: snapshot,
        qty: qty,
        sellability: next,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalCartLine &&
          other.snapshot == snapshot &&
          other.qty == qty &&
          other.sellability == sellability);

  @override
  int get hashCode => Object.hash(snapshot, qty, sellability);
}

/// One seller's lines, and the delivery they will arrive under.
///
/// A basket that touches three sellers becomes three shipments, so the cart is
/// grouped the way the parcels will be, not as one undifferentiated list.
@immutable
class SellerGroup {
  const SellerGroup({required this.sellerId, required this.lines});

  final String sellerId;
  final List<LocalCartLine> lines;

  /// The sum of the line totals the SERVER priced, or null when any line in
  /// the group is waiting to be re-priced.
  ///
  /// This is exact integer addition of `Money`, not arithmetic on a price:
  /// every term is a figure the server produced, and `Money.+` refuses to mix
  /// currencies. Returning null rather than a partial sum is the point — a
  /// group total that quietly omits a line is worse than no group total.
  Money? get subtotal {
    if (lines.isEmpty) return null;
    Money running = Money.zero(lines.first.currency);
    for (final LocalCartLine line in lines) {
      final Money? total = line.lineTotal;
      if (total == null) return null;
      if (total.currency != running.currency) return null;
      running += total;
    }
    return running;
  }

  int get repricingCount =>
      lines.where((LocalCartLine l) => l.repricesAtCheckout).length;
}

/// The basket on this device.
@immutable
class LocalCart {
  const LocalCart({required this.lines, required this.updatedAt});

  const LocalCart.empty()
      : lines = const <LocalCartLine>[],
        updatedAt = null;

  final List<LocalCartLine> lines;
  final DateTime? updatedAt;

  bool get isEmpty => lines.isEmpty;

  /// LINES, not units — the same contract the tab-bar badge counts on.
  int get lineCount => lines.length;

  Currency? get currency => lines.isEmpty ? null : lines.first.currency;

  /// A basket that somehow collected two currencies. `Money` refuses to add
  /// across currencies rather than invent a rate, so the subtotal disappears
  /// and the screen says why.
  bool get hasMixedCurrency =>
      lines.any((LocalCartLine l) => l.currency != currency);

  /// Grouped by seller, in the order the sellers first appear in the basket —
  /// stable, so a quantity edit does not reshuffle the screen under the thumb.
  List<SellerGroup> get groups {
    final List<String> order = <String>[];
    final Map<String, List<LocalCartLine>> bySeller =
        <String, List<LocalCartLine>>{};
    for (final LocalCartLine line in lines) {
      final List<LocalCartLine> bucket =
          bySeller.putIfAbsent(line.sellerId, () {
        order.add(line.sellerId);
        return <LocalCartLine>[];
      });
      bucket.add(line);
    }
    return <SellerGroup>[
      for (final String sellerId in order)
        SellerGroup(sellerId: sellerId, lines: bySeller[sellerId]!),
    ];
  }

  /// The sum of every line total the server has actually stated.
  ///
  /// Null when the basket is empty, when it mixes currencies, or when nothing
  /// is priced at its current quantity. When [repricingLineCount] is above
  /// zero this figure is a subtotal of PART of the basket and the screen must
  /// say so — see `CartScreen`.
  Money? get knownSubtotal {
    if (lines.isEmpty || hasMixedCurrency) return null;
    Money running = Money.zero(currency!);
    bool any = false;
    for (final LocalCartLine line in lines) {
      final Money? total = line.lineTotal;
      if (total == null) continue;
      running += total;
      any = true;
    }
    return any ? running : null;
  }

  int get repricingLineCount =>
      lines.where((LocalCartLine l) => l.repricesAtCheckout).length;

  List<LocalCartLine> get blockingLines =>
      lines.where((LocalCartLine l) => l.isBlocking).toList(growable: false);

  /// Lines the server has said can no longer be bought outright.
  ///
  /// A distinct list from [blockingLines] because it is a distinct problem
  /// with a distinct fix: a line below its MOQ is raised, an out-of-stock line
  /// is removed, and a quote-only line is taken to a quote. Folding the three
  /// together produces the unexplained "checkout refused" the buyer cannot act
  /// on.
  List<LocalCartLine> get quoteOnlyLines =>
      lines.where((LocalCartLine l) => l.isQuoteOnly).toList(growable: false);

  bool get hasQuoteOnlyLines => quoteOnlyLines.isNotEmpty;

  bool get canCheckOut => lines.isNotEmpty && blockingLines.isEmpty;

  LocalCart withLines(List<LocalCartLine> next, {required DateTime at}) =>
      LocalCart(lines: List<LocalCartLine>.unmodifiable(next), updatedAt: at);
}

/// Where the device-local basket is kept between launches.
///
/// A port, not an implementation, because durable storage is a dependency this
/// feature does not own. The default keeps the basket for the life of the
/// process, which is honest about what it is; a disk-backed implementation
/// drops in without touching a screen.
abstract interface class CartStore {
  Future<LocalCart> load();
  Future<void> save(LocalCart cart);
}

/// The default store: the basket lives as long as the app process does.
class InMemoryCartStore implements CartStore {
  InMemoryCartStore([LocalCart? seed]) : _cart = seed ?? const LocalCart.empty();

  LocalCart _cart;

  @override
  Future<LocalCart> load() async => _cart;

  @override
  Future<void> save(LocalCart cart) async {
    _cart = cart;
  }
}

final Provider<CartStore> cartStoreProvider =
    Provider<CartStore>((Ref ref) => InMemoryCartStore());

/// The basket, and every edit to it.
/// What happened to an `add`.
enum CartAddOutcome {
  added,

  /// Refused: the product is quote-only, and an order containing it would be
  /// refused by the server. The guard is HERE, in the state layer, and not in
  /// the screen — a deep link, a restored basket or another feature calling
  /// `add` all pass through this one door.
  refusedQuoteOnly,
}

class CartController extends AsyncNotifier<LocalCart> {
  @override
  Future<LocalCart> build() async {
    final LocalCart stored = await ref.watch(cartStoreProvider).load();
    // A persisted basket is re-appraised on the way in. The flag lives on the
    // server and can flip after a line was saved, so what was sellable last
    // week is not evidence about today.
    return _appraise(stored);
  }

  /// Re-run every line past [B2CEligibility].
  LocalCart _appraise(LocalCart cart) {
    final B2CEligibility eligibility = ref.read(b2cEligibilityProvider);
    return LocalCart(
      lines: <LocalCartLine>[
        for (final LocalCartLine line in cart.lines)
          line.appraised(eligibility.of(line.snapshot)),
      ],
      updatedAt: cart.updatedAt,
    );
  }

  Future<void> _commit(List<LocalCartLine> next) async {
    final LocalCart updated = _appraise(
      (state.value ?? const LocalCart.empty())
          .withLines(next, at: DateTime.now().toUtc()),
    );
    state = AsyncData<LocalCart>(updated);
    await ref.read(cartStoreProvider).save(updated);
  }

  List<LocalCartLine> get _lines =>
      List<LocalCartLine>.of(state.value?.lines ?? const <LocalCartLine>[]);

  /// Add a server-priced line, or raise the one already in the basket.
  ///
  /// REFUSES a quote-only product outright. `orders.ts` rejects a B2C order
  /// containing one, so letting it into the basket only moves the refusal to
  /// the last step of a purchase — and the buyer would have entered an address
  /// by then.
  Future<CartAddOutcome> add(CartLine line) async {
    final B2CSellability sellability =
        ref.read(b2cEligibilityProvider).of(line);
    if (sellability == B2CSellability.quoteOnly) {
      return CartAddOutcome.refusedQuoteOnly;
    }
    final List<LocalCartLine> next = _lines;
    final int at = next.indexWhere((LocalCartLine l) => l.id == line.id);
    if (at >= 0) {
      next[at] = next[at].withQty(next[at].qty + line.qty);
    } else {
      next.add(
        LocalCartLine(snapshot: line, qty: line.qty, sellability: sellability),
      );
    }
    await _commit(next);
    return CartAddOutcome.added;
  }

  /// Set an absolute quantity.
  ///
  /// It does NOT clamp to the MOQ. A stepper that silently bounces a buyer's
  /// 4 back up to 25 is a screen arguing with the person using it; the floor
  /// is enforced by the stepper's own minus button, and a line that is already
  /// below its minimum gets a stated fix-it action instead.
  Future<void> setQuantity({required String lineId, required int qty}) async {
    if (qty < 1) return;
    final List<LocalCartLine> next = _lines;
    final int at = next.indexWhere((LocalCartLine l) => l.id == lineId);
    if (at < 0) return;
    if (next[at].qty == qty) return;
    next[at] = next[at].withQty(qty);
    await _commit(next);
  }

  /// The fix-it: take this line up to its minimum, because the buyer asked.
  Future<void> raiseToMoq(String lineId) async {
    final List<LocalCartLine> next = _lines;
    final int at = next.indexWhere((LocalCartLine l) => l.id == lineId);
    if (at < 0) return;
    await setQuantity(lineId: lineId, qty: next[at].moq);
  }

  Future<void> remove(String lineId) async {
    final List<LocalCartLine> next = _lines
      ..removeWhere((LocalCartLine l) => l.id == lineId);
    await _commit(next);
  }

  Future<void> clear() => _commit(<LocalCartLine>[]);
}

final AsyncNotifierProvider<CartController, LocalCart> cartControllerProvider =
    AsyncNotifierProvider<CartController, LocalCart>(CartController.new);

/// Lines, not units — ready to be handed to `cartLineCountProvider` in
/// `lib/app/tab_scaffold.dart`, which the CTO owns.
final Provider<int> localCartLineCountProvider = Provider<int>(
  (Ref ref) => ref.watch(cartControllerProvider).value?.lineCount ?? 0,
);
