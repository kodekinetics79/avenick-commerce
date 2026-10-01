/// The identity and account surface: sign-in, OTP, account linking, the account
/// hub, the address book, in-app account deletion and notification settings.
///
/// ── FOR WHOEVER WIRES THE ROUTER ────────────────────────────────────────────
/// Every screen here is constructible with `const X()` or with one required
/// argument, and every navigation callback is OPTIONAL: when one is null the
/// screen pushes its own next step onto the ambient navigator, so nothing in
/// this feature is ever a control that does nothing. Pass the callbacks to hand
/// navigation back to `go_router`.
///
///   SignInScreen({ onCodeSent, onSignedIn, onLinkRequired })
///   OtpVerifyScreen({ required challenge, required phone,
///                     onSignedIn, onLinkRequired, onFallBackToEmail,
///                     maxAttempts = 3, clock = DateTime.now })
///   RegisterScreen({ required link, onResolved })
///   AccountScreen({ onOpenOrders, onOpenWishlist, onOpenSupport,
///                   onOpenAddresses, onSignedOut })
///   AddressesScreen()
///   AddressEditScreen({ address, onSaved })
///   DeleteAccountScreen({ email, onDeleted })
///   NotificationPreferencesScreen({ isB2b = false, onRequestSystemPermission })
///
/// ── WHAT DOES NOT WORK YET, AND WHY ─────────────────────────────────────────
/// None of the auth or account endpoints exist on the server. Each file states
/// which routes it needs in its own header, and each screen renders a truthful
/// `not_found` notice — naming the route and carrying the `requestId` — rather
/// than a spinner, a generic error, or a stubbed success.
library;

export 'data/account_preferences.dart';
export 'data/account_providers.dart';
export 'data/auth_actions.dart';
export 'data/gcc_market.dart';
export 'data/map_pin.dart';
export 'data/notification_preferences.dart';
export 'ui/account_chrome.dart';
export 'ui/account_screen.dart';
export 'ui/address_edit_screen.dart';
export 'ui/addresses_screen.dart';
export 'ui/delete_account_screen.dart';
export 'ui/notification_preferences_screen.dart';
export 'ui/otp_input.dart';
export 'ui/otp_verify_screen.dart';
export 'ui/phone_field.dart';
export 'ui/register_screen.dart';
export 'ui/sign_in_screen.dart';
