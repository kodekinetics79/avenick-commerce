import 'package:avenick/api/models/auth.dart';
import 'package:avenick/features/account/account.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:riverpod/misc.dart' show Override;

import '../../api/fake_transport.dart';
import '../../golden_matrix.dart';
import 'harness.dart';

/// Goldens for the two surfaces where a mirroring mistake would be most
/// expensive and least visible in an English screenshot.
///
/// `goldenMatrix` renders every subject in all four cells of
/// {LTR, RTL} × {light, dark} — four files or none, by design. The RTL cells
/// are the point: nothing in Dart's type system stops someone writing
/// `EdgeInsets.only(left: 16)`, and the LTR screenshot in the PR looks perfect
/// when they do.
///
/// Note the preferences are left at "follow my device" so the ambient locale
/// the harness sets is what reaches the widgets. A scope that forced `en` here
/// would render the Arabic cells in English and the whole matrix would pass on
/// a screen nobody had ever mirrored.
void main() {
  final AccountHarness signInHarness = AccountHarness.unbuiltBackend();

  goldenMatrix(
    'account_sign_in',
    (BuildContext context) => const SizedBox(
      width: 390,
      height: 700,
      child: SignInScreen(),
    ),
    surfaceSize: const Size(390, 700),
    overrides: <Override>[...signInHarness.overrides],
  );

  // The OTP input on its own: eight boxes, so the width-capping is exercised,
  // and no prose around it. The boxes are pinned LTR in both locales — a code
  // is a machine-readable token and its first digit is the leftmost one in
  // Arabic too — so the RTL cells should show the boxes in the same order.
  final AccountHarness otpHarness = AccountHarness.unbuiltBackend();
  final TextEditingController code = TextEditingController(text: '4718');

  goldenMatrix(
    'account_otp_input',
    (BuildContext context) => Padding(
      padding: const EdgeInsets.all(16),
      child: SizedBox(
        width: 358,
        child: OtpInput(controller: code, length: 6),
      ),
    ),
    surfaceSize: const Size(390, 200),
    overrides: <Override>[...otpHarness.overrides],
  );

  // The OTP screen in its locked-out state is the one a person only reaches
  // when something has gone wrong, so it is the one least likely to be looked
  // at in Arabic by hand.
  final AccountHarness lockedHarness = AccountHarness(
    handler: (RequestOptions options) => FakeResponse.error(
      400,
      'validation_failed',
      message: 'That code is not right.',
      requestId: 'req_wrong',
    ),
  );
  final DateTime t0 = DateTime.utc(2026, 9, 8, 10);

  goldenMatrix(
    'account_otp_verify',
    (BuildContext context) => SizedBox(
      width: 390,
      height: 700,
      child: OtpVerifyScreen(
        challenge: OtpChallenge(
          challengeId: 'otp_golden',
          codeLength: 6,
          expiresAt: t0.add(const Duration(minutes: 5)),
          resendAfter: t0.add(const Duration(seconds: 30)),
        ),
        phone: PhoneNumber.parse('501234567', market: GccMarket.ae),
        clock: () => t0,
      ),
    ),
    surfaceSize: const Size(390, 700),
    overrides: <Override>[...lockedHarness.overrides],
  );
}
