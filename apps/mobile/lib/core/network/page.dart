import 'package:freezed_annotation/freezed_annotation.dart';

import '../../api/models/common.dart';

/// One page of a cursor-paginated collection: the items, and the `meta` block
/// that says whether there is another page and where it starts.
@immutable
class Page<T> {
  const Page({required this.items, required this.meta});

  const Page.last(this.items) : meta = PageMeta.end;

  final List<T> items;
  final PageMeta meta;

  bool get hasMore => meta.hasMore;

  /// The value to send as `?cursor=` for the next page, or null if this is the
  /// last one. Opaque — echo it back byte for byte.
  String? get nextCursor => meta.nextCursor;

  bool get isEmpty => items.isEmpty;
  int get length => items.length;

  Page<R> map<R>(R Function(T item) transform) =>
      Page<R>(items: items.map(transform).toList(growable: false), meta: meta);

  @override
  String toString() => 'Page(${items.length} items, hasMore: $hasMore)';
}

/// Walks a cursor-paginated endpoint one page at a time.
///
/// It exists so that no screen has to remember the two rules that make cursor
/// pagination behave:
///
///  1. The cursor is only meaningful while `hasMore` is true. A client that
///     keeps sending the last cursor it saw after the server said there is no
///     more will loop over the final page forever.
///  2. Two [loadNext] calls must not overlap. A list view fires one from
///     `onScroll` and another from a `RefreshIndicator` without much
///     difficulty, and two in-flight requests with the same cursor append the
///     same rows twice. [isLoading] and the shared in-flight future make the
///     second call a no-op instead.
///
/// There is deliberately no total and no page count — see `envelope.ts`: the
/// endpoint does not send one, because counting cost more than it was worth on
/// the pool checkout runs against.
class CursorPager<T> {
  CursorPager({required this.fetch});

  /// Fetch one page. `cursor` is null for the first.
  final Future<Page<T>> Function({String? cursor}) fetch;

  final List<T> _items = <T>[];
  String? _cursor;
  bool _hasMore = true;
  bool _started = false;
  Future<void>? _inFlight;

  /// Everything loaded so far, in server order.
  List<T> get items => List<T>.unmodifiable(_items);

  /// True until the server says otherwise. True before the first fetch,
  /// because "no pages loaded" is not "no more pages".
  bool get hasMore => _hasMore;

  bool get isLoading => _inFlight != null;
  bool get hasLoadedFirstPage => _started && _inFlight == null;

  /// Load the next page, or return immediately if one is in flight or the
  /// server has said there is nothing more.
  Future<void> loadNext() {
    final existing = _inFlight;
    if (existing != null) return existing;
    if (_started && !_hasMore) return Future<void>.value();

    final started = _load();
    _inFlight = started;
    return started.whenComplete(() {
      if (identical(_inFlight, started)) _inFlight = null;
    });
  }

  Future<void> _load() async {
    final page = await fetch(cursor: _started ? _cursor : null);
    _items.addAll(page.items);
    _cursor = page.nextCursor;
    _hasMore = page.hasMore;
    _started = true;
  }

  /// Throw away everything and start from the first page. Used by
  /// pull-to-refresh and by a filter change — a new filter invalidates a
  /// cursor that was minted against the old one.
  Future<void> refresh() async {
    _items.clear();
    _cursor = null;
    _hasMore = true;
    _started = false;
    await loadNext();
  }
}
