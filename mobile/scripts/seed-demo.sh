#!/usr/bin/env bash
# ── Keptt Demo Account Seed ─────────────────────────────────────────────────
# Creates demo@keptt.app / KepttDemo2024 with a sample household and tasks.
# Safe to re-run (login will succeed if account already exists).
# Usage: ./scripts/seed-demo.sh [API_BASE_URL]
# Default API: https://api-eight-pi-38.vercel.app

set -euo pipefail

API="${1:-https://api-eight-pi-38.vercel.app}"
EMAIL="demo@keptt.app"
PASS="KepttDemo2024"
HOUSEHOLD="The Demo Family"

echo "=== Keptt Demo Seed ==="
echo "API: $API"
echo ""

# ── 1. Sign up (ignore error if account exists) ───────────────────────────────
echo "1. Creating user account..."
SIGNUP=$(curl -sf -X POST "$API/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Demo Parent\",\"emoji\":\"👨‍👩‍👧\"}" 2>/dev/null || echo "")

if [ -z "$SIGNUP" ]; then
  echo "   Account likely exists, logging in..."
  LOGIN=$(curl -sf -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
else
  TOKEN=$(echo "$SIGNUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
fi

echo "   ✓ Authenticated"

# ── 2. Check if household already exists ──────────────────────────────────────
# Decode JWT to check hid claim
HID=$(echo "$TOKEN" | python3 -c "
import sys, base64, json
token = sys.stdin.read().strip()
payload = token.split('.')[1]
# fix padding
payload += '=' * (4 - len(payload) % 4)
claims = json.loads(base64.b64decode(payload))
print(claims.get('hid') or '')
")

if [ -n "$HID" ]; then
  echo "   Household already exists: $HID"
  HOUSEHOLD_ID="$HID"
else
  # ── 3. Create household ─────────────────────────────────────────────────────
  echo "2. Creating household..."
  HH=$(curl -sf -X POST "$API/api/households" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$HOUSEHOLD\"}")
  TOKEN=$(echo "$HH" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
  HOUSEHOLD_ID=$(echo "$HH" | python3 -c "import sys,json; print(json.load(sys.stdin)['household']['id'])")
  echo "   ✓ Household: $HOUSEHOLD_ID"
fi

# ── 4. Create sample tasks ─────────────────────────────────────────────────────
echo "3. Creating sample tasks..."

create_task() {
  local TITLE="$1"
  local RECUR="$2"
  local POINTS="$3"
  local EMOJI="$4"
  curl -sf -X POST "$API/api/households/$HOUSEHOLD_ID/tasks" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"$TITLE\",\"recurrence\":\"$RECUR\",\"points\":$POINTS,\"emoji\":\"$EMOJI\"}" \
    > /dev/null
  echo "   ✓ $EMOJI $TITLE ($RECUR, $POINTS pts)"
}

create_task "Take out trash"      "weekly"    20 "🗑️"
create_task "Vacuum living room"  "weekly"    30 "🧹"
create_task "Wash dishes"         "daily"     15 "🍽️"
create_task "Wipe kitchen counter" "daily"    10 "🧽"
create_task "Do laundry"          "weekly"    40 "👕"
create_task "Clean bathroom"      "weekly"    50 "🚿"
create_task "Feed the dog"        "daily"     10 "🐶"
create_task "Mow the lawn"        "monthly"   60 "🌿"

echo ""
echo "=== Done! ==="
echo "Demo login: $EMAIL / $PASS"
echo "Household:  $HOUSEHOLD ($HOUSEHOLD_ID)"
