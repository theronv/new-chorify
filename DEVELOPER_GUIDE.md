# Chorify — Developer Guide

> **Date:** March 2026
> **Status:** Beta · TestFlight confirmed working
> **Stack:** React Native · Expo SDK 54 · Hono · Turso/libSQL · Vercel Edge

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Mobile App Architecture](#3-mobile-app-architecture)
4. [API Architecture](#4-api-architecture)
5. [Data Model](#5-data-model)
6. [Auth Flow](#6-auth-flow)
7. [State Management](#7-state-management)
8. [Navigation](#8-navigation)
9. [Design System](#9-design-system)
10. [Key Features In Detail](#10-key-features-in-detail)
11. [Push Notifications](#11-push-notifications)
12. [CSV Import/Export](#12-csvimportexport)
13. [Bug Report](#13-bug-report)
14. [Improvement Opportunities](#14-improvement-opportunities)
15. [TestFlight Checklist](#15-testflight-checklist)
16. [Environment Setup & Building](#16-environment-setup--building)
17. [API Deployment & Database Migrations](#17-api-deployment--database-migrations)
18. [Backend Smoke Testing](#18-backend-smoke-testing)

---

## 1. Project Overview

**Chorify** is an iOS-first family chore management app. Households share tasks, track completions, and earn a weekly leaderboard ranking. The app supports tablet layouts, push notifications, CSV import/export, and custom categories and rooms.

- **Bundle ID:** `com.chorify.app`
- **Display name:** Chorify
- **Fonts:** Fraunces (display/headings) + DM Sans (body)
- **Primary color:** `#486966` (dark teal)

---

## 2. Monorepo Structure

```
new-chorify/
├── mobile/                  # Expo React Native app
│   ├── app/                 # Expo Router screens (file-based routing)
│   │   ├── _layout.tsx      # Root layout: fonts, auth hydration, splash
│   │   ├── index.tsx        # Entry redirect (login / onboarding / home)
│   │   ├── (auth)/          # Login + Signup screens
│   │   ├── (app)/           # Authenticated app (tab bar + settings sub-stack)
│   │   │   ├── _layout.tsx  # Tab bar; mounts push & timezone setup
│   │   │   ├── (home)/      # Today tab (index.tsx)
│   │   │   ├── family/      # Tasks tab (index.tsx)
│   │   │   └── settings/    # Settings tab + sub-screens
│   │   │       ├── index.tsx
│   │   │       ├── _layout.tsx
│   │   │       ├── rooms.tsx
│   │   │       ├── categories.tsx
│   │   │       ├── packs.tsx
│   │   │       └── csv.tsx
│   │   └── onboarding/      # Create or join household
│   ├── components/
│   │   ├── AddTaskSheet.tsx
│   │   ├── Button.tsx
│   │   ├── EditTaskSheet.tsx
│   │   ├── Input.tsx
│   │   ├── MemberAvatar.tsx
│   │   ├── TaskCard.tsx
│   │   └── Toast.tsx
│   ├── constants/
│   │   ├── colors.ts        # Brand palette, Shadows, Radius, CATEGORY_COLORS
│   │   ├── fonts.ts         # Font families + FontSize scale
│   │   ├── layout.ts        # useLayout() hook — tablet responsiveness
│   │   └── packs.ts         # Predefined task pack templates
│   ├── lib/
│   │   ├── api.ts           # Typed fetch wrapper + all API calls
│   │   ├── csv.ts           # RFC 4180 CSV parse/export
│   │   ├── notifications.ts # Push + background fetch setup
│   │   ├── store.ts         # Zustand stores (auth + household)
│   │   └── timezone.ts      # Timezone preference helpers
│   ├── types/
│   │   └── index.ts         # All shared TypeScript interfaces
│   ├── assets/
│   │   └── AppIcon.png      # App icon (also used inline in headers)
│   ├── app.json
│   └── package.json
│
└── api/                     # Hono on Vercel Edge
    ├── app/api/[[...route]]/
    │   └── route.ts         # Hono entry point
    └── lib/
        ├── auth.ts          # JWT (jose) + PBKDF2 password + refresh tokens
        ├── db.ts            # Turso/libSQL singleton
        ├── middleware.ts    # requireAuth + requireCron guards
        ├── utils.ts         # generateId, calcNextDue, todayISO
        └── routes/
            ├── auth.ts
            ├── households.ts
            ├── tasks.ts
            ├── rooms.ts
            ├── categories.ts
            ├── members.ts
            └── cron.ts
```

---

## 3. Mobile App Architecture

### Routing

Uses **Expo Router** (file-based, React Navigation underneath).

| Route | Screen |
|-------|--------|
| `/` | Redirect: no token → login, no household → onboarding, else → home |
| `/(auth)/login` | Login |
| `/(auth)/signup` | Signup |
| `/onboarding` | Create or Join household |
| `/(app)/(home)` | **Today** — overdue + due today + completed today; filter by room, category, member |
| `/(app)/family` | **Tasks** — all tasks with leaderboard; filter by room, member, date |
| `/(app)/settings` | **Settings** — household, profile, rooms, categories, notifications |
| `/(app)/settings/rooms` | Manage Rooms sub-screen |
| `/(app)/settings/categories` | Manage Categories sub-screen |
| `/(app)/settings/packs` | Task Packs (onboarding templates) |
| `/(app)/settings/csv` | CSV import/export |

### Initialization Sequence

```
app/_layout.tsx
  ├── useFonts() — blocks splash until DM Sans + Fraunces loaded
  ├── useAuthStore().hydrate() — reads tokens from SecureStore
  └── SplashScreen.hideAsync() — only when both complete

app/(app)/_layout.tsx (mounted after auth confirmed)
  ├── getTimezone() → setStoreTimezone()
  ├── load(householdId) — parallel fetch of all household data
  └── push notification setup (token register / daily schedule)
```

### Tablet Responsiveness

`useLayout()` from `constants/layout.ts`:

```typescript
// Breakpoint: width >= 768 pt (iPad)
isTablet:       boolean
contentPadding: 24 (tablet) | 16 (phone)
headerPadding:  32 (tablet) | 20 (phone)
contentMaxWidth: 680 | undefined
sheetMaxWidth:   560 | undefined
```

**Pattern — scroll views:**
```tsx
contentContainerStyle={[
  styles.scrollContent,
  {
    paddingLeft:   contentPadding + insets.left,
    paddingRight:  contentPadding + insets.right,
    maxWidth:      contentMaxWidth,
    alignSelf:     contentMaxWidth ? 'center' : undefined,
    width:         contentMaxWidth ? '100%' : undefined,
  },
]}
```

**Pattern — bottom sheets on tablet:**
```tsx
<View style={[styles.overlay, sheetMaxWidth && styles.overlayTablet]}>
  {/* overlayTablet = { alignItems: 'center' } */}
  <KeyboardAvoidingView style={[styles.kavContainer, sheetMaxWidth && { maxWidth: sheetMaxWidth }]}>
    ...
  </KeyboardAvoidingView>
</View>
```

---

## 4. API Architecture

Built with **Hono 4.7** on **Vercel Edge Runtime** (no Node.js native modules).

### Runtime constraints
- Must use `@libsql/client/web` (HTTP transport, no WebSocket/native)
- No Node.js `crypto`, `fs`, etc. — uses Web Crypto API
- JWT via `jose`, password hash via PBKDF2 (Web Crypto)

### Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | — | Create user account |
| POST | `/api/auth/login` | — | Login, returns token pair |
| POST | `/api/auth/refresh` | — | Rotate access + refresh tokens |
| POST | `/api/auth/logout` | Bearer | Invalidate refresh token |
| POST | `/api/households` | Bearer | Create household, seed rooms + categories |
| POST | `/api/households/join` | Bearer | Join via invite code |
| GET | `/api/households/:id` | Bearer | Household info |
| GET/POST | `/api/households/:id/members` | Bearer | List / add child member |
| GET/POST | `/api/households/:id/tasks` | Bearer | List / create task |
| GET | `/api/households/:id/completions` | Bearer | Last 30 days of completions |
| GET/POST | `/api/households/:id/rooms` | Bearer | List / create room |
| GET/POST | `/api/households/:id/categories` | Bearer | List / create category |
| PATCH/DELETE | `/api/tasks/:id` | Bearer | Update / delete task |
| POST | `/api/tasks/:id/complete` | Bearer | Complete task, advance next_due |
| PATCH/DELETE | `/api/rooms/:id` | Bearer | Update / delete room |
| PATCH/DELETE | `/api/categories/:id` | Bearer | Update / delete category (rename bulk-updates tasks) |
| PATCH | `/api/members/:id` | Bearer | Update member (name, emoji, pushToken, avatarUrl) |
| GET | `/api/cron/notifications` | Cron secret | Daily push notification dispatch |

### Cron Job
Runs at `0 15 * * *` UTC (8am PT). Finds members with push tokens and due/overdue tasks, sends batched push via Expo Push API. Handles `DeviceNotRegistered` by nulling the push_token in the DB.

---

## 5. Data Model

### Database: Turso (libSQL/SQLite)

```sql
users         (id, email, password_hash, created_at)
profiles      (id=user_id, household_id?, member_id?)
refresh_tokens (id, user_id, token_hash, expires_at, used, created_at)
households    (id, name, invite_code, owner_id, created_at)
members       (id, household_id, display_name, emoji, is_child, push_token, avatar_url, created_at)
tasks         (id, household_id, title, category, recurrence, assigned_to, room_id,
               next_due, last_completed, notes, is_private, owner_member_id, created_at)
completions   (id, task_id, member_id, household_id, completed_date, completed_at)
rooms         (id, household_id, name, emoji, sort_order, created_at)
categories    (id, household_id, name, emoji, sort_order, created_at)
```

**Important:**
- `task.category` is a plain `string` (matches `categories.name`); no FK constraint
- `avatar_url` stores base64 data URIs directly (max ~50KB JPEG after 200×200 resize)
- Completions are fetched for the last 30 days only
- Rooms delete → tasks `room_id` set to NULL (not cascaded)
- Categories delete → tasks reassigned to first remaining category

### Recurrence Values
`daily | weekly | biweekly | monthly | quarterly | biannual | annual | once | every_N_days`

`calcNextDue()` advances from the task's current `next_due` (not completion date), looping until the result is in the future. Overdue tasks catch up correctly.

---

## 6. Auth Flow

### JWT
- Algorithm: HS256
- Payload: `{ sub: userId, hid: householdId, mid: memberId }`
- Expiry: 7 days
- Secret: `JWT_SECRET` env var

### Refresh Tokens
- 32-byte random, URL-safe base64
- Hash stored in DB (SHA-256)
- Expiry: 30 days
- **Token rotation:** new pair issued on each use
- **Reuse detection:** entire user family invalidated on reuse (security)

### Silent Refresh (client-side)
`api.ts` deduplicates concurrent refresh calls via `_refreshPromise` singleton:

```typescript
if (res.status === 401 && retry) {
  if (!_refreshPromise) {
    _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null })
  }
  const newToken = await _refreshPromise
  if (newToken) return request(path, options, false)  // retry once
  throw { error: 'Session expired', status: 401 }
}
```

### SecureStore Keys
| Key | Content |
|-----|---------|
| `keptt.access_token` | JWT access token *(legacy name from prior app "Keppt")* |
| `keptt.refresh_token` | Refresh token *(same note)* |
| `chorify.push_token` | Cached Expo push token (avoids unnecessary PATCH) |
| `chorify.timezone` | User timezone preference string |
| `chorify.notif_pref` | `'task' \| 'daily' \| 'none'` |

---

## 7. State Management

Two Zustand stores, defined in `lib/store.ts`.

### `useAuthStore`
Holds decoded JWT claims. Hydrated from SecureStore on app launch.

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string \| null` | Raw JWT |
| `refreshToken` | `string \| null` | Refresh token |
| `userId` | `string \| null` | JWT `sub` |
| `householdId` | `string \| null` | JWT `hid` |
| `memberId` | `string \| null` | JWT `mid` |
| `isHydrated` | `boolean` | Guards splash screen |

Key methods: `hydrate()`, `setTokens()`, `updateAccessToken()`, `logout()`

### `useHouseholdStore`
All household data. Loaded in parallel on app mount and on pull-to-refresh.

| Field | Type | Description |
|-------|------|-------------|
| `household` | `Household \| null` | |
| `members` | `Member[]` | |
| `tasks` | `Task[]` | |
| `completions` | `Completion[]` | |
| `rooms` | `Room[]` | |
| `categories` | `HouseholdCategory[]` | |
| `isLoading` | `boolean` | True while `load()` is in flight |
| `loadError` | `string \| null` | Set when `load()` throws; cleared on next call |

Key methods: `load(householdId, silent?)`, `addTask`, `updateTask`, `removeTask`, `addCompletion`, `addRoom`, `updateRoom`, `removeRoom`, `addCategory`, `updateCategory`, `removeCategory`, `renameCategoryOnTasks`

#### `load()` error handling
`load()` wraps the parallel fetch in a `try/catch`. On failure it sets `loadError` with the error message and never updates the data fields. The Today screen subscribes to `loadError` and renders a full-screen error state with a **Try Again** button when it is non-null. Pass `silent = true` to suppress the loading spinner (e.g. background refreshes).

### Selectors (module-level functions, not hooks)
```typescript
selectTodaysTasks(tasks)           // next_due <= today
selectUpcomingTasks(tasks)         // today < next_due <= today+7
selectIsCompletedToday(taskId, completions)
selectStreak(memberId, completions) // consecutive daily streak
```

### Timezone helpers
```typescript
setStoreTimezone(tz)   // called on mount + when user changes pref
getTodayString()       // YYYY-MM-DD in _tz timezone
getWeekFromNowString() // 7 days out in _tz timezone
```

---

## 8. Navigation

### Tab Bar (`app/(app)/_layout.tsx`)
Three tabs using Expo Router's `<Tabs>`:

| Tab | Route | Icon |
|-----|-------|------|
| Today | `(home)` | house.fill (Ionicons) |
| Tasks | `family` | list.bullet (Ionicons) |
| Settings | `settings` | gear (Ionicons) |

Tab bar styling: `borderTopWidth: 0`, upward box-shadow (no hard border line), active tint `#486966`.

### Settings Sub-stack (`settings/_layout.tsx`)
Nested stack navigator. Sub-screens: rooms, categories, packs, csv. All use `router.back()` + `<Ionicons name="chevron-back">` for back button (NOT "‹ Back" text).

---

## 9. Design System

### Color Tokens (`constants/colors.ts`)

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#486966` | Teal — CTAs, active states, checkmarks |
| `primaryLight` | `#EAF0EF` | Teal tint — selected backgrounds |
| `accent` | `#BD2A2E` | Red — danger actions |
| `background` | `#F4F2F0` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets |
| `textPrimary` | `#3B3936` | Main text (also used as `shadowColor`) |
| `textSecondary` | `#889C9B` | Secondary/muted text |
| `textTertiary` | `#B2BEBF` | Placeholders, hints |
| `textOnPrimary` | `#FFFFFF` | Text on teal backgrounds |
| `border` | `#C8D4D4` | Dividers, input borders |
| `borderSubtle` | `#EEF2F2` | Subtle backgrounds |
| `success` | `#3D8B6C` | Completed tasks |
| `warning` | `#C87D2A` | Due today |
| `danger` | `#BD2A2E` | Overdue / destructive |

**Shadow rule:** Always use `Colors.textPrimary` (`#3B3936`) as `shadowColor`, never `#000`.

### Shadows

```typescript
Shadows.sm     — subtle card depth
Shadows.card   — standard card
Shadows.md     — modals, toasts
Shadows.lg     — prominent sheets
Shadows.button — primary action buttons/FABs
```

### Border Radius Tokens

```typescript
Radius.xs   = 6
Radius.sm   = 8
Radius.md   = 12
Radius.lg   = 16
Radius.xl   = 20
Radius['2xl'] = 28
Radius.full = 9999
```

### Typography

**Fonts:**
- `Font.displayBold` / `Font.displaySemiBold` — Fraunces (screen titles, sheet titles)
- `Font.regular` / `Font.medium` / `Font.semiBold` / `Font.bold` — DM Sans

**Scale:**
`FontSize.xs=11`, `sm=13`, `base=15`, `md=17`, `lg=20`, `xl=24`, `2xl=30`, `3xl=36`

### Category Colors
`CATEGORY_COLORS` is an 8-color palette indexed by `sort_order % 8`. Each entry is `{ bg, text }`. Default categories (sort_order 0–5) map to the same colors as the legacy static set.

```typescript
const catColor = getCategoryColor(category.sort_order)
// catColor.bg  — light background
// catColor.text — saturated foreground text
```

---

## 10. Key Features In Detail

### Task Lifecycle
1. **Create** — `AddTaskSheet` → `householdsApi.createTask()` → `addTask()` in store
2. **View** — Partitioned by screen:
   - *Today screen:* Overdue | Due Today | Completed Today
   - *Tasks screen:* Overdue | Due Today | Upcoming (7d) | Later | No Date | Completed Today
3. **Complete** — Alert confirm → `tasksApi.complete()` → `addCompletion()` + `updateTask({ next_due, last_completed })` + confetti
4. **Edit** — Long press (400ms, haptic) → `EditTaskSheet`
5. **Delete** — Swipe left (threshold −80px) → Alert confirm → animate off-screen → `tasksApi.delete()` → `removeTask()`

### Task Filtering

**Today screen** — three independent filter pills in the header, each opening a modal picker:

| Filter | Options | State |
|--------|---------|-------|
| Room | All Rooms · each room | `filterRoomId: string \| null` |
| Category | All Categories · each category (with emoji) | `filterCategory: string \| null` (matched against `task.category` name) |
| Member | All Members · Unassigned · each member | `filterAssignedTo: string \| null` (`'unassigned'` = `task.assigned_to === null`) |

Filters are applied with `.filter()` before partitioning into Overdue / Due Today / Completed Today sections. All three filters are AND-combined.

**Tasks screen** — four filter pills inline with the task list:

| Filter | Options | Notes |
|--------|---------|-------|
| All | Resets all filters | Active when no other filter is set |
| Room | All Rooms · each room | Single-select |
| Member | All Members · each member | Single-select |
| Date | All Dates · Overdue · Today · This Week · No Date | Completed-today tasks always pass the date filter |

The date filter options map to these `task.next_due` conditions:
- **Overdue** — `next_due < today`
- **Today** — `next_due === today`
- **This Week** — `next_due <= weekStr` (7 days from now, via `getWeekFromNowString()`)
- **No Date** — `next_due === null`

All picker modals use a `ScrollView` with `maxHeight: 320` so they scroll when the list is long.

### Swipe-to-Delete (TaskCard)
Uses `PanResponder`. Horizontal-only gesture detected when `|dx| > 10` and `|dx| > |dy| × 1.5` and `dx < 0`. On release past threshold, springs to −80px while Alert shows. Confirmed → animate to −500px (off-screen) then call `onDelete`.

### Task Recurrence (`calcNextDue` — API)
Advances `next_due` from the existing due date (not today) until the result is in the future. This means catching up correctly from overdue states. Returns `null` for `once`.

### Categories
- Stored in `categories` table, linked to `household_id`
- `task.category` is a string matching `categories.name` (no FK)
- On rename: server bulk-updates all tasks + client calls `renameCategoryOnTasks()`
- On delete: server reassigns tasks to first remaining category; client mirrors via `renameCategoryOnTasks()`
- Cannot delete last category (server returns 409)
- Color by `sort_order % 8`

### Member Avatars
- Picked from device library via `expo-image-picker`
- Resized to 200×200 px @ 0.6 quality JPEG via `expo-image-manipulator`
- Stored as `data:image/jpeg;base64,...` string in Turso
- `MemberAvatar` renders `<Image>` if `avatar_url` present, else falls back to `member.emoji`

### Task Packs (`constants/packs.ts`)
7 predefined packs (Essential Home, Dog Care, Cat Care, Parent Pack, etc.). Each pack contains template tasks with hardcoded category strings. Applied in `settings/packs.tsx` via bulk `createTask()` calls.

---

## 11. Push Notifications

### Preference Modes

| Mode | Behavior |
|------|----------|
| `task` | Push token registered with Expo; server sends push per task via cron |
| `daily` | Push token cleared from server; local 8am notification scheduled |
| `none` | Push token cleared; no notifications |

### Token Management
- Cached in SecureStore (`chorify.push_token`) to avoid redundant PATCH calls
- Only PATCHes API when token differs from cached value
- `IS_EXPO_GO` flag guards push registration (not supported in Expo Go)

### Background Fetch (`lib/notifications.ts`)
Task ID: `keppt-background-fetch`. Runs at minimum 15-minute interval. Updates app badge count based on incomplete tasks due today. Reschedules daily summary if it was cancelled.

### Cron (API)
`GET /api/cron/notifications` — protected by `Authorization: Bearer <CRON_SECRET>`. Queries members with push tokens + due tasks. Sends in batches of 100 to Expo Push API. Clears `push_token` for any `DeviceNotRegistered` error.

---

## 12. CSV Import/Export

### Export Format
Headers: `id, title, category, recurrence, room, assigned_to, next_due, notes`
- `room` = room name (human-readable)
- `assigned_to` = member display_name
- Fully RFC 4180 compliant (quoted fields, CRLF, escaped quotes)

### Import
- `id` column present → update existing task
- `id` absent → create new task
- Required: `title`
- Defaults: `category=home`, `recurrence=weekly`
- `next_due` must be `YYYY-MM-DD` or empty
- Returns `ParsedTaskRow[]` with per-row `errors: string[]`

---

## 13. Bug Report

### 🔴 Critical

#### BUG-1: JWT tokens logged to console in production
**File:** `mobile/lib/api.ts:130–131`
```typescript
console.log('API request:', options.method ?? 'GET', url, options.body ?? '')
console.log('API response status:', res.status)
console.log('API response body:', await res.clone().text())  // ← logs full body including tokens
```
These fire on **every** API call including auth responses that contain `accessToken` and `refreshToken`. These are readable via device logs and any attached debugger in production builds.
**Fix:** Gate all three `console.log` statements behind `if (__DEV__)`.

---

#### BUG-2: `Completion` type missing from `api.ts` imports
**File:** `mobile/lib/api.ts:220`
```typescript
// Completion is used in return type but not imported
completions(id: string): Promise<{ completions: Completion[] }> { ... }
```
`Completion` is not in the `import type { ... } from '@/types'` block at the top of the file. TypeScript should flag this as a compile error. It works at runtime only due to type erasure.
**Fix:** Add `Completion` to the import block.

---

### 🟡 Medium

#### BUG-3: `addDays()` uses device timezone, not user's app timezone
**File:** `mobile/components/AddTaskSheet.tsx:39–43`
```typescript
function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')  // ← uses device timezone
}
```
The app stores a `chorify.timezone` preference (e.g. `America/Los_Angeles`) used by `getTodayString()`. But `addDays()` uses the device's local timezone. If the device timezone differs from the app timezone, the "Today" and "Tomorrow" chips could resolve to the wrong date.
**Fix:** Use `getTodayString()` from the store for the `days=0` chip, and derive all others from the same timezone-aware base date.

---

#### BUG-4: `selectStreak()` mixes UTC and local time
**File:** `mobile/lib/store.ts:283–293`
```typescript
let current = new Date()
current.setHours(0, 0, 0, 0)       // ← local midnight

const d = new Date(date + 'T00:00:00Z')  // ← UTC midnight
const diffDays = Math.round((current.getTime() - d.getTime()) / 86_400_000)
```
`current` is set to local midnight while `d` is parsed as UTC midnight. In timezones west of UTC (e.g. UTC−8) this produces a 28,800,000ms offset that can cause `diffDays` to round to 0 or 2 instead of 1, breaking the streak.
**Fix:** Parse both dates consistently — either both UTC or both local.

---

#### BUG-5: Silent error on task delete causes state drift
**Files:** `mobile/app/(app)/(home)/index.tsx:122–126`, `mobile/app/(app)/family/index.tsx:162–168`
```typescript
async function handleDelete(task: Task) {
  try {
    await tasksApi.delete(task.id)
    removeTask(task.id)
  } catch {
    // Task card has already animated off; silently ignore
  }
}
```
The TaskCard animation runs inside `onDelete` which is called after the user confirms. `snapOff(onDelete)` runs the API call only after the card is already off-screen. If the API fails (network error, session expired), the task disappears from the UI but still exists on the server. On next pull-to-refresh it reappears with no explanation to the user.
**Fix:** Show a Toast error. Optionally re-insert the task into the store on failure.

---

#### BUG-6: Add Member button locked when toggle is set to "Adult"
**File:** `mobile/app/(app)/settings/index.tsx:568`
```typescript
disabled={!displayName.trim() || !isChild || memberLoading}
```
The Save button is disabled when `isChild` is `false`. This means adults cannot be added via this form regardless of input. The `Switch` component still renders the toggle and lets the user flip it, but it's permanently non-functional for the "Adult" state. The toggle text says "Adults join via the invite code above" which explains the intent, but the toggle itself is misleading.
**Fix:** Either remove the Switch entirely (just explain adult members join via invite code), or keep the toggle but visually disable it (and perhaps auto-reset it when the sheet opens).

---

### 🟢 Low / Informational

#### BUG-7: Legacy SecureStore key names
**File:** `mobile/lib/api.ts:48–49`
```typescript
const ACCESS_KEY  = 'keptt.access_token'
const REFRESH_KEY = 'keptt.refresh_token'
```
The app is named "Chorify" but these keys still use the old "Keppt" prefix. No functional impact, but confusing for new developers and visible in device keychain.

---

#### BUG-8: `weeklyCompletions()` uses UTC, not app timezone
**File:** `mobile/app/(app)/family/index.tsx:36–42`
```typescript
const cutoff = new Date()
cutoff.setUTCDate(cutoff.getUTCDate() - 7)
const cutoffStr = cutoff.toISOString().slice(0, 10)
```
The 7-day leaderboard cutoff is UTC-based while all other date comparisons use the user's stored timezone. Minor discrepancy that affects which completions appear in "This Week" near midnight.

---

#### BUG-9: `profilePoints` style defined but never used
**File:** `mobile/app/(app)/settings/index.tsx:729`
```typescript
profilePoints: {
  fontFamily: Font.regular,
  fontSize:   FontSize.sm,
  color:      Colors.textSecondary,
},
```
Dead code. Safe to remove.

---

#### BUG-10: `load()` failure shows empty state with no error ✓ Fixed
**File:** `mobile/lib/store.ts`
If any of the parallel API calls in `load()` failed (except `categories` which had an explicit `.catch` fallback), the store's `try` block exited without updating state. The UI showed empty lists with no error message and no way to retry.
**Fix:** Added `loadError: string | null` to `useHouseholdStore`. `load()` now catches errors, sets `loadError`, and the Today screen renders a full-screen error state with a **Try Again** button when `loadError` is non-null. This was the root cause of the "no data after sign-in" bug observed in TestFlight (see section 17 for the underlying API deployment issue that triggered it).

---

## 14. Improvement Opportunities

### UX
- **No undo for task delete** — after swiping and confirming, there's no way to recover a deleted task. An undo toast would improve the experience.
- **Room filter persists on navigation** — the room filter on the Today screen resets to "All Rooms" when the sheet is dismissed but does not persist across tab switches. This is likely intentional but worth confirming.
- **Tasks screen leaderboard re-renders on every keystroke** — `weeklyCompletions()` is re-called inside `.sort()` for every member comparison. Cache these counts with `useMemo`.

### Code Quality
- **Duplicated `handleComplete` / `handleDelete` logic** — the Today screen and Tasks screen have near-identical implementations. Extract to a shared hook or utility.
- **Duplicated picker modal UI** — the room picker modal appears in Today, Tasks, and AddTaskSheet with identical markup. A shared `RoomPickerModal` component would reduce duplication.
- **`as never` router type cast** — `router.push('/(app)/settings/rooms' as never)` in settings/index.tsx suppresses type errors instead of using typed routes.
- **Task pack categories are hardcoded strings** — `constants/packs.ts` hardcodes category names like `'home'`, `'pet'`, `'outdoor'`. If a household has renamed these categories, pack tasks will be created with mismatched categories. Consider mapping to the household's actual first-available category as a fallback.
- **Completions window is 30 days** — `selectStreak()` can only see 30 days of history. A streak longer than 30 days will be under-counted. If streaks become a key feature, extend the completions fetch window or track streak separately.
- **`updateCategory` uses type assertion** — `categories.tsx:81` casts `category.name` and `category.emoji` as strings. The response already has the correct types from the server; the casts are unnecessary.

### Security
- **Rate limiting** — no rate limiting on the auth endpoints (`/api/auth/login`, `/api/auth/signup`). Add Vercel Edge rate limiting or use a middleware guard.
- **Avatar size** — base64 data URIs are stored directly in Turso. A 200×200 JPEG at 0.6 quality is typically 15–35KB. No server-side size validation exists. A malformed client could send a larger payload.
- **Invite code entropy** — 6-character alphanumeric (36^6 ≈ 2.2 billion combinations) with 5 collision retries. Adequate for a household app with low volume, but brute-forcing the join endpoint is theoretically possible without rate limiting.

---

## 15. TestFlight Checklist

### Fixes completed ✓
- [x] **BUG-1** — Gate production `console.log` in `api.ts` and `_layout.tsx` behind `__DEV__`
- [x] **BUG-2** — Add `Completion` to imports in `api.ts`
- [x] **BUG-3** — Fix `addDays()` to use app timezone in `AddTaskSheet`
- [x] **BUG-4** — Fix `selectStreak()` timezone mixing in `store.ts`
- [x] **BUG-5** — Add error Toast for failed task delete on Today + Tasks screens
- [x] **BUG-6** — Remove non-functional `isChild` toggle from Add Member sheet
- [x] **BUG-8** — Fix `weeklyCompletions()` to use app timezone in Tasks screen
- [x] **BUG-9** — Remove unused `profilePoints` style
- [x] **BUG-10** — `load()` now catches errors; Today screen shows retry UI on failure
- [x] `EXPO_PUBLIC_API_URL` set to production URL in `eas.json` production env
- [x] Push notification entitlements and EAS project ID confirmed in `app.json`
- [x] API deployed to Vercel (`npx vercel --prod` from `api/`)
- [x] Turso DB migrations applied (`is_private`, `owner_member_id` columns added to `tasks`)
- [x] Full backend smoke test passing (41/41 checks) — confirmed March 2026

### Remaining (future releases)
- [ ] **BUG-7** — Rename legacy SecureStore keys from `keptt.*` to `chorify.*` (requires migration on first launch)
- [ ] Rate limiting on `/api/auth/login` and `/api/auth/signup`

### QA Test Cases
- [ ] Create account → create household → add tasks → complete tasks
- [ ] Invite code share + join from second device
- [ ] Add child member and verify they appear in leaderboard
- [ ] Task recurrence: complete a weekly task, verify next_due advances 7 days
- [ ] Complete overdue task, verify next_due jumps to future (not yesterday+7)
- [ ] Swipe delete task; pull-to-refresh confirms deletion
- [ ] Category rename: verify all tasks update
- [ ] Category delete: verify tasks reassigned to first remaining category
- [ ] CSV export → edit in Numbers/Excel → re-import updates existing tasks
- [ ] Push notification: task mode on real device (not Simulator)
- [ ] Daily notification: verify 8am local schedule
- [ ] Sign out → sign back in → data reloads correctly
- [ ] Tablet (iPad): verify max-width centering on all screens and sheets

---

## 16. Environment Setup & Building

### Prerequisites

| Tool | Purpose |
|------|---------|
| Node 20+ | JavaScript runtime |
| npm | Package manager |
| Expo CLI (`npm i -g expo-cli`) | `expo start`, `expo prebuild` |
| EAS CLI (`npm i -g eas-cli`) | Cloud builds (optional) |
| CocoaPods (`gem install cocoapods`) | iOS dependency manager (Xcode path) |
| Xcode 16+ | iOS builds and TestFlight submission |
| Turso CLI | Local DB management |
| Vercel CLI | Local API dev server |

---

### Local Development Setup

**Mobile:**
```bash
cd mobile
cp .env.example .env.local
# Set EXPO_PUBLIC_API_URL to your machine's LAN IP — iOS Simulator cannot use localhost
# Find your IP:  ipconfig getifaddr en0
# Example:       EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
npm install
npx expo start
```

**API:**
```bash
cd api
cp .env.example .env.local
# Required env vars:
#   TURSO_URL=libsql://your-db.turso.io
#   TURSO_AUTH_TOKEN=...
#   JWT_SECRET=<random 32+ char string>
#   CRON_SECRET=<random 32+ char string>
npm install
vercel dev
```

---

### Testing on Device (Without TestFlight)

There are three scenarios with different server requirements:

#### 1. Production `.ipa` → TestFlight (no server needed)
`eas build --local` (or Xcode Archive) bundles the JS into the `.ipa`. Once built, there is no dependency on Metro or any local server — everything is self-contained. Submit the `.ipa` directly:
```bash
eas submit --platform ios --latest
```
or drag the `.ipa` into Transporter.

#### 2. Running from Xcode directly (Metro required)
If you open the `ios/` folder in Xcode and hit Run (debug scheme), Expo's JS runtime looks for a Metro bundler over the network to load the JS bundle. You must have Metro running first:
```bash
cd mobile && npx expo start
```
Without this, the app will hang on launch searching for the dev server.

#### 3. Quick on-device testing without TestFlight
The fastest way to install and run on a physical device during development:
```bash
cd mobile && npx expo run:ios --device
```
This builds a debug `.app`, installs it on a connected device, and starts Metro automatically. No need to go through TestFlight — useful for rapid iteration on UI changes.

---

### Building for TestFlight

There are two paths: **EAS local build** (preferred) or **Xcode Archive**. Both produce identical binaries.

> **Default:** Always build locally with `eas build --local`. This uses your Mac's Xcode toolchain, bypasses the EAS Free plan's monthly cloud build quota, and keeps credentials managed by EAS (no manual signing setup).

`autoIncrement: true` in `eas.json` means EAS manages the build number automatically — no need to edit `app.json` manually.

---

### Path A — EAS Local Build (preferred)

**Requirements:** EAS CLI, logged-in Expo account (`eas whoami`), Xcode 16+.

The `EXPO_PUBLIC_API_URL` for production is set in `eas.json` and the build number is auto-incremented remotely.

#### Build
```bash
cd mobile
eas build --platform ios --profile production --local
```
This runs the full Xcode build on your Mac and outputs a `.ipa` file (typically in `~/Library/Developer/Xcode/Archives` or the current directory).

#### Submit to TestFlight
```bash
eas submit --platform ios --latest
```
Build appears in App Store Connect → TestFlight within a few minutes. Apple's automated review takes 5–15 minutes before testers can install it.

> **Note:** The EAS Free plan has a limited number of *cloud* iOS builds per month. Local builds (`--local`) are unlimited and bypass this quota entirely.

---

### Path B — Xcode Archive (manual)

Use this if EAS CLI is unavailable or you need full control over Xcode build settings.

**Requirements:** Xcode 16+, CocoaPods, Apple Developer account, app record in App Store Connect.

#### 1. Generate the native iOS project
```bash
cd mobile
npx expo prebuild --platform ios --clean
```
`--clean` wipes any existing `ios/` folder and regenerates it fresh from `app.json` and plugins. The production `EXPO_PUBLIC_API_URL` is baked in from `.env.local` at this step.

#### 2. Install CocoaPods dependencies
```bash
cd ios
pod install
cd ..
```

#### 3. Open in Xcode
```bash
open ios/Chorify.xcworkspace
```
> Always open the `.xcworkspace`, never the `.xcodeproj`.

#### 4. Configure signing
1. Click the **Chorify** project in the file tree
2. Select the **Chorify** target → **Signing & Capabilities** tab
3. Enable **Automatically manage signing**
4. Set **Team** to your Apple Developer account
5. Bundle ID should read `com.chorify.app`

#### 5. Bump the build number
In Xcode under **General → Identity**, increment the Build field (or edit `app.json` → `ios.buildNumber` before prebuild).

#### 6. Archive
1. Set scheme to **Chorify**, destination to **Any iOS Device (arm64)**
2. **Product → Archive** (takes 3–5 minutes)
3. The **Organizer** window opens when complete

#### 7. Upload to TestFlight
1. Select the archive in Organizer
2. **Distribute App → App Store Connect → Upload**
3. Leave all defaults (strip symbols, upload bitcode)
4. Click **Distribute**

---

### Build Profile Summary

| Profile | Distribution | Use case |
|---------|-------------|----------|
| `development` | Internal (ad-hoc) | Dev client on your own device |
| `preview` | Internal (ad-hoc) | Ad-hoc testing without App Store |
| `production` | Store | TestFlight + App Store submission |

---

### Adding TestFlight Testers

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Chorify → **TestFlight** → select the build
3. **Internal testers** (your team, up to 100): available immediately after upload
4. **External testers** (public beta): requires a brief Beta App Review — usually same day

---

---

## 17. API Deployment & Database Migrations

### Deploying the API

The API is hosted on Vercel. **Vercel is not connected to a Git repository** — deploys must be triggered manually from the CLI.

```bash
cd api
npx vercel --prod
```

The Vercel project is `theronvickery-5684s-projects/api`, aliased to `https://api-eight-pi-38.vercel.app`.

> **Warning:** `npx vercel env pull` (or the implicit pull during `vercel --prod`) will overwrite `api/.env.local` with the Vercel **Development** environment, which does not contain `JWT_SECRET`, `TURSO_URL`, or `TURSO_AUTH_TOKEN` (those are Production-only vars). Back up your local `.env.local` before deploying if you need it for local dev.

### Turso Database

**Database name:** `chorify-theronv`
**URL:** `libsql://chorify-theronv-theronv.aws-us-west-2.turso.io`

Shell access:
```bash
turso db shell chorify-theronv
```

The full desired schema is in `api/TURSO_SCHEMA.sql`. `CREATE TABLE IF NOT EXISTS` statements are safe to re-run. `ALTER TABLE` statements at the bottom of the file are migrations and will error if the column already exists — check first with:

```bash
turso db shell chorify-theronv "PRAGMA table_info(tasks)"
```

### Migration History

| Date | Migration | Reason |
|------|-----------|--------|
| March 2026 | `ALTER TABLE tasks ADD COLUMN room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL` | Rooms feature |
| March 2026 | `ALTER TABLE tasks ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0` | Private tasks feature |
| March 2026 | `ALTER TABLE tasks ADD COLUMN owner_member_id TEXT REFERENCES members(id) ON DELETE SET NULL` | Private tasks feature |

### What Happens If You Forget to Deploy or Migrate

This caused the "no data after sign-in" bug in the first TestFlight beta:

1. Rooms + categories routes and the string-category change were added to the codebase but not deployed
2. `GET /api/households/:id/rooms` returned 404
3. `load()` in the store had no catch block, so the entire load silently failed
4. Users saw an empty app with no error message

**Lesson:** Any time routes are added or the DB schema changes, both a Vercel deploy **and** a Turso migration must be run before shipping a new build. BUG-10 is now fixed so future failures will at least show a visible error with a retry button.

---

## 18. Backend Smoke Testing

A Python smoke test can be run against the production API to verify all endpoints before shipping a build. It creates a throwaway account, exercises every endpoint, then cleans up.

```bash
python3 << 'EOF'
import urllib.request, urllib.error, json, time

BASE = "https://api-eight-pi-38.vercel.app/api"
# ... (see smoke test script in session history)
EOF
```

### What the smoke test covers (41 checks)

| # | Operation | Verifies |
|---|-----------|---------|
| 1 | Signup | HTTP 201, accessToken, refreshToken, userId |
| 2 | Login | HTTP 200, accessToken |
| 3 | Create Household | HTTP 201, householdId, invite_code |
| 4 | Get Household | HTTP 200, name match |
| 5 | Get Members | HTTP 200, 1 member seeded |
| 6 | Get Rooms | HTTP 200, 5 default rooms seeded |
| 7 | Get Categories | HTTP 200, 6 default categories seeded |
| 8 | Create Task | HTTP 201, taskId, next_due |
| 9 | Update Task | HTTP 200, title updated |
| 10 | Complete Task | HTTP 200, completion.id, nextDue |
| 11 | Get Completions | HTTP 200, 1 completion |
| 12 | Get Tasks | HTTP 200, 1 task |
| 13 | Room CRUD | create 201 / update name / delete 204 |
| 14 | Category CRUD | create 201 / update name / delete 204 |
| 15 | Update Member | HTTP 200, ok: true |
| 16 | Token Refresh | HTTP 200, new refreshToken |
| 17 | Delete Task | HTTP 204 |
| 18 | Logout | HTTP 200, ok: true |
| 19 | Auth guard | Invalid token → 401 |

### Common failure patterns

| Symptom | Likely cause |
|---------|-------------|
| Rooms/categories return 404 | API not deployed after adding those routes |
| Create task returns 500 | DB missing `is_private` or `owner_member_id` column |
| Create task returns 400 with `invalid_enum_value` | Old API deployment still using hardcoded category enum |
| 308 redirect on PATCH/DELETE | Upstream failure left an empty ID — chase the first ❌ |
| Health check returns `{"ok":true}` but everything else fails | Vercel cold start — wait 5s and retry |

---

*Document updated March 2026 after TestFlight beta verification. Review against code before major releases.*
