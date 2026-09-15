import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/rfq.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/l10n/numerals.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/quote_request_draft.dart';
import '../data/quoted_product.dart';
import '../data/rfq_limits.dart';
import '../data/rfq_providers.dart';
import 'rfq_detail_screen.dart';
import 'rfq_ui.dart';

/// REQUEST A QUOTE — the primary action of this application.
///
/// Every one of the ~1,172 products in the production catalogue answers
/// `sellableInChannel: false`, so the product page's main button is not Add to
/// cart, it is Request a quote, and it lands here. This is the funnel, not a
/// B2B side-door, and the screen is built to that standard: real validation
/// messages rather than "invalid input", a submit that is disabled until the
/// request is one the server will accept, and a busy state that cannot be
/// tapped twice.
///
/// ROUTE: `/rfq/new?productId=…&slug=…&qty=…`, minted by `openQuoteRequest` in
/// the catalogue feature. The whole query string is parsed by
/// [QuoteSubject.fromQuery] — see the router snippet in `rfq.dart`.
///
/// WHAT THIS SCREEN DOES NOT DO, and why:
///
///  * **No `requiredBy` date.** The contract carries one and the detail screen
///    renders it, but nothing on this platform acts on it — no service reads it,
///    no supplier SLA is derived from it. A date picker that changes nothing is
///    a promise the app cannot keep. Flagged in the report.
///  * **No multi-line request.** `POST /v1/rfqs` takes up to 50 lines and this
///    form sends exactly one, because it is reached from one product page. A
///    basket-shaped RFQ builder is a real feature and a different screen.
///  * **No price, anywhere.** There is nothing to show: the buyer is asking
///    what it costs.
class RequestQuoteScreen extends ConsumerStatefulWidget {
  const RequestQuoteScreen({
    required this.subject,
    this.onCreated,
    this.onSignInRequired,
    super.key,
  });

  /// The parsed query string. Blank is valid — `/rfq/new` with nothing on it is
  /// "ask for something the catalogue does not list", which is the ordinary
  /// case for an RFQ rather than an error.
  final QuoteSubject subject;

  /// Where the new request's id goes. The router owns `/rfqs/:id`; the default
  /// pushes [RfqDetailScreen] itself so the journey works before that lands.
  final void Function(String rfqId)? onCreated;

  /// `POST /v1/rfqs` is `auth: "required"`. Supplied by the router so an
  /// anonymous buyer can be sent to sign in **with their draft still on
  /// screen** rather than told "unauthenticated".
  final VoidCallback? onSignInRequired;

  @override
  ConsumerState<RequestQuoteScreen> createState() =>
      _RequestQuoteScreenState();
}

class _RequestQuoteScreenState extends ConsumerState<RequestQuoteScreen> {
  late final TextEditingController _quantity = TextEditingController(
    // The buy box already asked. Asking again is asking the buyer to repeat
    // themselves — and an empty field on the funnel's first screen is a form
    // that starts with a red message the moment it is touched.
    text: widget.subject.quantity?.toString() ?? '',
  );
  final TextEditingController _itemName = TextEditingController();
  final TextEditingController _note = TextEditingController();

  Currency? _currency;
  bool _currencySeeded = false;

  /// The double-submit guard's authoritative half. The button disables itself
  /// too, but a second tap can arrive in the frame between the first and the
  /// rebuild, and only this stops it becoming a second RFQ.
  bool _submitting = false;

  /// Set once submit has been attempted, so messages appear for fields the
  /// buyer never touched. A form that turns red before anything is typed reads
  /// as an accusation.
  bool _showErrors = false;

  ApiFailure? _failure;

  /// Per-field messages from a `validation_failed`, keyed by the dotted path
  /// the server built from Zod: `items.0.quantity`, `currency`, `notes`.
  Map<String, List<String>> _fieldErrors = const <String, List<String>>{};

  @override
  void initState() {
    super.initState();
    _quantity.addListener(_rebuild);
    _itemName.addListener(_rebuild);
    _note.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _quantity
      ..removeListener(_rebuild)
      ..dispose();
    _itemName
      ..removeListener(_rebuild)
      ..dispose();
    _note
      ..removeListener(_rebuild)
      ..dispose();
    super.dispose();
  }

  QuoteRequestDraft _draft(QuotedProduct? product) => QuoteRequestDraft(
        // The resolved product's id if there is one, else whatever the deep
        // link carried. A `productId` line is named by the catalogue, so an
        // unresolvable id still produces a valid request — the server will say
        // if it is not quotable.
        productId: product?.id ?? widget.subject.productId,
        itemName: _itemName.text,
        quantityText: _quantity.text,
        note: _note.text,
        currency: _currency,
        // 1 when unknown. A guessed minimum would refuse a valid request.
        moq: product?.moq ?? 1,
        showErrors: _showErrors,
      );

  Future<void> _submit(QuoteRequestDraft draft) async {
    if (_submitting) return;
    if (!draft.canSubmit) {
      setState(() => _showErrors = true);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _failure = null;
      _fieldErrors = const <String, List<String>>{};
    });

    try {
      final RfqDetail created =
          await ref.read(rfqRepositoryProvider).create(draft.toRequest());
      // The list now has one more row on it.
      ref.invalidate(myRfqsControllerProvider);
      if (!mounted) return;
      setState(() => _submitting = false);
      final void Function(String)? handler = widget.onCreated;
      if (handler != null) {
        handler(created.id);
      } else {
        // Replace, not push: going "back" to a form that has already been sent
        // is how a buyer raises the same request twice.
        await Navigator.of(context).pushReplacement<void, void>(
          MaterialPageRoute<void>(
            builder: (BuildContext _) => RfqDetailScreen(rfqId: created.id),
          ),
        );
      }
    } on ApiFailure catch (failure) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        if (failure is ValidationFailure) {
          // Per field, under the field it belongs to. One banner makes the
          // buyer hunt for which of four inputs the server disliked.
          _fieldErrors = failure.fieldErrors;
        } else {
          _failure = failure;
        }
      });
    }
  }

  String? _serverErrorFor(String path) {
    final List<String>? messages = _fieldErrors[path];
    return messages == null || messages.isEmpty ? null : messages.first;
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final AsyncValue<QuotedProduct?> productAsync =
        ref.watch(quotedProductProvider(widget.subject));

    // Seeded once, from the port. The composition root overrides it from the
    // buyer's market; the honest default is null, which makes the form ask.
    if (!_currencySeeded) {
      _currencySeeded = true;
      _currency = ref.read(quoteCurrencyProvider);
    }

    // `.value` is null in the loading and error branches too, which is
    // exactly right here: no product means no MOQ to enforce.
    final QuotedProduct? product = productAsync.value;
    final QuoteRequestDraft draft = _draft(product);

    // Submission waits for the lookup to ANSWER — data or error, either is an
    // answer. Not pedantry: the MOQ arrives with the product, and a request
    // sent before it lands is a request that skipped the one rule this form
    // exists to enforce.
    //
    // Deliberately not `productAsync.isLoading`: Riverpod 3 retries a failed
    // provider on its own, so a lookup that is failing repeatedly flickers
    // in and out of `isLoading` forever — and the submit button would flicker
    // with it. "Has it answered once?" is the question that has a stable
    // answer.
    final bool resolving = !productAsync.hasValue && !productAsync.hasError;
    final bool canSubmit = draft.canSubmit && !resolving && !_submitting;

    return Scaffold(
      appBar: AppBar(title: const Text('Request a quote')),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsetsDirectional.all(t.spaceStack),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    // ── WHAT IS BEING QUOTED ────────────────────────────────
                    //
                    // The only async surface on this screen, and it gets all
                    // four branches. Note that its "empty" is not a failure:
                    // a request with no catalogue product behind it is the
                    // free-text case, and the branch says so and offers the
                    // field for it.
                    AsyncStateView<QuotedProduct?>(
                      value: productAsync,
                      isEmpty: (QuotedProduct? p) => p == null,
                      loading: (BuildContext _) => const MeridianSkeleton(
                        shape: MeridianSkeletonShape.text,
                        padding: EdgeInsets.zero,
                      ),
                      data: (BuildContext _, QuotedProduct? p) =>
                          _ProductStrip(product: p!),
                      empty: (BuildContext _) => const QuoteNotice(
                        tone: RfqTone.info,
                        icon: LucideIcons.fileQuestion,
                        title: 'A request in your own words',
                        body: 'This request is not tied to a catalogue '
                            'product, so describe what you need below. That is '
                            'what an RFQ is for.',
                      ),
                      error: (BuildContext _, Object e, StackTrace? s) =>
                          QuoteNotice(
                        tone: RfqTone.warning,
                        icon: LucideIcons.circleAlert,
                        title: 'The product could not be loaded',
                        body: 'You can still send the request — describe what '
                            'you need below and a supplier will price it. '
                            'Because the product did not load, its minimum '
                            'order quantity is not being checked.',
                        actions: <Widget>[
                          KeyButton(
                            label: 'Try loading it again',
                            tone: KeyButtonTone.ghost,
                            size: KeyButtonSize.small,
                            onPressed: () => ref.invalidate(
                              quotedProductProvider(widget.subject),
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: t.spaceStack),

                    // ── WHAT, when the catalogue cannot say ─────────────────
                    if (draft.productId == null) ...<Widget>[
                      const _FieldLabel(
                        label: 'What do you need?',
                        hint: 'The supplier reads this as your specification. '
                            'Name the part, the material, the model.',
                      ),
                      _Field(
                        fieldKey: const ValueKey<String>('rfq-item-name'),
                        controller: _itemName,
                        hint: 'Galvanised scaffold tube, 48.3mm',
                        maxLines: 2,
                        errorText: _showErrors || _itemName.text.isNotEmpty
                            ? draft.itemNameError ??
                                _serverErrorFor('items.0.nameEn')
                            : _serverErrorFor('items.0.nameEn'),
                      ),
                      SizedBox(height: t.spaceStack),
                    ],

                    // ── HOW MANY ────────────────────────────────────────────
                    // The minimum is stated once, on the product strip above,
                    // and again in the error if it is broken. Repeating it in
                    // the hint as well is three copies of one number.
                    const _FieldLabel(
                      label: 'How many?',
                      hint: 'Whole units. A supplier cannot price a quantity '
                          'they have not been given.',
                    ),
                    _Field(
                      fieldKey: const ValueKey<String>('rfq-quantity'),
                      controller: _quantity,
                      hint: 'e.g. 500',
                      keyboardType: TextInputType.number,
                      // Digits only. Western digits in both locales — see
                      // `Numerals`, and note the app never shows Arabic-Indic
                      // figures for a quantity that has to be typed back in.
                      inputFormatters: <TextInputFormatter>[
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                      forceLtr: true,
                      errorText: _showErrors || _quantity.text.isNotEmpty
                          ? draft.quantityError ??
                              _serverErrorFor('items.0.quantity')
                          : _serverErrorFor('items.0.quantity'),
                    ),
                    if (draft.isBelowMoq) ...<Widget>[
                      SizedBox(height: t.spaceTight),
                      // The one fix-it this form offers. Raising 4 to 25 is
                      // doing what the buyer already implied; raising 0 to 25
                      // would be inventing a quantity, which is why the offer
                      // appears for this failure only.
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: KeyButton(
                          label:
                              'Ask for ${Numerals.integer(draft.moq)} instead',
                          tone: KeyButtonTone.ghost,
                          size: KeyButtonSize.small,
                          onPressed: () =>
                              _quantity.text = draft.moq.toString(),
                        ),
                      ),
                    ],
                    SizedBox(height: t.spaceStack),

                    // ── IN WHICH CURRENCY ───────────────────────────────────
                    const _FieldLabel(
                      label: 'Quote me in',
                      hint: 'The supplier prices in this currency. It is never '
                          'assumed: a price in the wrong currency is the wrong '
                          'price.',
                    ),
                    _CurrencyChoice(
                      selected: _currency,
                      onChanged: (Currency c) => setState(() => _currency = c),
                      errorText: _showErrors
                          ? draft.currencyError ?? _serverErrorFor('currency')
                          : _serverErrorFor('currency'),
                    ),
                    SizedBox(height: t.spaceStack),

                    // ── ANYTHING ELSE ───────────────────────────────────────
                    const _FieldLabel(
                      label: 'Note for the supplier (optional)',
                      hint: 'Delivery window, site, certification, tolerances '
                          '— whatever changes the price.',
                    ),
                    _Field(
                      fieldKey: const ValueKey<String>('rfq-note'),
                      controller: _note,
                      hint: 'Needed on site in Jebel Ali before the 20th.',
                      maxLines: 4,
                      errorText:
                          draft.noteError ?? _serverErrorFor('notes'),
                    ),
                    SizedBox(height: t.spaceUnit),
                    Text(
                      '${Numerals.integer(_note.text.trim().length)} / '
                      '${Numerals.integer(kRfqNotesMax)}',
                      style: type.meta.copyWith(color: t.ink3),
                      textAlign: TextAlign.end,
                    ),

                    if (_failure != null) ...<Widget>[
                      SizedBox(height: t.spaceStack),
                      _SubmissionFailure(
                        failure: _failure!,
                        onSignInRequired: widget.onSignInRequired,
                      ),
                    ],
                    SizedBox(height: t.spaceStack),
                  ],
                ),
              ),
            ),

            // ── THE ONE ACTION ──────────────────────────────────────────────
            Padding(
              padding: EdgeInsetsDirectional.all(t.spaceStack),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  if (resolving)
                    Padding(
                      padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
                      child: Text(
                        'Checking the product…',
                        style: type.meta.copyWith(color: t.ink3),
                      ),
                    ),
                  KeyButton(
                    key: const ValueKey<String>('rfq-submit'),
                    label: 'Send this request',
                    icon: const Icon(LucideIcons.send),
                    size: KeyButtonSize.large,
                    expand: true,
                    busy: _submitting,
                    onPressed: canSubmit ? () => _submit(draft) : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The product being quoted: what it is, and the one number that constrains
/// the request.
class _ProductStrip extends StatelessWidget {
  const _ProductStrip({required this.product});

  final QuotedProduct product;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String? sku = product.sku;

    return QuotePanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(product.name(languageOf(context)), style: type.h3),
          if (sku != null) ...<Widget>[
            SizedBox(height: t.spaceUnit),
            // A SKU inside an Arabic paragraph is reordered by the bidi
            // algorithm without an isolate, and what is on screen is then not
            // what is in the database.
            DirectionalText.token(
              sku,
              kind: LtrToken.sku,
              style: type.meta.copyWith(color: t.ink3),
            ),
          ],
          SizedBox(height: t.spaceTight),
          Text(
            product.moq > 1
                ? 'Supplied in minimums of ${Numerals.integer(product.moq)}.'
                : 'No minimum order quantity.',
            style: type.meta.copyWith(color: t.ink2),
          ),
        ],
      ),
    );
  }
}

/// The currency, as a set of targets a thumb can hit.
///
/// Not a `DropdownButton`: a dropdown hides the choice behind a tap, and this
/// is a decision the buyer must make consciously — the server defaults an
/// omitted currency to AED, and a Kuwaiti buyer quoted in dirhams has been
/// given the wrong number in a currency with a different number of decimals.
class _CurrencyChoice extends StatelessWidget {
  const _CurrencyChoice({
    required this.selected,
    required this.onChanged,
    this.errorText,
  });

  final Currency? selected;
  final ValueChanged<Currency> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String? error = errorText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Wrap(
          spacing: t.spaceTight,
          runSpacing: t.spaceTight,
          children: <Widget>[
            for (final Currency currency in Currency.values)
              _CurrencyPill(
                currency: currency,
                selected: currency == selected,
                onTap: () => onChanged(currency),
              ),
          ],
        ),
        if (error != null) ...<Widget>[
          SizedBox(height: t.spaceTight),
          Text(
            error,
            style: type.meta.copyWith(color: t.dangerInk),
          ),
        ],
      ],
    );
  }
}

class _CurrencyPill extends StatelessWidget {
  const _CurrencyPill({
    required this.currency,
    required this.selected,
    required this.onTap,
  });

  final Currency currency;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final RfqToneColours c = RfqToneColours.of(
      t,
      selected ? RfqTone.info : RfqTone.neutral,
    );

    return Semantics(
      button: true,
      selected: selected,
      label: currency.code,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          // 48dp floor. A currency picked by mistake is a quote in the wrong
          // money, so this is not a control to make small.
          constraints: const BoxConstraints(
            minHeight: kMinTouchTarget,
            minWidth: kMinTouchTarget,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: c.fill,
              borderRadius: BorderRadius.circular(t.radiusPill),
              border: Border.all(
                color: c.rule,
                width: selected ? t.ringWidth : 1.0,
              ),
            ),
            child: Padding(
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: t.spaceStack,
                vertical: t.spaceTight,
              ),
              child: Center(
                widthFactor: 1,
                // The ISO code is a machine-readable token; it must not be
                // reordered inside an Arabic line.
                child: DirectionalText.token(
                  currency.code,
                  kind: LtrToken.reference,
                  style: type.ui.copyWith(color: c.ink),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A submission that did not land, told apart by what actually went wrong.
///
/// The auth branch is the one that matters. `POST /v1/rfqs` is
/// `auth: "required"` while `/rfq/new` is deliberately NOT behind the app's
/// auth guard — the funnel must be open to a stranger — so **an anonymous
/// buyer filling this form in is a normal, expected path to a 401**, and
/// "unauthenticated" is not something to show them. The draft stays on screen.
class _SubmissionFailure extends StatelessWidget {
  const _SubmissionFailure({required this.failure, this.onSignInRequired});

  final ApiFailure failure;
  final VoidCallback? onSignInRequired;

  @override
  Widget build(BuildContext context) {
    final ApiFailure f = failure;
    if (f is AuthFailure && f.requiresReauth) {
      final VoidCallback? signIn = onSignInRequired;
      return QuoteNotice(
        tone: RfqTone.warning,
        icon: LucideIcons.circleAlert,
        title: 'Sign in to send this request',
        body: 'Suppliers answer a named buyer, so a quote request needs an '
            'account. What you have typed stays here.',
        actions: <Widget>[
          if (signIn != null)
            KeyButton(
              label: 'Sign in',
              tone: KeyButtonTone.accent,
              size: KeyButtonSize.small,
              onPressed: signIn,
            ),
        ],
      );
    }

    return QuoteNotice(
      tone: RfqTone.danger,
      icon: LucideIcons.circleAlert,
      title: 'The request was not sent',
      body: f.displayMessage,
    );
  }
}

/// A label and the sentence that explains what the field is for.
class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.label, this.hint});

  final String label;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Padding(
      padding: EdgeInsetsDirectional.only(bottom: t.spaceTight),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: type.ui),
          if (hint != null) ...<Widget>[
            SizedBox(height: t.spaceUnit),
            Text(hint!, style: type.meta.copyWith(color: t.ink3)),
          ],
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.fieldKey,
    required this.controller,
    required this.hint,
    this.errorText,
    this.maxLines = 1,
    this.keyboardType,
    this.inputFormatters,
    this.forceLtr = false,
  });

  final Key fieldKey;
  final TextEditingController controller;
  final String hint;
  final String? errorText;
  final int maxLines;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;

  /// For a token that must not be reordered by the bidi algorithm — here, a
  /// quantity, which is a run of neutral digits.
  final bool forceLtr;

  @override
  Widget build(BuildContext context) {
    final MeridianTypography type = context.type;
    return TextField(
      key: fieldKey,
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      style: type.body,
      textDirection: forceLtr ? TextDirection.ltr : null,
      textAlign: TextAlign.start,
      textInputAction:
          maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
      decoration: InputDecoration(
        hintText: hint,
        errorText: errorText,
        // Three lines, because these messages are sentences: "This product is
        // supplied in minimums of 25. Ask for at least that many." truncated
        // to one line is a rule the buyer cannot follow.
        errorMaxLines: 3,
        constraints: const BoxConstraints(minHeight: kMinTouchTarget),
      ),
    );
  }
}
