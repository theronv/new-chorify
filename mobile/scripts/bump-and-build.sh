#!/usr/bin/env bash
# ── Keptt Production Build Script ────────────────────────────────────────────
# Increments ios.buildNumber in app.json, then builds and submits to the App Store.
#
# Usage:
#   ./scripts/bump-and-build.sh
#
# Prerequisites:
#   - EAS CLI installed: npm install -g eas-cli
#   - Logged in: eas login
#   - Apple credentials configured in EAS

set -euo pipefail

APP_JSON="$(dirname "$0")/../app.json"

# ── 1. Read and increment build number ────────────────────────────────────────
CURRENT=$(python3 -c "
import json, sys
with open('$APP_JSON') as f:
    d = json.load(f)
print(d['expo']['ios']['buildNumber'])
")

NEXT=$((CURRENT + 1))

echo "=== Keptt Production Build ==="
echo "Build number: $CURRENT → $NEXT"
echo ""

# ── 2. Write incremented build number back to app.json ────────────────────────
python3 -c "
import json
with open('$APP_JSON') as f:
    d = json.load(f)
d['expo']['ios']['buildNumber'] = str($NEXT)
with open('$APP_JSON', 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"

echo "✓ app.json updated (buildNumber: $NEXT)"
echo ""

# ── 3. EAS production build ───────────────────────────────────────────────────
echo "Starting EAS production build..."
eas build --profile production --platform ios

echo ""
echo "=== Build submitted. Submitting to App Store... ==="

# ── 4. Submit to TestFlight / App Store ──────────────────────────────────────
eas submit --platform ios

echo ""
echo "=== Done! Build $NEXT submitted to App Store Connect ==="
