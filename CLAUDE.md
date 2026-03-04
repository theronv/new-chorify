# Chorify — Claude Code Context

Full developer reference: `DEVELOPER_GUIDE.md`

## Stack
React Native · Expo SDK 54 · Expo Router · Zustand · TypeScript · Hono 4.7 · Turso/libSQL · Vercel Edge

## Monorepo
```
mobile/   — Expo app
api/      — Hono on Vercel Edge
```

## Key Files
| File | Purpose |
|------|---------|
| `mobile/lib/api.ts` | All API calls — typed fetch wrappers, silent token refresh |
| `mobile/lib/store.ts` | Zustand stores: `useAuthStore`, `useHouseholdStore` |
| `mobile/types/index.ts` | All shared TypeScript interfaces |
| `mobile/constants/colors.ts` | Color tokens, `Shadows`, `Radius`, `CATEGORY_COLORS` |
| `mobile/constants/fonts.ts` | `Font.*` families + `FontSize.*` scale |
| `mobile/constants/layout.ts` | `useLayout()` hook — tablet responsiveness |
| `mobile/app/(app)/_layout.tsx` | Tab bar; mounts household data load + push setup |
| `api/lib/routes/` | One file per resource: auth, households, tasks, rooms, categories, members, cron |
| `api/TURSO_SCHEMA.sql` | Full DB schema + migration history |

---

## Critical Rules

### API (`api/`)
- Must use `@libsql/client/web` — HTTP transport only, no WebSocket, no native modules
- No `node:crypto`, `fs`, `path`, etc. — use Web Crypto API (`jose` for JWT, PBKDF2 for passwords)
- All routes registered in `api/app/api/[[...route]]/route.ts` via Hono

### Mobile (`mobile/`)
- All `console.log` must be gated: `if (__DEV__) console.log(...)`
- Never call API directly from components — use typed wrappers in `lib/api.ts`
- Never hardcode category strings — always read from `useHouseholdStore(s => s.categories)`
- Use `expo-file-system/legacy` (not `expo-file-system`) for `writeAsStringAsync` / `EncodingType` in SDK 54
- SecureStore keys `keptt.access_token` and `keptt.refresh_token` are legacy names — do not rename without a first-launch migration

---

## Design System

### Colors
Always use tokens from `colors.ts`, never raw hex values.
- `shadowColor` is always `Colors.textPrimary` (`#3B3936`), never `#000`
- Text on primary backgrounds uses `Colors.textOnPrimary`, never `'#fff'`

### Shadows
`Shadows.sm` / `Shadows.card` / `Shadows.md` / `Shadows.lg` / `Shadows.button`

### Radius
`Radius.xs=6` / `sm=8` / `md=12` / `lg=16` / `xl=20` / `2xl=28` / `full=9999`

### Typography
`Font.displayBold` / `Font.displaySemiBold` — Fraunces (titles)
`Font.regular` / `Font.medium` / `Font.semiBold` / `Font.bold` — DM Sans

### Back Buttons
Use `<Ionicons name="chevron-back" size={24} color={Colors.primary} />`, not `‹ Back` text.

### Category Colors
`getCategoryColor(sort_order)` from `constants/colors.ts` — returns `{ bg, text }`. Index by `sort_order % 8`.

---

## Tablet Responsiveness

All screens must call `useLayout()` from `constants/layout.ts`:
```typescript
const { isTablet, contentPadding, headerPadding, contentMaxWidth, sheetMaxWidth } = useLayout()
```

**ScrollView pattern:**
```tsx
contentContainerStyle={[styles.scrollContent, {
  paddingLeft:  contentPadding + insets.left,
  paddingRight: contentPadding + insets.right,
  maxWidth:     contentMaxWidth,
  alignSelf:    contentMaxWidth ? 'center' : undefined,
  width:        contentMaxWidth ? '100%' : undefined,
}]}
```

**Bottom sheet pattern:**
```tsx
<View style={[styles.overlay, sheetMaxWidth && { alignItems: 'center' }]}>
  <KeyboardAvoidingView style={[styles.sheet, sheetMaxWidth && { maxWidth: sheetMaxWidth }]}>
```

---

## State Management

### `useAuthStore`
Tokens + decoded JWT claims (`userId`, `householdId`, `memberId`). Hydrated from SecureStore on app launch.

### `useHouseholdStore`
All household data. Fields: `household`, `members`, `tasks`, `completions`, `rooms`, `categories`, `isLoading`, `loadError`.

- `load(householdId, silent?)` — parallel fetch of all 6 endpoints; catches errors and sets `loadError`
- `loadError !== null` → Today screen renders a full-screen retry state
- The `categories` fetch has a `.catch` fallback; all others will set `loadError` on failure

### Selectors (module-level, not hooks)
```typescript
selectTodaysTasks(tasks)
selectUpcomingTasks(tasks)
selectIsCompletedToday(taskId, completions)
selectStreak(memberId, completions)
getTodayString()          // YYYY-MM-DD in app timezone
getWeekFromNowString()    // +7 days in app timezone
```

---

## Safe Area & Layout Convention
All screens use `useSafeAreaInsets()` for top/bottom padding. Apply to header `paddingTop` and scroll `paddingBottom`.

---

## Auth Flow
- JWT HS256, 7-day expiry, payload: `{ sub: userId, hid: householdId, mid: memberId }`
- Refresh tokens: 30-day, rotate on use, reuse detection invalidates entire family
- Silent refresh: on 401, `api.ts` deduplicates via `_refreshPromise` singleton, retries once
- After household create/join, a new access token with updated claims is returned — store it via `updateAccessToken()`

---

## Database (Turso)

**Database:** `chorify-theronv`
**Shell:** `turso db shell chorify-theronv`

Tables: `users`, `profiles`, `households`, `members`, `tasks`, `completions`, `rooms`, `categories`, `refresh_tokens`, `rewards`

Key schema notes:
- `task.category` is a plain `string` — matches `categories.name`, no FK constraint
- `task.room_id` is nullable — rooms delete sets to NULL (no cascade)
- Categories delete reassigns tasks to first remaining category; last category cannot be deleted (409)
- Default seeds: 5 rooms + 6 categories on household create; categories lazy-seeded on first GET for existing households

---

## Deploy Checklist — Every Release

1. **Bump `buildNumber`** in `mobile/app.json` (Xcode path) — EAS `autoIncrement` handles it automatically when using `eas build`
2. **Deploy API** if any route or middleware changed:
   ```bash
   cd api && npx vercel --prod
   ```
3. **Run Turso migration** if DB schema changed. Always check columns first:
   ```bash
   turso db shell chorify-theronv "PRAGMA table_info(tasks)"
   ```
   Then apply any `ALTER TABLE` statements from `api/TURSO_SCHEMA.sql` that are missing.
4. **Run backend smoke test** (41 checks) before submitting the build — see §18 of DEVELOPER_GUIDE.md.

> Skipping steps 2–3 was the root cause of the "no data after sign-in" bug in the first TestFlight beta.

---

## Open Issues

| ID | Issue |
|----|-------|
| BUG-7 | SecureStore keys use `keptt.*` prefix (legacy from prior app "Keppt") — rename requires first-launch migration |
| — | No rate limiting on `POST /api/auth/login` or `POST /api/auth/signup` |
