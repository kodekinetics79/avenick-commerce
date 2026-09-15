import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../api/models/order.dart';
import '../../../core/network/page.dart';
import '../data/commerce_gateways.dart';

/// Order history, one cursor page at a time.
///
/// There is no total and no page count on this endpoint — see `envelope.ts`:
/// counting cost more on the connection pool than a scrolling list was worth,
/// so `hasMore` is the only question the server answers and [hasMore] is the
/// only one this asks.
class OrdersController extends AsyncNotifier<List<OrderCard>> {
  String? _cursor;
  bool _hasMore = true;

  /// True until the server says otherwise — including before the first page,
  /// because "nothing loaded" is not "nothing left".
  bool get hasMore => _hasMore;

  @override
  Future<List<OrderCard>> build() async {
    final Page<OrderCard> page = await ref.read(ordersGatewayProvider).orders();
    _cursor = page.nextCursor;
    _hasMore = page.hasMore;
    return page.items;
  }

  /// Append the next page.
  ///
  /// Returns the failure rather than throwing it into the screen's state: a
  /// page-two failure must not blank out page one, which is what setting
  /// `state = AsyncError` would do to a list the buyer is reading.
  Future<Object?> loadMore() async {
    final String? cursor = _cursor;
    if (!_hasMore || cursor == null) return null;
    final List<OrderCard> current =
        state.value ?? const <OrderCard>[];
    try {
      final Page<OrderCard> page =
          await ref.read(ordersGatewayProvider).orders(cursor: cursor);
      _cursor = page.nextCursor;
      _hasMore = page.hasMore;
      state = AsyncData<List<OrderCard>>(<OrderCard>[
        ...current,
        ...page.items,
      ]);
      return null;
    } catch (error) {
      return error;
    }
  }
}

final AsyncNotifierProvider<OrdersController, List<OrderCard>>
    ordersControllerProvider =
    AsyncNotifierProvider<OrdersController, List<OrderCard>>(
  OrdersController.new,
);

/// One order in full.
///
/// A family rather than a single provider so that two orders open from a push
/// notification and a list tap do not overwrite each other's cache entry.
// The concrete family type is not exported from flutter_riverpod, so this one
// declaration is inferred rather than annotated.
final orderDetailProvider = FutureProvider.family<OrderDetail, String>(
  (Ref ref, String id) => ref.read(ordersGatewayProvider).order(id),
);
