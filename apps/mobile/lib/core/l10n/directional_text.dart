import 'package:flutter/widgets.dart';

/// Unicode bidi isolate controls.
///
/// These are not decoration. The Unicode Bidirectional Algorithm resolves a
/// run's direction from its own characters plus its surroundings, and a
/// "neutral" character — a digit, a hyphen, a slash, a full stop, a bracket —
/// takes its direction from whatever is next to it.
///
/// So an Arabic sentence ending in a SKU:
///
///     الرجاء تأكيد رقم الصنف AVN-4471-B.
///
/// The trailing `.` is neutral, it sits between an LTR run and an RTL
/// paragraph, and the algorithm hands it to the paragraph. It renders to the
/// LEFT of the SKU: `.AVN-4471-B`. Worse, a SKU like `4471-B` can have its own
/// segments reordered outright, so what is on screen is not what is in the
/// database. Read down a warehouse phone line that is a wrong part number, and
/// nothing in the UI ever looked broken.
///
/// [Bidi.isolate] wraps the token in FSI…PDI, which tells the algorithm to
/// resolve the run entirely on its own and treat the whole thing as one neutral
/// object in the parent. The token comes out exactly as stored, in both locales.
abstract final class Bidi {
  /// FIRST STRONG ISOLATE (U+2066... see below) — direction inferred from the
  /// run's first strong character, which is right for a token that may be
  /// either.
  ///
  /// Written as an escape, not as the literal character. These controls are
  /// invisible in an editor, so a literal here is a character no reviewer can
  /// see in a diff — the same property that makes Trojan Source attacks work.
  /// The analyzer flags literals for exactly this reason.
  static const String fsi = '\u2068';

  /// LEFT-TO-RIGHT ISOLATE — direction forced to LTR.
  static const String lri = '\u2066';

  /// POP DIRECTIONAL ISOLATE — closes any of the above.
  static const String pdi = '\u2069';

  /// Wrap [token] so it resolves independently of its surroundings.
  ///
  /// Use for every machine-readable token embedded in prose: SKU, AWB, PO
  /// number, order id, IBAN, email, phone, URL, tracking number, VAT number.
  static String isolate(String? token) {
    if (token == null || token.isEmpty) return '';
    return '$fsi$token$pdi';
  }

  /// Wrap [token] and force it left-to-right.
  ///
  /// Stronger than [isolate], and the right call when the token can *begin*
  /// with a neutral or a digit — `+971 4 555 0110`, `-14.5`, `#4471`. First
  /// strong isolation would find no strong character at the start and fall back
  /// to the paragraph direction, which for Arabic flips the whole token.
  static String ltr(String? token) {
    if (token == null || token.isEmpty) return '';
    return '$lri$token$pdi';
  }

  /// True if [text] contains any strong RTL character.
  static bool hasRtl(String text) {
    for (final int r in text.runes) {
      // Hebrew, Arabic, Syriac, Thaana, N'Ko + the Arabic presentation forms.
      if ((r >= 0x0590 && r <= 0x08FF) ||
          (r >= 0xFB1D && r <= 0xFDFF) ||
          (r >= 0xFE70 && r <= 0xFEFF)) {
        return true;
      }
    }
    return false;
  }
}

/// The kind of machine-readable token being rendered.
///
/// Exists so call sites name the thing rather than picking an isolation
/// strategy — the strategy is a property of the token type, and getting it
/// wrong is invisible in English.
enum LtrToken {
  /// `AVN-4471-B`. Starts with a letter — first-strong isolation is enough.
  sku,

  /// Air waybill. Often all digits: `176-4471 8890`. Needs forced LTR.
  awb,

  /// `PO-2026-0091`.
  purchaseOrder,

  /// `ord_7f3a91`.
  orderId,

  /// `name@example.com`.
  email,

  /// `+971 4 555 0110`. Leading `+` is neutral — needs forced LTR.
  phone,

  /// `https://…`.
  url,

  /// IBAN, VAT number, tax id.
  reference;

  /// Whether this token must be forced LTR rather than first-strong isolated.
  bool get forcesLtr => switch (this) {
        LtrToken.sku => false,
        LtrToken.email => false,
        LtrToken.url => false,
        LtrToken.awb => true,
        LtrToken.purchaseOrder => true,
        LtrToken.orderId => true,
        LtrToken.phone => true,
        LtrToken.reference => true,
      };

  String wrap(String value) =>
      forcesLtr ? Bidi.ltr(value) : Bidi.isolate(value);
}

/// A [Text] that renders a machine-readable token safely in any locale.
///
/// ```dart
/// DirectionalText.token('AVN-4471-B', kind: LtrToken.sku)
/// ```
class DirectionalText extends StatelessWidget {
  /// Ordinary prose. Follows the ambient [Directionality].
  const DirectionalText(
    this.data, {
    this.style,
    this.maxLines,
    this.overflow,
    this.textAlign,
    super.key,
  })  : _kind = null,
        _segments = null;

  /// A single machine-readable token, bidi-isolated for its [kind].
  const DirectionalText.token(
    this.data, {
    required LtrToken kind,
    this.style,
    this.maxLines,
    this.overflow,
    this.textAlign,
    super.key,
  })  : _kind = kind,
        _segments = null;

  /// Prose with tokens embedded in it.
  ///
  /// Each [TextSegment] is isolated on its own, so a sentence can carry three
  /// SKUs and a phone number and every one of them stays intact.
  const DirectionalText.rich(
    List<TextSegment> segments, {
    this.style,
    this.maxLines,
    this.overflow,
    this.textAlign,
    super.key,
  })  : data = '',
        _kind = null,
        _segments = segments;

  final String data;
  final LtrToken? _kind;
  final List<TextSegment>? _segments;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;
  final TextAlign? textAlign;

  /// The string this widget will actually hand to the text engine — exposed so
  /// tests can assert the isolate marks are present without rendering.
  String resolve() {
    final List<TextSegment>? segments = _segments;
    if (segments != null) {
      return segments.map((TextSegment s) => s.resolve()).join();
    }
    final LtrToken? kind = _kind;
    return kind == null ? data : kind.wrap(data);
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      resolve(),
      style: style,
      maxLines: maxLines,
      overflow: overflow,
      textAlign: textAlign,
      // Deliberately NOT setting textDirection: the paragraph must follow the
      // ambient Directionality. The isolate marks inside the string are what
      // protect the token, and they work in either paragraph direction. Pinning
      // the paragraph LTR here would left-align an Arabic sentence.
    );
  }
}

/// One run inside a [DirectionalText.rich].
@immutable
class TextSegment {
  /// Prose. Resolved by the bidi algorithm as normal.
  const TextSegment.prose(this.text)
      : kind = null,
        _isProse = true;

  /// A machine-readable token, isolated for its [kind].
  const TextSegment.token(this.text, {required LtrToken this.kind})
      : _isProse = false;

  final String text;
  final LtrToken? kind;
  final bool _isProse;

  String resolve() => _isProse ? text : kind!.wrap(text);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TextSegment &&
          other.text == text &&
          other.kind == kind &&
          other._isProse == _isProse;

  @override
  int get hashCode => Object.hash(text, kind, _isProse);
}
