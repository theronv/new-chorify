# Chorify — Full App Audit

## Executive Summary

Chorify is a well-architected family chore management app with a clean monorepo structure, solid design system, and a working TestFlight beta. However, the app has several App Store blockers — most critically the absence of an account deletion flow (Apple requirement 5.1.1v) and a missing Privacy Manifest — alongside security gaps including household data leaking across sessions on logout and an overly permissive CORS policy on the production API.

## Architecture Overview

The app uses a monorepo with two packages: `mobile/` (Expo SDK 54 with Expo Router for file-based navigation) and `api/` (Hono 4.7 on Vercel Edge Runtime with Turso/libSQL). Global state is managed by two Zustand stores — `useAuthStore` (JWT tokens and decoded claims) and `useHouseholdStore` (all household data loaded in parallel on mount). All API communication flows through typed wrappers in `lib/api.ts`, which handles silent token refresh via a deduplicated singleton promise. The data model uses 9 SQLite tables in Turso, with string-based category linking (no FK constraint) and base64-encoded avatar storage. The app supports tablet layouts via a `useLayout()` hook, push notifications via Expo Push API + Vercel Cron, and CSV import/export.

## Scores

| Category | Grade | Details |
|---|---|---|
| Code Quality | B- | Duplicated `handleComplete`/`handleDelete` logic across Today and Tasks screens. Hardcoded category strings in `constants/packs.ts`. `as never` type casts on router navigation. Unnecessary type assertions in category updates. Dead style definitions (BUG-9, now removed). |
| Performance | C+ | All task lists use `ScrollView` + `.map()` instead of `FlashList`, which will degrade as task counts grow. The leaderboard's `weeklyCompletions()` helper is called inside `.sort()` without memoization, recalculating on every render. |
| Accessibility | C | No explicit accessibility strategy documented. Icon-only buttons (FAB, back chevron, tab icons) lack `accessibilityLabel` props. Custom components like `TaskCard` with `PanResponder` gestures need `accessibilityRole` and `accessibilityActions` for VoiceOver support. |
| UX & Design | B | Intuitive onboarding, well-designed Today/Tasks screens with confetti feedback, and a cohesive design system. Gaps include no undo for deletion/completion, inconsistent filter persistence across tab switches, and the previously silent error handling on task deletion (BUG-5, now fixed). |
| Security | C- | CORS allows all origins in production (`cors()` with no arguments in `route.ts`). Household store data not cleared on logout — leaks previous user's tasks/members to the next session. No server-side size validation on avatar base64 uploads. Rate limiting is in-memory only (resets on cold start). |
| SEO | N/A | Not applicable — native mobile application. Meta tags, sitemaps, and canonical URLs are web-specific concepts. |
| Maintainability | B | Well-organized monorepo with detailed `DEVELOPER_GUIDE.md`, consistent design tokens, and a 41-check backend smoke test. Downgraded due to code duplication (complete/delete handlers, picker modals) and the string-based category system which creates coupling without referential integrity. |

## Critical Issues (Fix Immediately)

### 1. App Store Rejection: No Account Deletion Flow
**Severity:** Blocker — Apple Requirement 5.1.1(v)
**Files:** `mobile/app/(app)/settings/index.tsx`, `api/lib/routes/auth.ts`

Apple requires all apps that support account creation to also offer in-app account deletion. The settings screen (~900 lines) has no delete account option. Requires: a new UI element with confirmation dialog, a `DELETE /api/users/me` endpoint that cascades deletion through members/tasks/completions, and refresh token revocation.

### 2. App Store Rejection: Missing Privacy Manifest
**Severity:** Blocker
**File:** `mobile/app.json`

No `PrivacyInfo.xcprivacy` file is configured. Apple requires this manifest to declare API usage reasons (e.g., UserDefaults, disk space, file timestamps). Apps without it are rejected during review.

### 3. App Store Rejection: Missing Photo Library Usage Description
**Severity:** Blocker
**File:** `mobile/app.json`

The `expo-image-picker` plugin is listed but `NSPhotoLibraryUsageDescription` is not in `infoPlist`. iOS will crash on first photo picker access without this key, and App Review will reject the binary.

### 4. Security/Privacy: Household Data Not Cleared on Logout
**Severity:** Critical
**File:** `mobile/lib/store.ts`

`useHouseholdStore` has a `.clear()` method (line ~252) but the `logout()` handler in `useAuthStore` (line ~127) only clears auth state — it never calls `useHouseholdStore.getState().clear()`. After logout, all previous household data (tasks, members, completions, rooms, categories) remains in memory and is accessible to the next user who logs in on the same device.

### 5. Security: CORS Allows All Origins in Production
**Severity:** Critical
**File:** `api/app/api/[[...route]]/route.ts` (line 30)

`cors()` is called with no arguments, allowing requests from any origin. The API should restrict origins to the app's domain or use a strict allowlist.

### 6. Security: No Server-Side Avatar Upload Size Validation
**Severity:** High
**File:** `api/lib/routes/members.ts` (line 20)

The `avatarUrl` field accepts `z.string().nullable().optional()` with no length constraint. A malformed client could POST arbitrarily large base64 strings, consuming database storage and degrading performance. Should validate max string length (~70KB for a 200×200 JPEG).

## High Priority (Fix This Sprint)

### 1. Performance: Unmemoized Leaderboard Calculation
**File:** `mobile/app/(app)/family/index.tsx` (lines 36–43)

`weeklyCompletions()` is called inside `.sort()` for every member comparison on every render. This recalculates the 7-day completion count repeatedly. Wrap the per-member counts in `useMemo` keyed on `completions` and `members`.

### 2. Performance: ScrollView for Long Lists
**Files:** `mobile/app/(app)/(home)/index.tsx`, `mobile/app/(app)/family/index.tsx`

Both screens render task lists with `ScrollView` + `.map()`. As households accumulate tasks, this renders all items regardless of visibility. Migrate to `@shopify/flash-list` for virtualized rendering with recycled cells.

### 3. Maintainability: Duplicated Task Action Handlers
**Files:** `mobile/app/(app)/(home)/index.tsx` (~lines 99–143), `mobile/app/(app)/family/index.tsx` (~lines 142–186)

`handleComplete` and `handleDelete` follow the same pattern on both screens: Alert → API call → optimistic store update → confetti/toast. Extract into a shared `useTaskActions()` hook that returns `{ handleComplete, handleDelete, completing }`.

### 4. Bug: Bundle ID Mismatch
**File:** `mobile/app.json`

Bundle identifier is still `com.chorify.app` but the rebrand to Keptt requires `com.keptt.app`. This mismatch will cause signing issues and App Store confusion if both IDs exist.

### 5. Timezone Consistency
**Files:** `mobile/components/AddTaskSheet.tsx` (BUG-3), `mobile/lib/store.ts` (BUG-4), `mobile/app/(app)/family/index.tsx` (BUG-8)

Three separate timezone inconsistencies were identified where device-local or UTC dates were used instead of the user's stored app timezone. BUG-3, BUG-4, and BUG-8 are marked as fixed in the TestFlight checklist — verify fixes are deployed.

## Medium Priority (Plan for Next Sprint)

### 1. UX: Undo for Destructive Actions
Implement an undo toast (3–5 second window) after task completion or deletion. The current flow is: confirm via Alert → immediate API call → no recovery. An undo toast with delayed API execution would prevent accidental data loss.

### 2. Maintainability: Shared Picker Modal Components
The room/category/member picker modal UI is duplicated across Today, Tasks, and AddTaskSheet with near-identical markup. Extract into shared components (`RoomPickerModal`, `CategoryPickerModal`, `MemberPickerModal`) in `mobile/components/`.

### 3. Code Quality: Dynamic Category Mapping in Packs
**File:** `mobile/constants/packs.ts` (120 lines)

Category names like `'home'`, `'pet'`, `'outdoor'`, `'vehicle'` are hardcoded. If a household has renamed or deleted these categories, imported pack tasks will reference non-existent categories. Map pack categories to the household's actual categories by matching name or falling back to the first available category.

### 4. Code Quality: Typed Router Navigation
**File:** `mobile/app/(app)/settings/index.tsx`

`router.push('/(app)/settings/rooms' as never)` suppresses TypeScript errors instead of using Expo Router's typed routes. Investigate `useRouter<AppRouter>()` or `href` objects for type-safe navigation.

## Low Priority (Nice to Have)

1. **ORM Migration:** Refactor API from raw `@libsql/client` queries to Drizzle ORM for type-safe queries, schema inference, and managed migrations. Currently all queries are hand-written SQL strings.
2. **Extended Completion Window:** The 30-day completions fetch window means `selectStreak()` under-counts streaks longer than 30 days. Either extend the window or track streak count as a denormalized field on the `members` table.
3. **Typed Routes:** Replace `router.push(... as never)` casts with Expo Router's typed routing solution when stable.
4. **Rate Limiting Persistence:** The in-memory sliding window rate limiter on auth endpoints resets on every Vercel cold start. Consider edge-compatible persistent rate limiting (e.g., Upstash Redis) if abuse becomes a concern.
5. **Invite Code Rate Limiting:** The `/api/households/join` endpoint has no rate limiting, making the 6-character alphanumeric invite code (36^6 ≈ 2.2B combinations) theoretically brute-forceable.

## Component Audit

| Component | Lines | Complexity | Notes |
|---|---|---|---|
| `AddTaskSheet.tsx` | 851 | High | Multi-step form with nested category/room/member picker modals, recurrence selection, date chips. Reads categories/rooms from store correctly. |
| `EditTaskSheet.tsx` | 785 | High | Similar to AddTaskSheet. Populates fields from task prop via `useEffect`. Proper tablet responsiveness. |
| `TaskCard.tsx` | 396 | High | Custom `PanResponder` for swipe-to-delete gesture detection (`|dx| > 10`, `|dx| > |dy| × 1.5`). Animated spring to −80px threshold, then −500px off-screen on confirm. Category color applied via `getCategoryColor()`. |
| `Button.tsx` | 107 | Low | Variant/size system with proper color token usage. Clean, reusable. |
| `Input.tsx` | 89 | Low | `forwardRef` implementation with focus state management and error display. |
| `MemberAvatar.tsx` | 50 | Low | Renders `<Image>` for `avatar_url` or emoji text fallback. Handles base64 data URIs. |
| `Toast.tsx` | 77 | Medium | Animated entrance/exit with auto-hide (3000ms). Color variants for error/success/info. Proper cleanup on unmount. |

### Screen Complexity

| Screen | Lines | Notes |
|---|---|---|
| Today (`(home)/index.tsx`) | 793 | Three-section layout (overdue/today/completed), filter modals, FAB, confetti, pull-to-refresh, optimistic updates, error retry state. |
| Tasks (`family/index.tsx`) | ~700 | Four-filter pill system, leaderboard with weekly completion sort, same task action pattern as Today. |
| Settings (`settings/index.tsx`) | ~900+ | Profile section, avatar upload, member management, household info, invite code, notification preferences. Missing account deletion. |

## Dependency Review

- **Expo SDK 54:** The `DEVELOPER_GUIDE.md` references SDK 54 while `CLAUDE.md` mentions SDK 54 and memory notes mention SDK 55. Verify the actual installed version — mismatched SDK versions cause subtle build failures.
- **Security Audit:** The custom auth stack (`jose` for JWT, PBKDF2 via Web Crypto) is functional but carries ongoing maintenance risk. Any vulnerability in token handling or password hashing requires manual patching. Consider periodic review against OWASP mobile security guidelines.
- **Base64 Avatar Storage:** Storing images as base64 in SQLite (Turso) works at small scale but doesn't scale well. Each avatar is ~15–50KB of text stored inline. For a household app with <20 members this is fine, but monitor database size.
- **`expo-image-manipulator`:** Used for avatar resize. Verify compatibility with current Expo SDK — this package has had breaking API changes across SDK versions.
- **Dependency Audit:** Run `npm audit` and `npm outdated` in both `mobile/` and `api/` directories. No specific vulnerable packages identified from docs, but the codebase is dated March 2026 and dependencies should be refreshed.

## Recommendations

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | **Implement account deletion flow** — Add "Delete Account" button in settings with double-confirmation, and `DELETE /api/users/me` endpoint that cascades through all user data. | S (1–2 days) | Blocker — App Store will reject without this. |
| 2 | **Add Privacy Manifest + plist strings** — Configure `PrivacyInfo.xcprivacy` in `app.json` plugins and add `NSPhotoLibraryUsageDescription` to `infoPlist`. | XS (< 1 hour) | Blocker — crashes on photo picker, rejected in review. |
| 3 | **Fix logout data leak** — Call `useHouseholdStore.getState().clear()` inside `useAuthStore`'s `logout()` method. The `.clear()` method already exists. | XS (< 30 min) | Critical — data privacy violation. |
| 4 | **Restrict CORS origins** — Replace `cors()` with `cors({ origin: ['https://your-domain.com'] })` or remove CORS entirely since only native clients consume the API. | XS (< 30 min) | Critical — API exposed to any web origin. |
| 5 | **Memoize leaderboard sort** — Wrap `weeklyCompletions` per-member calculation in `useMemo` keyed on `[completions, members]`. | XS (< 30 min) | High — prevents unnecessary recalculations on every render. |
| 6 | **Add avatar size validation** — Add `.max(100000)` to the Zod schema for `avatarUrl` in `members.ts`, rejecting uploads over ~75KB base64. | XS (< 30 min) | High — prevents storage abuse. |
| 7 | **Migrate to FlashList** — Replace `ScrollView` + `.map()` with `@shopify/flash-list` on Today and Tasks screens. | M (2–3 days) | Medium — needed before task counts exceed ~50 per household. |
| 8 | **Extract shared task action hook** — Create `useTaskActions()` returning `{ handleComplete, handleDelete, completing }` to eliminate duplication between Today and Tasks screens. | S (1 day) | Medium — reduces maintenance surface. |

---

*Audit generated March 2026 based on `DEVELOPER_GUIDE.md` and source code analysis. All line numbers and findings verified against the current codebase.*
