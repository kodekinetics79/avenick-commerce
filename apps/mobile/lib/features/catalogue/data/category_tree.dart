import 'package:flutter/foundation.dart' show immutable;

import '../../../api/models/catalogue.dart';

/// The taxonomy, assembled.
///
/// `GET /v1/categories` returns the whole tree FLAT and unpaginated —
/// deliberately, because a half-loaded navigation tree is worse than a slightly
/// larger response — with the nesting expressed as `parentId` and `depth`.
/// Assembling it is therefore the client's job, and doing it once here beats
/// three screens each writing their own `where((c) => c.parentId == id)`.
///
/// The child order is the server's order, preserved. Sorting by name here would
/// silently discard whatever merchandising order the taxonomy carries, and
/// nothing in the response says whether it has one.
@immutable
class CategoryTree {
  CategoryTree(this.all)
      : _bySlug = <String, Category>{for (final Category c in all) c.slug: c},
        _byId = <String, Category>{for (final Category c in all) c.id: c},
        _children = _groupChildren(all);

  const CategoryTree._empty()
      : all = const <Category>[],
        _bySlug = const <String, Category>{},
        _byId = const <String, Category>{},
        _children = const <String, List<Category>>{};

  /// An empty taxonomy — a real state on a fresh tenant, not an error.
  static const CategoryTree empty = CategoryTree._empty();

  /// Every node, in server order.
  final List<Category> all;

  final Map<String, Category> _bySlug;
  final Map<String, Category> _byId;
  final Map<String, List<Category>> _children;

  static Map<String, List<Category>> _groupChildren(List<Category> all) {
    final Map<String, List<Category>> out = <String, List<Category>>{};
    for (final Category c in all) {
      final String? parent = c.parentId;
      if (parent == null) continue;
      (out[parent] ??= <Category>[]).add(c);
    }
    return out;
  }

  bool get isEmpty => all.isEmpty;

  /// The top of the tree — what the home strip shows.
  List<Category> get roots =>
      all.where((Category c) => c.isRoot).toList(growable: false);

  Category? bySlug(String slug) => _bySlug[slug];
  Category? byId(String id) => _byId[id];

  List<Category> childrenOf(String categoryId) =>
      _children[categoryId] ?? const <Category>[];

  /// Root → … → node, for a breadcrumb and for the "up one level" action.
  ///
  /// Walks by `parentId` with a hop budget, because a cycle in the taxonomy —
  /// which the flat wire shape cannot rule out — would otherwise hang the
  /// screen rather than render a slightly short breadcrumb.
  List<Category> ancestryOf(Category node) {
    final List<Category> chain = <Category>[node];
    String? parentId = node.parentId;
    int hops = 0;
    while (parentId != null && hops < 32) {
      final Category? parent = _byId[parentId];
      if (parent == null) break;
      chain.insert(0, parent);
      parentId = parent.parentId;
      hops++;
    }
    return chain;
  }

  /// Categories carrying at least one product, for a facet list.
  ///
  /// A zero-count node is still RETURNED, not filtered out — the filter screen
  /// shows it disabled with its `0`. A facet that vanishes reads as a bug in
  /// the app rather than as an empty shelf, and the user has no way to tell
  /// which it was.
  List<Category> facetCandidates() =>
      all.where((Category c) => c.depth <= 1).toList(growable: false);
}
