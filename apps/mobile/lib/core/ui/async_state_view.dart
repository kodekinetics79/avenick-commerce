import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/elevation.dart';
import '../../theme/meridian_theme.dart';
import '../../theme/tokens.g.dart';
import '../../theme/typography.dart';

/// Renders an [AsyncValue] through **four** required branches.
///
/// Flutter's `AsyncValue.when` gives you three — data, error, loading — and the
/// fourth state is the one that actually ships broken. "Loaded successfully,
/// zero rows" arrives at `data` and renders an empty `ListView`, which is a
/// blank screen with a working scrollbar. The user cannot tell it apart from a
/// failure, and neither can a screenshot in a bug report.
///
/// So [empty] is required, and — more importantly — so is [isEmpty]. There is
/// no default predicate, because a default would have to guess: is an empty
/// `List` empty? An `Order` with no lines? A `SearchResult` with zero hits but
/// three suggested categories? Only the caller knows, and a wrong guess is
/// invisible. Making it a required parameter means **a missing empty branch is
/// a compile error, not a blank screen.**
///
/// Loading is a skeleton by default, not a spinner. A skeleton for a known
/// shape tells the user what is coming and reserves its space, so nothing jumps
/// when the data lands. A spinner is for an indeterminate blocking action —
/// a payment authorising, a file uploading — where there is no shape to show
/// and the user must wait rather than read. See [AsyncStateView.spinner].
class AsyncStateView<T> extends StatelessWidget {
  const AsyncStateView({
    required this.value,
    required this.isEmpty,
    required this.data,
    required this.empty,
    required this.error,
    required this.loading,
    this.onRetry,
    super.key,
  });

  /// The four branches with the house defaults for error / loading / empty.
  ///
  /// Still requires [isEmpty] and [empty]'s content, because the *decision* and
  /// the *words* are always the caller's — a generic "Nothing here" is how an
  /// empty cart and a failed filter end up looking identical.
  factory AsyncStateView.standard({
    Key? key,
    required AsyncValue<T> value,
    required bool Function(T) isEmpty,
    required Widget Function(BuildContext, T) data,
    required String emptyTitle,
    String? emptyBody,
    Widget? emptyAction,
    required MeridianSkeleton skeleton,
    VoidCallback? onRetry,
  }) {
    return AsyncStateView<T>(
      key: key,
      value: value,
      isEmpty: isEmpty,
      data: data,
      empty: (BuildContext context) => MeridianEmptyState(
        title: emptyTitle,
        body: emptyBody,
        action: emptyAction,
      ),
      error: (BuildContext context, Object e, StackTrace? s) =>
          MeridianErrorState(error: e, onRetry: onRetry),
      loading: (BuildContext context) => skeleton,
      onRetry: onRetry,
    );
  }

  final AsyncValue<T> value;

  /// Decides whether loaded data is *empty*. Required — see the class doc.
  final bool Function(T) isEmpty;

  final Widget Function(BuildContext context, T data) data;
  final Widget Function(BuildContext context) empty;
  final Widget Function(BuildContext context, Object error, StackTrace? stack)
      error;
  final Widget Function(BuildContext context) loading;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: true,
      skipLoadingOnReload: true,
      data: (T v) => isEmpty(v) ? empty(context) : data(context, v),
      error: (Object e, StackTrace s) => error(context, e, s),
      loading: () => loading(context),
    );
  }
}

/// The shapes the app knows how to skeleton.
///
/// A skeleton is only honest if it matches the thing that is coming. A generic
/// grey box in the shape of nothing is a spinner with extra steps.
enum MeridianSkeletonShape {
  /// A vertical list of rows — orders, addresses, cart lines.
  list,

  /// A product grid.
  grid,

  /// A single detail page: media, title, price, body.
  detail,

  /// A short block of text.
  text,
}

/// A skeleton for a known shape.
///
/// Shimmer travels horizontally, and horizontal travel is exactly what has to
/// mirror in RTL — so it is driven off [Directionality] here, and it is one of
/// the very few places in this system where a direction appears at all. Under
/// reduced motion the shimmer stops and the placeholder holds a static fill:
/// the shape is still communicated, the movement is not.
class MeridianSkeleton extends StatefulWidget {
  const MeridianSkeleton({
    required this.shape,
    this.itemCount = 6,
    this.padding,
    super.key,
  });

  final MeridianSkeletonShape shape;
  final int itemCount;
  final EdgeInsetsGeometry? padding;

  @override
  State<MeridianSkeleton> createState() => _MeridianSkeletonState();
}

class _MeridianSkeletonState extends State<MeridianSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced) {
      _controller.stop();
      _controller.value = 0.5;
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final EdgeInsetsGeometry pad =
        widget.padding ?? EdgeInsetsDirectional.all(t.spaceStack);

    return Semantics(
      // One announcement for the whole placeholder. Without this, a screen
      // reader walks a dozen unlabelled grey boxes.
      label: 'Loading',
      liveRegion: true,
      child: ExcludeSemantics(
        child: Padding(
          padding: pad,
          child: switch (widget.shape) {
            MeridianSkeletonShape.list => _list(t),
            MeridianSkeletonShape.grid => _grid(t),
            MeridianSkeletonShape.detail => _detail(t),
            MeridianSkeletonShape.text => _text(t),
          },
        ),
      ),
    );
  }

  Widget _bone(
    MeridianTokens t, {
    required double width,
    required double height,
  }) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (BuildContext context, Widget? child) {
        final bool rtl = Directionality.of(context) == TextDirection.rtl;
        final double p = _controller.value;
        // The sweep runs with the reading direction, so it feels like the page
        // filling in rather than draining out.
        final Alignment begin = Alignment(rtl ? 1.0 - p * 3 : -1.0 + p * 3, 0);
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(t.radiusSm),
            gradient: LinearGradient(
              begin: begin,
              end: Alignment(begin.x + (rtl ? -1.4 : 1.4), 0),
              colors: <Color>[
                t.neutralSoft,
                t.neutralRule.withValues(alpha: 0.55),
                t.neutralSoft,
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _list(MeridianTokens t) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (int i = 0; i < widget.itemCount; i++) ...<Widget>[
            Row(
              children: <Widget>[
                _bone(t, width: t.rowH, height: t.rowH),
                SizedBox(width: t.spaceTight + t.spaceUnit),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _bone(t, width: double.infinity, height: t.fsBody),
                      SizedBox(height: t.spaceUnit + 2),
                      _bone(t, width: 140, height: t.fsMeta),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: t.spaceStack),
          ],
        ],
      );

  Widget _grid(MeridianTokens t) => GridView.builder(
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: widget.itemCount,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: t.spaceStack,
          crossAxisSpacing: t.spaceStack,
          childAspectRatio: t.imgRatioCard,
        ),
        itemBuilder: (BuildContext context, int i) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(
              child: _bone(t, width: double.infinity, height: double.infinity),
            ),
            SizedBox(height: t.spaceTight),
            _bone(t, width: double.infinity, height: t.fsUi),
            SizedBox(height: t.spaceUnit),
            _bone(t, width: 72, height: t.fsFigCard),
          ],
        ),
      );

  Widget _detail(MeridianTokens t) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _bone(t, width: double.infinity, height: 240),
          SizedBox(height: t.spaceStack),
          _bone(t, width: double.infinity, height: t.fsH2.resolve(390)),
          SizedBox(height: t.spaceTight),
          _bone(t, width: 120, height: t.fsFigCard),
          SizedBox(height: t.spaceStack),
          _text(t),
        ],
      );

  Widget _text(MeridianTokens t) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          for (int i = 0; i < 3; i++) ...<Widget>[
            _bone(t, width: i == 2 ? 180 : double.infinity, height: t.fsBody),
            SizedBox(height: t.spaceTight),
          ],
        ],
      );
}

/// The empty branch's default presentation.
class MeridianEmptyState extends StatelessWidget {
  const MeridianEmptyState({
    required this.title,
    this.body,
    this.action,
    this.icon,
    super.key,
  });

  final String title;
  final String? body;
  final Widget? action;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Center(
      child: Padding(
        padding: EdgeInsetsDirectional.all(t.spaceBlock),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (icon != null) ...<Widget>[
              IconTheme.merge(
                data: IconThemeData(color: t.ink3, size: 32),
                child: icon!,
              ),
              SizedBox(height: t.spaceStack),
            ],
            Text(title, style: type.h3, textAlign: TextAlign.center),
            if (body != null) ...<Widget>[
              SizedBox(height: t.spaceTight),
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: t.measureDesc * 6),
                child: Text(
                  body!,
                  style: type.body.copyWith(color: t.ink2),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
            if (action != null) ...<Widget>[
              SizedBox(height: t.spaceStack + t.spaceTight),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// The error branch's default presentation.
class MeridianErrorState extends StatelessWidget {
  const MeridianErrorState({required this.error, this.onRetry, super.key});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Center(
      child: Padding(
        padding: EdgeInsetsDirectional.all(t.spaceBlock),
        child: MeridianSurface(
          rung: MeridianRung.card,
          padding: EdgeInsetsDirectional.all(t.spaceStack),
          fill: t.dangerSoft,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'Something went wrong',
                style: type.ui.copyWith(color: t.dangerInk),
              ),
              SizedBox(height: t.spaceTight),
              Text(
                error.toString(),
                style: type.meta.copyWith(color: t.ink2),
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
              if (onRetry != null) ...<Widget>[
                SizedBox(height: t.spaceStack),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton(
                    onPressed: onRetry,
                    child: const Text('Try again'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A spinner — for an **indeterminate blocking action** only.
///
/// The rule this enforces by being separate from [MeridianSkeleton]: if you
/// know the shape of what is coming, show the shape. A spinner says "wait, and
/// I cannot tell you for what", and it should appear when that is literally
/// true — a payment authorising, an upload in flight — and not because a list
/// was easier to spin than to skeleton.
class MeridianSpinner extends StatelessWidget {
  const MeridianSpinner({required this.label, this.size = 20.0, super.key});

  /// Required. An unlabelled spinner is the same blank screen problem in a
  /// smaller box, and it is unusable with a screen reader.
  final String label;
  final double size;

  @override
  Widget build(BuildContext context) {
    final MeridianTokens t = context.tokens;
    final MeridianTypography type = context.type;
    return Semantics(
      label: label,
      liveRegion: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              strokeWidth: 2.0,
              valueColor: AlwaysStoppedAnimation<Color>(t.primary),
            ),
          ),
          SizedBox(width: t.spaceTight + t.spaceUnit),
          Text(label, style: type.ui.copyWith(color: t.ink2)),
        ],
      ),
    );
  }
}
