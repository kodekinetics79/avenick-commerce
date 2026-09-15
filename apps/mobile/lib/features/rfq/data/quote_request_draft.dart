import 'package:flutter/foundation.dart';

import '../../../api/models/enums.dart';
import '../../../api/models/requests.dart';
import '../../../core/l10n/numerals.dart';
import 'rfq_limits.dart';

/// THE QUOTE FORM'S RULES, WITH NO WIDGETS ATTACHED.
///
/// Every message a buyer can be shown on the app's primary journey is decided
/// here, in a pure value object, for three reasons:
///
///  1. It can be unit tested at the speed of a `test()`, so the MOQ rule and
///     the 1,000,000 ceiling are covered by cases rather than by one widget
///     test that happened to type "0".
///  2. `canSubmit` is derived from the same fields that produce the messages,
///     so the button cannot be enabled while an error is on screen — a class
///     of bug that only shows up when two `bool`s drift apart.
///  3. The messages themselves stay together, where they can be read as a set.
///     "Invalid input" three times is what happens when they are written one
///     at a time next to three different `TextField`s.
///
/// EVERY BOUND BELOW IS THE CONTRACT'S, not a guess: quantity is a positive
/// integer up to 1,000,000 (`RfqLineInputSchema`), a free-text line name is
/// 2–300 characters, and the request note is at most 2,000
/// (`CreateRfqRequestFieldsSchema`). Validating tighter than the server would
/// refuse a request the server would take; validating looser sends a round trip
/// the buyer waits for and then gets told about.
@immutable
class QuoteRequestDraft {
  const QuoteRequestDraft({
    this.productId,
    this.itemName = '',
    this.quantityText = '',
    this.note = '',
    this.currency,
    this.moq = 1,
    this.showErrors = false,
  });

  /// The catalogue product this line names, when there is one.
  ///
  /// When it is set the server resolves `nameEn` from the catalogue and
  /// ignores anything this client sends, so [itemName] is not submitted — see
  /// [RfqLineInput].
  final String? productId;

  /// What the buyer wants, for a line that names no catalogue product.
  final String itemName;

  /// The quantity as TYPED. Kept as text rather than an `int?` so that "12a"
  /// and "" are distinguishable states with different messages, instead of
  /// both arriving as null.
  final String quantityText;

  final String note;

  /// The currency the buyer wants to be quoted in.
  ///
  /// Null until chosen, and null blocks submission. `createRFQ` falls back to
  /// AED when the field is omitted, and a currency the buyer never picked is
  /// the wrong figure to quote against — so this app never omits it.
  final Currency? currency;

  /// The product's minimum order quantity; 1 when there is no minimum, and
  /// also 1 when the product could not be loaded — in which case the rule
  /// simply does not bite. A guessed minimum would refuse a valid request.
  final int moq;

  /// Whether to surface messages for fields the buyer has not touched yet.
  ///
  /// A form that turns red before anything is typed reads as an accusation.
  /// Errors appear once a field has been edited, or once submit has been
  /// attempted — [showErrors] is what the second case sets.
  final bool showErrors;

  QuoteRequestDraft copyWith({
    String? productId,
    String? itemName,
    String? quantityText,
    String? note,
    Currency? currency,
    int? moq,
    bool? showErrors,
  }) =>
      QuoteRequestDraft(
        productId: productId ?? this.productId,
        itemName: itemName ?? this.itemName,
        quantityText: quantityText ?? this.quantityText,
        note: note ?? this.note,
        currency: currency ?? this.currency,
        moq: moq ?? this.moq,
        showErrors: showErrors ?? this.showErrors,
      );

  /// The quantity, or null when what was typed is not one.
  int? get quantity {
    final String trimmed = quantityText.trim();
    if (trimmed.isEmpty) return null;
    return int.tryParse(trimmed);
  }

  /// True when a whole number was typed but it is below the product's minimum.
  ///
  /// Separate from [quantityError] because the screen offers a fix — "use the
  /// minimum" — and only for this one failure. Raising 0 to the minimum would
  /// be inventing a quantity; raising 4 to 25 is doing what the buyer already
  /// implied they wanted.
  bool get isBelowMoq {
    final int? qty = quantity;
    return qty != null && qty > 0 && qty < moq;
  }

  String? get quantityError {
    final String trimmed = quantityText.trim();
    if (trimmed.isEmpty) {
      return 'Enter how many you need. A supplier cannot price a quantity '
          'they have not been given.';
    }
    final int? qty = int.tryParse(trimmed);
    if (qty == null) {
      return 'Quantities are whole units — enter a number like 500, with no '
          'decimal point and no units.';
    }
    if (qty <= 0) {
      return 'Ask for at least one unit.';
    }
    if (qty > kRfqLineQuantityMax) {
      return 'The most that can be requested on one line is '
          '${Numerals.integer(kRfqLineQuantityMax)} units. Split a larger '
          'order across requests, or say so in the note.';
    }
    if (qty < moq) {
      return 'This product is supplied in minimums of '
          '${Numerals.integer(moq)}. Ask for at least that many.';
    }
    return null;
  }

  String? get itemNameError {
    // A line that names a catalogue product takes its name from the catalogue.
    if (productId != null) return null;
    final String trimmed = itemName.trim();
    if (trimmed.isEmpty) {
      return 'Describe what you need. The supplier reads this as your '
          'specification.';
    }
    if (trimmed.length < kRfqLineNameMin) {
      return 'That is too short for a supplier to price. Name the part, the '
          'material or the model.';
    }
    if (trimmed.length > kRfqLineNameMax) {
      return 'Keep the description under '
          '${Numerals.integer(kRfqLineNameMax)} characters — the detail '
          'belongs in the note below.';
    }
    return null;
  }

  String? get noteError {
    final int length = note.trim().length;
    if (length > kRfqNotesMax) {
      return 'The note is ${Numerals.integer(length)} characters; the limit is '
          '${Numerals.integer(kRfqNotesMax)}.';
    }
    return null;
  }

  String? get currencyError => currency == null
      ? 'Choose the currency you want to be quoted in. A price in the wrong '
          'currency is the wrong price.'
      : null;

  /// Every message, in the order the fields appear.
  List<String> get errors => <String>[
        if (itemNameError != null) itemNameError!,
        if (quantityError != null) quantityError!,
        if (noteError != null) noteError!,
        if (currencyError != null) currencyError!,
      ];

  /// THE ONE PREDICATE THE SUBMIT BUTTON READS.
  ///
  /// Derived, never stored. A separate `_isValid` field is how a button ends
  /// up enabled on a form with a red field under it.
  bool get canSubmit => errors.isEmpty;

  /// The body for `POST /v1/rfqs`.
  ///
  /// Throws when called on a draft that cannot be submitted, rather than
  /// sending a request the contract will reject. Call sites are gated on
  /// [canSubmit]; this is the belt to that pair of braces.
  CreateRfqRequest toRequest() {
    if (!canSubmit) {
      throw StateError(
        'This draft is not submittable: ${errors.join(' ')}',
      );
    }
    final String trimmedNote = note.trim();
    return CreateRfqRequest(
      items: <RfqLineInput>[
        RfqLineInput(
          productId: productId,
          // Only for a free-text line. On a `productId` line the server
          // resolves the name from the catalogue and ignores this.
          nameEn: productId == null ? itemName.trim() : null,
          quantity: quantity!,
        ),
      ],
      currency: currency!,
      notes: trimmedNote.isEmpty ? null : trimmedNote,
    );
  }
}
