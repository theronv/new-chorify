#!/usr/bin/env bash
# ── API Integration Test Suite ────────────────────────────────────────────────
# Automates the verification of:
#   1. Rate limiting on auth endpoints
#   2. Account deletion flow
#   3. Avatar size validation
#
# Usage: ./scripts/test-api.sh [BASE_URL]
# Default: http://localhost:3000

set -eo pipefail

API="${1:-http://localhost:3000}"
EMAIL="test-$(date +%s)@chorify.app"
PASS="Password123"

echo "=== Chorify API Test Suite ==="
echo "Target: $API"
echo ""

# ── 1. Signup ────────────────────────────────────────────────────────────────
echo "1. Testing Signup..."
SIGNUP=$(curl -sf -X POST "$API/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Tester\",\"emoji\":\"🤖\"}")
TOKEN=$(echo "$SIGNUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
USER_ID=$(echo "$SIGNUP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "   ✓ Signup successful (User: $USER_ID)"

# ── 2. Rate Limiting ──────────────────────────────────────────────────────────
echo "2. Testing Rate Limiting (Login)..."
LIMIT=5
for i in $(seq 1 $LIMIT); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}")
  echo "   Attempt $i: $CODE"
done

# The (LIMIT+1)th attempt should return 429
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}")
if [ "$CODE" -eq 429 ]; then
  echo "   ✓ Rate limit triggered (429)"
else
  echo "   ❌ Rate limit failed! Expected 429, got $CODE"
  exit 1
fi

# ── 3. Avatar Size Validation ────────────────────────────────────────────────
echo "3. Testing Avatar Size Validation..."
# Create a 110KB base64 string
LARGE_DATA=$(head -c 110000 < /dev/zero | tr '\0' 'A')
# Since we need a member ID, we'll need to create a household first or use a known one.
# For simplicity, we'll try to find any member the user has access to or skip.
# Let's just create a household and get the memberId.
HH=$(curl -sf -X POST "$API/api/households" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test HH","displayName":"Admin","emoji":"👑"}')
MEMBER_ID=$(echo "$HH" | python3 -c "import sys,json; print(json.load(sys.stdin)['member']['id'])")
TOKEN=$(echo "$HH" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Attempt update with oversized avatar
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$API/api/members/$MEMBER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"avatarUrl\":\"data:image/jpeg;base64,$LARGE_DATA\"}")

if [ "$CODE" -eq 400 ]; then
  echo "   ✓ Large avatar rejected (400)"
else
  echo "   ❌ Avatar validation failed! Expected 400, got $CODE"
  exit 1
fi

# ── 4. Account Deletion ──────────────────────────────────────────────────────
echo "4. Testing Account Deletion..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if [ "$CODE" -eq 200 ]; then
  echo "   ✓ Deletion successful (200)"
else
  echo "   ❌ Deletion failed! Expected 200, got $CODE"
  exit 1
fi

# Verify login fails now
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

if [ "$CODE" -eq 401 ]; then
  echo "   ✓ Login rejected after deletion (401)"
else
  echo "   ❌ Deletion verification failed! Expected 401, got $CODE"
  exit 1
fi

echo ""
echo "=== All Tests Passed! ==="
