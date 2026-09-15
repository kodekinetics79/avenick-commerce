#!/usr/bin/env bash
#
# Build a signed IPA for TestFlight, with the API base URL compiled in.
#
# This is the path to prefer over Product → Archive, because the defines are
# passed explicitly rather than depending on an xcconfig being in sync. The
# xcconfig (tool/sync-dart-defines.sh) exists so the Xcode UI is not a trap; this
# script exists so the command line is not one either.
#
# Usage:  tool/build-ipa.sh [dev|staging|prod]        (default: prod)
#
# The IPA lands in build/ios/ipa. Upload it with Transporter, or
#   xcrun altool --upload-app -f build/ios/ipa/*.ipa -t ios \
#     --apiKey <key> --apiIssuer <issuer>
set -euo pipefail

ENV_NAME="${1:-prod}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFINES="$HERE/dart_defines/$ENV_NAME.json"

[ -f "$DEFINES" ] || { echo "No such environment: $DEFINES" >&2; exit 1; }

cd "$HERE"

# Keep the Xcode path honest too, so an Archive taken right after this build
# targets the same environment rather than whatever was synced last.
./tool/sync-dart-defines.sh "$ENV_NAME"

echo
echo "Building $ENV_NAME IPA…"
flutter build ipa --release --dart-define-from-file="$DEFINES"

echo
echo "IPA:"
ls -1 build/ios/ipa/*.ipa 2>/dev/null || echo "  (none — check the signing errors above)"
