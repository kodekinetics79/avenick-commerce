/// Every wire model on the `/v1` surface, in one import.
///
/// Hand-written from `packages/contracts/openapi.json` — all 45 named schemas
/// plus the two inline objects on `ProductDetail` and the request bodies. The
/// spec is generated from zod; these are generated from nobody, deliberately.
/// `openapi-generator` is not installed in this repo, and a reviewed set of
/// models with the domain's traps written into them — money that is not a
/// double, VAT components that cannot be collapsed, a persisted-order shape
/// that admits what the database does not store — is worth more than a
/// generated set nobody reads.
library;

export 'account.dart';
export 'auth.dart';
export 'cart.dart';
export 'catalogue.dart';
export 'checkout.dart';
export 'common.dart';
export 'converters.dart';
export 'decimal.dart';
export 'enums.dart';
export 'money.dart';
export 'order.dart';
export 'order_totals.dart';
export 'requests.dart';
export 'rfq.dart';
