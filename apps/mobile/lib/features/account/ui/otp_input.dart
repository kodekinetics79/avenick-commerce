import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import 'account_chrome.dart';

/// A one-time-code input: N boxes, ONE real text field behind them.
///
/// ── WHY ONE FIELD AND NOT N ─────────────────────────────────────────────────
/// The obvious build is six `TextField`s that hand focus along as digits
/// arrive. It looks right and it breaks the two things that matter most:
///
///  * **SMS autofill.** iOS's one-time-code suggestion and Android's
///    autofill both deliver the WHOLE code to a single field. Split across six,
///    the platform fills the first box with all six characters, or nothing.
///  * **Paste.** People read the code in the notification shade and paste it.
///    A paste into box 3 of 6 does not distribute.
///
/// So there is one field carrying `AutofillHints.oneTimeCode`, drawn at zero
/// opacity behind the boxes, and the boxes are a rendering of its value.
/// `Opacity` does not affect hit testing in Flutter, but the boxes sit ABOVE it
/// in the stack and take the taps, which is what lets a tap on box 4 move the
/// caret to position 4.
///
/// ── ACCESSIBILITY ───────────────────────────────────────────────────────────
/// Each box is its own semantics node — reachable by swipe, announced as
/// "Digit 3 of 6, empty" or "Digit 3 of 6, 7" — because a screen-reader user
/// who cannot see the boxes still needs to know how many there are and where
/// they are. The invisible field is excluded from semantics so the same input
/// is not announced twice, and a live region reports progress as digits land.
class OtpInput extends StatefulWidget {
  const OtpInput({
    required this.controller,
    required this.length,
    this.focusNode,
    this.enabled = true,
    this.hasError = false,
    this.onCompleted,
    super.key,
  });

  final TextEditingController controller;

  /// From `OtpChallenge.codeLength`, 4 to 8. NOT hardcoded to six: the server
  /// decides, and a fixed six-box input breaks the day it changes.
  final int length;

  final FocusNode? focusNode;
  final bool enabled;

  /// Paints the boxes in the danger material. Set when a code was rejected, so
  /// the state is visible as well as announced.
  final bool hasError;

  /// Fired once the box count is full. The screen submits from here rather than
  /// making the user find a button they cannot see under the keyboard.
  final ValueChanged<String>? onCompleted;

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  late final FocusNode _focus = widget.focusNode ?? FocusNode();
  bool _ownsFocus = false;
  String _lastCompleted = '';

  @override
  void initState() {
    super.initState();
    _ownsFocus = widget.focusNode == null;
    widget.controller.addListener(_onChanged);
    _focus.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    _focus.removeListener(_onFocusChanged);
    if (_ownsFocus) _focus.dispose();
    super.dispose();
  }

  void _onFocusChanged() => setState(() {});

  void _onChanged() {
    setState(() {});
    final String value = widget.controller.text;
    if (value.length == widget.length && value != _lastCompleted) {
      _lastCompleted = value;
      widget.onCompleted?.call(value);
    } else if (value.length < widget.length) {
      // Allow a re-submit of the same code after an edit — otherwise a user
      // who deletes a digit and retypes it gets no second attempt.
      _lastCompleted = '';
    }
  }

  /// Move the caret to [index] and open the keyboard.
  void _caretTo(int index) {
    if (!widget.enabled) return;
    final int offset = index.clamp(0, widget.controller.text.length);
    widget.controller.selection = TextSelection.collapsed(offset: offset);
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String value = widget.controller.text;

    // The box grows with the type ramp — and is also bounded by the width
    // actually available, which is what stops eight boxes at 200% text running
    // off the side of a 390pt phone. That overflow is invisible in an English
    // screenshot at default type and immediate for anyone using large text,
    // which is exactly the class of defect a golden cannot catch.
    final double scale = MediaQuery.textScalerOf(context).scale(1.0);
    final double preferredHeight = (type.h2.fontSize ?? 24) * scale * 1.9;

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final double gaps = t.spaceTight * (widget.length - 1);
        final double widthCap = constraints.maxWidth.isFinite
            ? (constraints.maxWidth - gaps) / widget.length
            : double.infinity;

        double boxWidth = preferredHeight * 0.78;
        if (boxWidth > widthCap) boxWidth = widthCap;
        if (boxWidth < _minBoxWidth) boxWidth = _minBoxWidth;

        // Keep the box roughly upright rather than letting it become a tall
        // slot, and never let it fall under the 48dp target.
        double height = preferredHeight;
        if (height > boxWidth * 1.6) height = boxWidth * 1.6;
        if (height < kMinTouchTarget) height = kMinTouchTarget;

        return _boxes(t, type, value, height, boxWidth);
      },
    );
  }

  /// The floor a box may shrink to. Below this two adjacent boxes stop reading
  /// as separate slots.
  static const double _minBoxWidth = 32.0;

  Widget _boxes(
    MeridianTokens t,
    MeridianTypography type,
    String value,
    double height,
    double boxWidth,
  ) {
    return Semantics(
      // One announcement of progress for the whole group, on top of the
      // per-box nodes below.
      liveRegion: true,
      label:
          'One-time code, ${value.length} of ${widget.length} digits entered',
      child: Stack(
        alignment: AlignmentDirectional.center,
        children: <Widget>[
          // 1. The real input. Behind, invisible, and the autofill target.
          ExcludeSemantics(
            child: Opacity(
              opacity: 0,
              child: SizedBox(
                height: height,
                child: TextField(
                  key: const ValueKey<String>('otp-hidden-field'),
                  controller: widget.controller,
                  focusNode: _focus,
                  enabled: widget.enabled,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  // Both platforms deliver an SMS code to a field carrying this
                  // hint and nothing else. It is the entire reason for the
                  // one-field design.
                  autofillHints: widget.enabled
                      ? const <String>[AutofillHints.oneTimeCode]
                      : null,
                  textDirection: TextDirection.ltr,
                  inputFormatters: <TextInputFormatter>[
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(widget.length),
                  ],
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    counterText: '',
                  ),
                ),
              ),
            ),
          ),

          // 2. The boxes. On top, so they take the taps.
          //
          // Pinned LTR in BOTH locales. A one-time code is a machine-readable
          // token: its first digit is the one on the left in Arabic too, the
          // same rule that governs a SKU or a phone number. Letting the boxes
          // mirror would show a code that reads back differently from the one
          // in the SMS.
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                for (int i = 0; i < widget.length; i++) ...<Widget>[
                  if (i > 0) SizedBox(width: t.spaceTight),
                  _OtpBox(
                    index: i,
                    total: widget.length,
                    digit: i < value.length ? value[i] : null,
                    focused: _focus.hasFocus && i == value.length,
                    enabled: widget.enabled,
                    hasError: widget.hasError,
                    height: height,
                    width: boxWidth,
                    onTap: () => _caretTo(i),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.index,
    required this.total,
    required this.digit,
    required this.focused,
    required this.enabled,
    required this.hasError,
    required this.height,
    required this.width,
    required this.onTap,
  });

  final int index;
  final int total;
  final String? digit;
  final bool focused;
  final bool enabled;
  final bool hasError;
  final double height;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;

    final Color border = switch ((hasError, focused, enabled)) {
      (true, _, _) => t.dangerRule,
      (false, true, true) => t.ring,
      (false, false, true) => t.border,
      (false, _, false) => t.hairline,
    };

    return Semantics(
      // The position IS the announcement. "Edit box" six times over tells a
      // screen-reader user nothing about where they are in the code.
      label: 'Digit ${index + 1} of $total',
      value: digit ?? 'Empty',
      textField: true,
      enabled: enabled,
      focused: focused,
      onTap: enabled ? onTap : null,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: Container(
          width: width,
          height: height,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: enabled ? t.surfaceSunken : t.neutralSoft,
            borderRadius: BorderRadius.circular(t.radiusSm),
            border: Border.all(
              color: border,
              width: focused || hasError ? t.ringWidth : 1.0,
            ),
          ),
          // Scale the glyph rather than clip it: at 200% text on a narrow
          // handset the box is capped by the width available, and a clipped
          // digit is unreadable where a small one is merely small.
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              digit ?? '',
              style: type.figCard.copyWith(
                color: hasError ? t.dangerInk : t.ink1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
