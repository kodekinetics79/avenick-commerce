import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../api/models/account.dart';
import '../../../core/error/failures.dart';
import '../../../core/l10n/directional_text.dart';
import '../../../core/ui/async_state_view.dart';
import '../../../core/ui/key_button.dart';
import '../../../theme/elevation.dart';
import '../../../theme/meridian_theme.dart';
import '../../../theme/tokens.g.dart';
import '../../../theme/typography.dart';
import '../data/account_providers.dart';
import 'account_chrome.dart';
import 'address_edit_screen.dart';

/// ── ENDPOINTS THIS SCREEN NEEDS ─────────────────────────────────────────────
/// `GET    /v1/addresses`       — the book.
/// `PATCH  /v1/addresses/{id}`  — set default.
/// `DELETE /v1/addresses/{id}`  — remove.
///
/// All three are in `openapi.json` and none are implemented: `/api/v1` reads a
/// NextAuth cookie and the only route under `app/api/v1/` when this was written
/// was `checkout/`. The screen therefore renders its error branch naming
/// `GET /v1/addresses`, and no rows are drawn.
/// ────────────────────────────────────────────────────────────────────────────

/// The address book.
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Address>> book = ref.watch(addressesProvider);
    final MeridianTokens t = context.tokens;

    return AccountScaffold(
      title: 'Delivery addresses',
      padded: false,
      scrollable: false,
      bottomBar: KeyButton(
        key: const ValueKey<String>('addresses-add'),
        label: 'Add an address',
        size: KeyButtonSize.large,
        expand: true,
        icon: const Icon(LucideIcons.plus),
        onPressed: () => _open(context, null),
      ),
      child: AsyncStateView<List<Address>>(
        value: book,
        isEmpty: (List<Address> value) => value.isEmpty,
        loading: (BuildContext context) => const MeridianSkeleton(
          shape: MeridianSkeletonShape.list,
          itemCount: 3,
        ),
        error: (BuildContext context, Object error, StackTrace? _) =>
            ErrorBranch(
          error: error,
          endpoint: 'GET /v1/addresses',
          onRetry: () => ref.invalidate(addressesProvider),
        ),
        empty: (BuildContext context) => const MeridianEmptyState(
          key: ValueKey<String>('addresses-empty'),
          icon: Icon(LucideIcons.mapPin),
          title: 'No addresses saved',
          body: 'Add where you want things delivered. A landmark and a dropped '
              'pin matter more here than a street name.',
        ),
        data: (BuildContext context, List<Address> value) => ListView.separated(
          padding: EdgeInsetsDirectional.fromSTEB(
            t.spaceStack,
            t.spaceStack,
            t.spaceStack,
            t.spaceBlock,
          ),
          itemCount: value.length,
          separatorBuilder: (BuildContext context, int _) =>
              SizedBox(height: t.spaceStack),
          itemBuilder: (BuildContext context, int index) => _AddressCard(
            address: value[index],
            onEdit: () => _open(context, value[index]),
            onMakeDefault: value[index].isDefault
                ? null
                : () => _makeDefault(context, ref, value[index]),
            onDelete: () => _confirmDelete(context, ref, value[index]),
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context, Address? address) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (BuildContext context) => AddressEditScreen(address: address),
      ),
    );
  }

  Future<void> _makeDefault(
    BuildContext context,
    WidgetRef ref,
    Address address,
  ) async {
    try {
      await ref.read(addressBookProvider).makeDefault(address.id);
    } on ApiFailure catch (failure) {
      if (!context.mounted) return;
      _report(context, failure, 'PATCH /v1/addresses/{id}');
    }
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    Address address,
  ) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AccountLocaleScope(
        child: AlertDialog(
          title: const Text('Delete this address?'),
          content: Text(
            'Deliveries already on their way to "${address.label}" are not '
            'affected.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Keep it'),
            ),
            TextButton(
              key: const ValueKey<String>('address-delete-confirm'),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Delete'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(addressBookProvider).remove(address.id);
    } on ApiFailure catch (failure) {
      if (!context.mounted) return;
      // A 409 here is a real business outcome — the address is on an order
      // that has not settled — and its message is worth showing verbatim.
      _report(context, failure, 'DELETE /v1/addresses/{id}');
    }
  }

  static void _report(
    BuildContext context,
    ApiFailure failure,
    String endpoint,
  ) {
    final bool unbuilt = failure is ServerFailure && failure.isNotFound;
    final String? requestId = failure.traceId;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          unbuilt
              ? 'That needs $endpoint, which the server has not implemented '
                  'yet. Nothing changed.'
              : <String>[
                  failure.displayMessage,
                  if (requestId != null) 'Reference $requestId',
                ].join('  '),
        ),
      ),
    );
  }
}

/// One saved address.
///
/// The order of the lines is the order a driver reads them in: the landmark
/// first, because "behind ADNOC, near the mosque" is what actually finds the
/// door, and the street line second.
class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.onEdit,
    required this.onMakeDefault,
    required this.onDelete,
  });

  final Address address;
  final VoidCallback onEdit;
  final VoidCallback? onMakeDefault;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    final String? landmark = address.line2;

    return MeridianSurface(
      rung: MeridianRung.card,
      padding: EdgeInsetsDirectional.all(t.spaceStack),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(address.label, style: type.h3)),
              if (address.isDefault)
                const _DefaultChip(key: ValueKey<String>('address-default')),
            ],
          ),
          SizedBox(height: t.spaceTight),
          if (landmark != null && landmark.isNotEmpty) ...<Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(LucideIcons.navigation, size: 14, color: t.ink3),
                SizedBox(width: t.spaceTight),
                Expanded(
                  child:
                      Text(landmark, style: type.body.copyWith(color: t.ink1)),
                ),
              ],
            ),
            SizedBox(height: t.spaceUnit),
          ],
          Text(
            '${address.line1}, ${address.city}, ${address.country.code}',
            style: type.meta.copyWith(color: t.ink2),
          ),
          if (address.hasCoordinates) ...<Widget>[
            SizedBox(height: t.spaceUnit),
            Row(
              children: <Widget>[
                Icon(LucideIcons.mapPin, size: 14, color: t.successInk),
                SizedBox(width: t.spaceTight),
                // Expanded: at 200% text a coordinate pair is wider than the
                // card, and a Row hands a non-flex child unbounded width.
                //
                // Coordinates are a machine-readable token — the minus sign
                // and the comma are neutrals that reorder in Arabic without an
                // isolate.
                Expanded(
                  child: DirectionalText.token(
                    '${address.latitude!.toStringAsFixed(5)}, '
                    '${address.longitude!.toStringAsFixed(5)}',
                    kind: LtrToken.reference,
                    style: type.micro.copyWith(color: t.ink3),
                  ),
                ),
              ],
            ),
          ] else ...<Widget>[
            SizedBox(height: t.spaceUnit),
            Text(
              'No map pin. A driver will have to call.',
              style: type.micro.copyWith(color: t.warningInk),
            ),
          ],
          SizedBox(height: t.spaceStack),
          Row(
            children: <Widget>[
              // Expanded rather than intrinsic width: at 200% text two
              // intrinsically-sized buttons plus a 48dp icon button do not fit
              // across a 390pt phone. Sharing the row keeps both labels
              // readable and both targets large.
              Expanded(
                child: KeyButton(
                  label: 'Edit',
                  tone: KeyButtonTone.ghost,
                  size: KeyButtonSize.small,
                  expand: true,
                  icon: const Icon(LucideIcons.pencil),
                  onPressed: onEdit,
                  semanticLabel: 'Edit ${address.label}',
                ),
              ),
              if (onMakeDefault != null) ...<Widget>[
                SizedBox(width: t.spaceTight),
                Expanded(
                  child: KeyButton(
                    label: 'Make default',
                    tone: KeyButtonTone.ghost,
                    size: KeyButtonSize.small,
                    expand: true,
                    onPressed: onMakeDefault,
                    semanticLabel: 'Make ${address.label} the default address',
                  ),
                ),
              ],
              SizedBox(width: t.spaceTight),
              IconButton(
                onPressed: onDelete,
                icon: const Icon(LucideIcons.trash2),
                // Every icon-only control carries a label. Without one this is
                // announced as "button" beside four other unnamed buttons.
                tooltip: 'Delete ${address.label}',
                constraints: const BoxConstraints(
                  minWidth: kMinTouchTarget,
                  minHeight: kMinTouchTarget,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DefaultChip extends StatelessWidget {
  const _DefaultChip({super.key});

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.primarySoft,
        borderRadius: BorderRadius.circular(t.radiusPill),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.symmetric(
          horizontal: t.spaceTight,
          vertical: t.spaceUnit / 2,
        ),
        child: Text(
          'Default',
          style: type.micro.copyWith(color: t.primaryInk),
        ),
      ),
    );
  }
}
