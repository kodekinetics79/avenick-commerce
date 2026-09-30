import 'package:flutter_riverpod/flutter_riverpod.dart';
// The *Family types are `@publicInMisc` in Riverpod 3 and are not re-exported
// from the flutter_riverpod barrel. Naming a family's type explicitly is worth
// the extra import: an inferred `final x = …` hides which of a dozen provider
// kinds each of these is at the one place it matters.
import 'package:riverpod/misc.dart' show FutureProviderFamily;

import '../../../api/models/enums.dart';
import '../../../api/models/rfq.dart';
import 'quoted_product.dart';
import 'rfq_repository.dart';

/// THE FEATURE'S PROVIDER GRAPH.
///
/// Four seams, and only the first is mandatory. See the header of
/// `lib/features/rfq/rfq.dart` for the composition-root snippet.

/// `POST/GET /v1/rfqs` and friends.
///
/// **Must be overridden.** The default throws rather than returning empty
/// data: an RFQ list that renders "no quote requests yet" because nobody wired
/// the client is a first-run screen shown to a buyer with a dozen live quotes,
/// and it looks completely correct in a screenshot.
final Provider<RfqRepository> rfqRepositoryProvider = Provider<RfqRepository>(
  (Ref ref) => throw const RfqNotWired('rfqRepositoryProvider'),
);

/// Where the quote form resolves the product being quoted.
///
/// Optional. The honest default answers null for everything, which the form
/// renders as a free-text request rather than as an error — see
/// [UnresolvedQuotedProductSource]. Wire it to the catalogue and the form gains
/// the product's name, SKU and **its minimum order quantity**, which is the
/// only reason the MOQ rule can be enforced at all.
final Provider<QuotedProductSource> quotedProductSourceProvider =
    Provider<QuotedProductSource>(
  (Ref ref) => const UnresolvedQuotedProductSource(),
);

/// THE CURRENCY A QUOTE IS ASKED FOR IN.
///
/// `Currency?`, and null is the default — deliberately, and it is the same
/// shape `catalogueCurrencyProvider` uses. `createRFQ` falls back to AED when
/// the field is omitted, so a currency this app guessed would come back as a
/// price the buyer cannot settle in. Null makes the form ask; an override
/// (from the account's market) makes the form prefill.
final Provider<Currency?> quoteCurrencyProvider =
    Provider<Currency?>((Ref ref) => null);

/// The product a quote is being requested for, or null when it cannot be
/// resolved.
///
/// Keyed by the whole [QuoteSubject] so that two quote forms opened from two
/// deep links do not overwrite each other's entry.
final FutureProviderFamily<QuotedProduct?, QuoteSubject> quotedProductProvider =
    FutureProvider.autoDispose.family<QuotedProduct?, QuoteSubject>(
  (Ref ref, QuoteSubject subject) =>
      ref.watch(quotedProductSourceProvider).load(subject),
);

/// MY QUOTE REQUESTS.
///
/// An `AsyncNotifier` over a plain `List`, with no `loadMore` and no cursor —
/// because there is no second page to load. `GET /v1/rfqs` answers a fixed
/// page of at most 50 with no `meta` block at all, so the only refinement this
/// controller offers over a `FutureProvider` is [refresh], which pull-to-refresh
/// needs.
class MyRfqsController extends AsyncNotifier<List<RfqCard>> {
  @override
  Future<List<RfqCard>> build() =>
      ref.read(rfqRepositoryProvider).myRfqs();

  /// Re-ask the server. Used by pull-to-refresh and after a decision lands.
  Future<void> refresh() async {
    state = const AsyncLoading<List<RfqCard>>();
    state = await AsyncValue.guard(build);
  }
}

final AsyncNotifierProvider<MyRfqsController, List<RfqCard>>
    myRfqsControllerProvider =
    AsyncNotifierProvider<MyRfqsController, List<RfqCard>>(
  MyRfqsController.new,
);

/// One request in full.
///
/// A family rather than a single provider so that two requests opened from a
/// push notification and a list tap do not overwrite each other's cache entry.
///
/// NOT auto-disposing: the detail screen's decision flow re-reads this after a
/// conflict, and an auto-disposed provider would refetch underneath a dialog
/// the buyer is reading.
final FutureProviderFamily<RfqDetail, String> rfqDetailProvider =
    FutureProvider.family<RfqDetail, String>(
  (Ref ref, String id) => ref.read(rfqRepositoryProvider).rfq(id),
);
