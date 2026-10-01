/// THE QUOTE FEATURE — request a quote → my requests → accept or decline.
///
/// This is the app's PRIMARY JOURNEY, not a B2B side-door. Every product in the
/// production catalogue answers `sellableInChannel: false`, so the product
/// page's main button is "Request a quote" and it lands in [RequestQuoteScreen].
///
/// Everything the router needs is exported here, so `lib/app/router.dart` has
/// one import and no knowledge of this feature's internals.
///
/// ## SCREENS AND THEIR EXACT CONSTRUCTOR ARGUMENTS
///
/// ```dart
/// RequestQuoteScreen({
///   required QuoteSubject subject,          // QuoteSubject.fromQuery(...)
///   void Function(String rfqId)? onCreated, // default: pushes RfqDetailScreen
///   VoidCallback? onSignInRequired,         // default: no sign-in button
/// })
/// RfqListScreen({ void Function(String rfqId)? onOpenRfq })
/// RfqDetailScreen({ required String rfqId })
/// ```
///
/// Every callback is optional and every one has a working default that uses
/// `Navigator.push`, so the journey runs today and gets better the moment the
/// router supplies real destinations.
///
/// ## THE ROUTES (already named in `lib/app/routes.dart`)
///
/// ```dart
/// GoRoute(
///   path: Routes.rfqNew,        // '/rfq/new?productId=…&slug=…&qty=…'
///   name: Routes.nRfqNew,
///   builder: (BuildContext context, GoRouterState state) => RequestQuoteScreen(
///     subject: QuoteSubject.fromQuery(state.uri.queryParameters),
///     onCreated: (String id) => context.pushReplacement(Routes.rfqOf(id)),
///     onSignInRequired: () => context.push(Routes.signIn),
///   ),
/// ),
/// GoRoute(
///   path: Routes.rfqs,          // '/rfqs'
///   name: Routes.nRfqs,
///   builder: (BuildContext context, GoRouterState state) => RfqListScreen(
///     onOpenRfq: (String id) => context.push(Routes.rfqOf(id)),
///   ),
/// ),
/// GoRoute(
///   path: Routes.rfq,           // '/rfqs/:id'
///   name: Routes.nRfq,
///   builder: (BuildContext context, GoRouterState state) =>
///       RfqDetailScreen(rfqId: state.pathParameters['id']!),
/// ),
/// ```
///
/// ONE THING THE ROUTER SHOULD KNOW: `Routes.requiresAuth` deliberately lets
/// `/rfq/new` through unauthenticated, on the grounds that the funnel must be
/// open to a stranger. **`POST /v1/rfqs` is `auth: "required"`.** So an
/// anonymous buyer WILL fill the form in and meet a 401 on submit. That is
/// handled — the screen renders "Sign in to send this request" and keeps the
/// draft — but `onSignInRequired` is what makes it a route rather than a
/// dead end. See the report.
///
/// ## PROVIDERS THE COMPOSITION ROOT MUST OVERRIDE
///
/// ```dart
/// rfqRepositoryProvider.overrideWithValue(ApiRfqRepository(api.rfqs)),
/// ```
///
/// It throws [RfqNotWired] if it is not. That is on purpose: a default that
/// answered an empty list would render "No quote requests yet" to a buyer with
/// a dozen live quotes, and it would look perfect in a screenshot.
///
/// ## PROVIDERS IT SHOULD OVERRIDE
///
///   quotedProductSourceProvider — resolves the product being quoted, and with
///                                 it the MINIMUM ORDER QUANTITY the form
///                                 enforces. The default answers null for
///                                 everything, which is honest (the form falls
///                                 back to a free-text request) but means the
///                                 MOQ rule never bites. An adapter over
///                                 `catalogueRepositoryProvider` is four lines.
///
///   quoteCurrencyProvider       — the currency the form starts on, from the
///                                 buyer's market. `Currency?`, and null is the
///                                 honest default: `createRFQ` silently falls
///                                 back to AED when the field is omitted, so
///                                 this app never omits it and the form asks
///                                 rather than guesses.
library;

export 'data/quote_request_draft.dart';
export 'data/quoted_product.dart';
export 'data/rfq_decision_controller.dart';
export 'data/rfq_limits.dart';
export 'data/rfq_providers.dart';
export 'data/rfq_repository.dart';
export 'ui/request_quote_screen.dart';
export 'ui/rfq_detail_screen.dart';
export 'ui/rfq_list_screen.dart';
export 'ui/rfq_status_pill.dart';
export 'ui/rfq_ui.dart';
