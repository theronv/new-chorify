# Chorify — Pre-Launch UAT Checklist

> **Created:** March 2026
> **Status:** Pre-launch review complete, fixes pending
> **Reviewed by:** Claude Code (automated codebase audit)

---

## How to Use This Document

Each item has a **severity**, **status checkbox**, and **details** including affected files.
Work through Blockers first, then High, Medium, Low. Check off items as they are resolved.

---

## 1. Blockers (App Store will reject)

### 1.1 No Account Deletion
- [ ] **Fixed**
- **Requirement:** Apple requires apps with account creation to offer account deletion (App Store Review Guideline 5.1.1(v)).
- **Work needed:**
  - Add `DELETE /api/auth/account` endpoint — delete user row (cascades to profiles, members, completions, refresh_tokens, etc.)
  - Add "Delete Account" row in Settings screen (`mobile/app/(app)/settings/index.tsx`) with a two-step confirmation alert
  - After deletion, clear tokens and redirect to login
- **Files to create/modify:**
  - `api/lib/routes/auth.ts` — new DELETE endpoint
  - `mobile/lib/api.ts` — new `auth.deleteAccount()` wrapper
  - `mobile/app/(app)/settings/index.tsx` — UI button + handler

### 1.2 Branding Inconsistency (Chorify vs Keptt)
- [ ] **Fixed**
- **Issue:** MEMORY.md documents a rebrand from Chorify to Keptt, but the live app still says "Chorify" in all user-facing strings. The privacy policy and APPSTORE.md say "Keptt."
- **Decision needed:** Pick one name and apply everywhere.
- **Affected locations:**
  - `mobile/app.json:3` — `"name": "Chorify"` (also slug, scheme, bundleIdentifier, NSUserNotificationUsageDescription)
  - `mobile/app/(auth)/login.tsx:73` — login screen wordmark
  - `mobile/app/(auth)/signup.tsx:80` — signup screen wordmark
  - `mobile/app/(app)/settings/index.tsx:99` — share message text
  - `mobile/lib/notifications.ts:58` — daily summary notification title
  - `api/lib/routes/cron.ts` — push notification title (search for `'Chorify'`)
  - `mobile/APPSTORE.md` — app name field vs description body
  - All file-level comment headers (cosmetic, low priority)

### 1.3 Ungated Console Statements in Production
- [ ] **Fixed**
- **Rule:** All `console.log` must be gated with `if (__DEV__)` per CLAUDE.md.
- **Security risk:** `api.ts` logs full API response bodies including JWT tokens.
- **Files with ungated statements:**
  - `mobile/app/(auth)/signup.tsx:47` — `console.log('Signup error:...')`
  - `mobile/lib/notifications.ts:139` — `console.warn('[BG] Background fetch failed:...')`
  - `mobile/lib/notifications.ts:154,159,172,181,187,190` — various `console.log`
  - `mobile/lib/notifications.ts:210,221,224` — various `console.log/warn`
  - `mobile/app/(app)/settings/csv.tsx:91,132,157` — `console.error` calls

### 1.4 Rewards Screen Missing or Listing Inaccurate
- [ ] **Fixed**
- **Issue:** APPSTORE.md description says "redeem points for real rewards" and screenshots list a "Rewards screen," but there is no rewards tab or screen in the app. The API has rewards endpoints and a `rewards` DB table.
- **Resolution — pick one:**
  - **Option A:** Build a rewards tab/screen (significant work)
  - **Option B:** Remove all rewards references from APPSTORE.md description, keywords, and screenshot list (quick fix — rewards can ship in a future update)

---

## 2. High Priority (fix before launch)

### 2.1 Household Store Not Cleared on Logout
- [ ] **Fixed**
- **Issue:** `useAuthStore.logout()` clears auth tokens but does not call `useHouseholdStore.clear()`. Sensitive household data (tasks, members, completions) remains in memory after logout.
- **Files:**
  - `mobile/lib/store.ts:127-136` — logout action
  - `mobile/app/(app)/settings/index.tsx:229-240` — logout handler
- **Fix:** Call `useHouseholdStore.getState().clear()` inside the auth store's `logout` action or in the settings screen handler before redirecting.

### 2.2 Auth Store Not Updated During Silent Token Refresh
- [ ] **Fixed**
- **Issue:** `refreshAccessToken()` in `api.ts:134-150` writes new tokens to SecureStore but never updates the Zustand auth store. Components reading from the store may hold stale tokens.
- **File:** `mobile/lib/api.ts:148`
- **Fix:** After `storeTokens(...)`, also call `useAuthStore.getState().setTokens(data)` or a lightweight setter that updates `accessToken`/`refreshToken` in the store.

### 2.3 Optimistic Updates Lack Rollback
- [ ] **Fixed**
- **Issue:** Task completion and deletion update the local store before the API confirms success. If the API call fails, the store stays in the wrong state.
- **Files:**
  - `mobile/app/(app)/(home)/index.tsx:99-134` — task completion
  - `mobile/app/(app)/(home)/index.tsx:136-143` — task deletion
  - `mobile/app/(app)/family/index.tsx:142-177` — task completion (duplicate logic)
- **Fix:** Either move store updates after API success, or capture previous state and restore on error.

### 2.4 Run avatar_url Database Migration
- [ ] **Fixed**
- **Issue:** The `avatar_url` column is used by the API and mobile app but is not in the schema file and may not be in production.
- **Steps:**
  1. Verify column exists: `turso db shell chorify-theronv "PRAGMA table_info(members)"`
  2. If missing: `turso db shell chorify-theronv "ALTER TABLE members ADD COLUMN avatar_url TEXT"`
  3. Add the ALTER statement to `api/TURSO_SCHEMA.sql` for documentation

### 2.5 CORS Configuration
- [ ] **Fixed**
- **Issue:** `api/app/api/[[...route]]/route.ts:30` uses `cors()` with no origin restriction. Any website can call the API.
- **Fix:** Since this is a native-only app, either remove CORS middleware entirely or restrict to a specific domain. For development convenience, consider gating it:
  ```typescript
  if (process.env.NODE_ENV !== 'production') {
    app.use('*', cors())
  }
  ```

### 2.6 Seed Demo Account for App Review
- [ ] **Fixed**
- **Issue:** APPSTORE.md lists demo credentials (`demo@keptt.app` / `KepttDemo2024`) for App Review. The account must exist with sample data.
- **Step:** Run `./scripts/seed-demo.sh` and verify the household has tasks, completions, and members.

---

## 3. Medium Priority (fix before public release)

### 3.1 Accessibility Labels
- [ ] **Fixed**
- **Issue:** Only 1 `accessibilityLabel` found in the entire codebase (in `MemberAvatar.tsx`). Apple may reject or flag this.
- **Minimum coverage needed:**
  - All buttons: Share, Complete Task, Delete Task, Add Task, Sign Out, Add Member
  - Form inputs: email, password, task title, etc.
  - Tab bar items (may be automatic via Expo Router)
  - Modal dismiss areas
- **Scope:** All files in `mobile/app/` and `mobile/components/`

### 3.2 Error Boundary
- [ ] **Fixed**
- **Issue:** No global error boundary. Unhandled JS errors crash the app with no recovery.
- **Fix:** Add Expo's built-in `ErrorBoundary` or a custom one in `mobile/app/_layout.tsx`.

### 3.3 Avatar URL Size Validation
- [ ] **Fixed**
- **Issue:** `api/lib/routes/members.ts` accepts `avatarUrl` as `z.string()` with no max length. A malicious client could send arbitrarily large payloads.
- **Fix:** Add `.max(500000)` (500KB limit) to the Zod schema for `avatarUrl`.

### 3.4 Expired Refresh Token Cleanup
- [ ] **Fixed**
- **Issue:** Used and expired `refresh_tokens` rows accumulate forever. No cleanup mechanism.
- **Fix:** Add a cleanup query to the daily cron job in `api/lib/routes/cron.ts`:
  ```sql
  DELETE FROM refresh_tokens WHERE used = 1 OR expires_at < datetime('now')
  ```

### 3.5 Tasks Screen Missing loadError State
- [ ] **Fixed**
- **Issue:** The Today screen renders a full-screen retry state when `loadError` is set, but the Tasks/Family screen (`mobile/app/(app)/family/index.tsx`) does not handle `loadError` — it shows a blank view.
- **Fix:** Add the same error state pattern from the Today screen.

### 3.6 APPSTORE.md Metadata Consistency
- [ ] **Fixed**
- **Issue:** Document mixes "Chorify" and "Keptt." Must match the final branding decision from item 1.2.
- **File:** `mobile/APPSTORE.md`

---

## 4. Low Priority (nice to have for v1.0)

### 4.1 Terms of Service
- [ ] **Done**
- Privacy policy exists at `/privacy-policy` but there is no Terms of Service. Not strictly required but recommended.

### 4.2 Support URL
- [ ] **Done**
- APPSTORE.md lists the privacy policy URL as the support URL. Consider a dedicated support/contact page.

### 4.3 Rate Limiting Persistence
- [ ] **Done**
- In-memory rate limiter resets on every Vercel cold start. Acceptable for launch; consider Upstash Redis for scale.

### 4.4 Deep Linking / Universal Links
- [ ] **Done**
- URL scheme (`chorify://`) is configured but no Universal Links or associated domains. Notification taps use in-app routing (works), but web-based invite links won't deep link.

### 4.5 App Store Screenshots
- [ ] **Done**
- APPSTORE.md lists 5 required iPhone 6.7" screenshots. These need to be captured from a production build.

### 4.6 Timezone Edge Cases
- [ ] **Done**
- `addDays()` in `AddTaskSheet.tsx` uses device timezone instead of app timezone preference.
- `selectStreak()` in `store.ts` can be off by 1 day near midnight in westward timezones.

---

## 5. Deploy Steps (run in order after all fixes)

```bash
# 1. Database migration (if not already done)
turso db shell chorify-theronv "ALTER TABLE members ADD COLUMN avatar_url TEXT"

# 2. Seed demo account for App Review
./scripts/seed-demo.sh

# 3. Deploy API
cd api && npx vercel --prod

# 4. Verify API health
curl https://api-eight-pi-38.vercel.app/api/health

# 5. Run backend smoke test (41 checks)
# See DEVELOPER_GUIDE.md section 18

# 6. Build production iOS app
cd mobile && eas build --profile production --platform ios

# 7. Submit to TestFlight / App Store
eas submit --platform ios
```

---

## 6. Test Matrix

Manual testing to perform on a device/TestFlight build after fixes are applied.

### Auth Flow
- [ ] Sign up with new email
- [ ] Log in with existing email
- [ ] Log out and verify household data is cleared
- [ ] Delete account and verify redirect to login
- [ ] Token refresh (let app sit idle, then use it)
- [ ] Log in on a second device (verify both sessions work)

### Onboarding
- [ ] Create new household
- [ ] Join existing household with invite code
- [ ] Select and apply a starter pack
- [ ] Skip packs and proceed to app

### Today Screen
- [ ] View overdue, due today, and completed sections
- [ ] Complete a task (verify confetti, points, streak)
- [ ] Pull to refresh
- [ ] Error state: disable network, pull to refresh, verify retry button

### Tasks Screen
- [ ] View all tasks grouped/filtered
- [ ] Add a new task with all fields filled
- [ ] Edit an existing task
- [ ] Delete a task
- [ ] Filter by category/member/date
- [ ] Error state renders (not blank screen)

### Family / Leaderboard
- [ ] View member cards with points and medals
- [ ] Verify weekly completion counts are correct

### Settings
- [ ] View household info and invite code
- [ ] Share invite code
- [ ] Change profile photo
- [ ] Change timezone
- [ ] Change notification preference (task / daily / off)
- [ ] Add a child member
- [ ] Manage rooms (add, rename, delete)
- [ ] Manage categories (add, rename, delete — cannot delete last)
- [ ] Browse and add a task pack
- [ ] Export tasks as CSV
- [ ] Import tasks from CSV
- [ ] Sign out

### Notifications
- [ ] Grant push permission on first launch
- [ ] Receive push notification when tasks are due (cron-triggered)
- [ ] Verify badge count matches overdue task count
- [ ] Tap notification and land on Today screen
- [ ] Switch to daily summary — verify scheduled local notification
- [ ] Switch to off — verify badge clears and no notifications

### Tablet
- [ ] All screens render correctly on iPad
- [ ] Content is centered with max width
- [ ] Bottom sheets use `sheetMaxWidth`
- [ ] Landscape orientation works

### Edge Cases
- [ ] Rapidly tap "Complete" on same task (should not double-complete)
- [ ] Complete task with no network (verify error feedback)
- [ ] Very long task title / category name (no overflow / truncation issues)
- [ ] Household with 0 tasks — empty states render
- [ ] Household with 100+ tasks — performance acceptable
