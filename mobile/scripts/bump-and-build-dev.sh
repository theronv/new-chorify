#!/usr/bin/env bash
# ── Chorify Development Build Script ─────────────────────────────────────────
# Increments ios.buildNumber in app.json, then starts an EAS development build.
# No App Store submission — build is distributed internally via EAS.
#
# Usage:
#   ./scripts/bump-and-build-dev.sh
#
# Prerequisites:
#   - EAS CLI installed: npm install -g eas-cli
#   - Logged in: eas login

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

echo "=== Chorify Development Build ==="
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

# ── 3. EAS development build ──────────────────────────────────────────────────
echo "Starting EAS development build..."
eas build --profile development --platform ios

echo ""
echo "=== Done! Dev build $NEXT is building on EAS ==="
echo "Install via: eas build:list --platform ios"
