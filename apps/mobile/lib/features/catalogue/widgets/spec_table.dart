import 'package:flutter/material.dart';

import '../../../core/l10n/directional_text.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';

/// One row of a specification table.
@immutable
class SpecRow {
  const SpecRow(this.label, this.value, {this.token});

  final String label;
  final String value;

  /// Set when the value is a machine-readable token — a SKU, a country code, a
  /// reference. It is then bidi-isolated so it survives an Arabic paragraph
  /// intact, which for a part number read down a warehouse phone line is the
  /// difference between the right box and the wrong one.
  final LtrToken? token;
}

/// A label/value table.
///
/// Two columns, with the label column at a fixed fraction rather than a fixed
/// width: at 200% dynamic type a 96px label column holds one word per line, and
/// the table turns into a ladder.
class SpecTable extends StatelessWidget {
  const SpecTable({required this.rows, super.key});

  final List<SpecRow> rows;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (final SpecRow row in rows) ...<Widget>[
          Semantics(
            label: '${row.label}: ${row.value}',
            excludeSemantics: true,
            child: Padding(
              padding: EdgeInsetsDirectional.symmetric(vertical: t.spaceTight),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    flex: 2,
                    child: Text(
                      row.label,
                      style: type.meta.copyWith(color: t.ink3),
                    ),
                  ),
                  SizedBox(width: t.spaceTight),
                  Expanded(
                    flex: 3,
                    child: row.token == null
                        ? Text(
                            row.value,
                            style: type.body.copyWith(color: t.ink1),
                          )
                        : DirectionalText.token(
                            row.value,
                            kind: row.token!,
                            style: type.body.copyWith(color: t.ink1),
                          ),
                  ),
                ],
              ),
            ),
          ),
          if (row != rows.last)
            Divider(height: 1, thickness: 1, color: t.hairline),
        ],
      ],
    );
  }
}
