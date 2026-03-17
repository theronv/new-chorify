# App Scrutiny Report
**Generated:** March 14, 2026
**Verdict:** READY WITH CONDITIONS [Implement real reward claiming, add monetization paywall]
**GTM Verdict:** This app is 1-2 weeks from being ready to acquire its first paying users, assuming the rewards claiming logic and paywall are implemented.

---

## 1. App Identity

- **What does this app actually do?** It is a shared household chore tracker that gamifies task completion through points, streaks, and a weekly leaderboard.
- **Who is it for?** Families and cohabitants who want to manage shared recurring tasks, with specific features (like points and rewards) catering to parents managing children's chores.
- **What is the single action the app is designed to make easy?** Checking off a daily/weekly chore and getting immediate visual and quantitative feedback (points/confetti).
- **Is that action currently easy?** Yes. Tasks are categorized by due date, and completing a task requires a single tap and confirmation, instantly updating the UI with confetti and point increments.

---

## 2. Project Inventory

- `mobile/app/` (Expo Router app) — ✅ Complete
- `mobile/components/` (UI components) — ✅ Complete
- `mobile/constants/` (Design tokens) — ✅ Complete
- `mobile/lib/` (API client, store, hooks) — ✅ Complete
- `api/app/api/[[...route]]/route.ts` (Hono API entry) — ✅ Complete
- `api/lib/routes/` (API endpoints) — ✅ Complete
- `api/lib/db.ts`, `api/lib/auth.ts`, `api/lib/utils.ts` (API utils) — ✅ Complete
- `api/TURSO_SCHEMA.sql` (Database schema) — ✅ Complete
- `src/` (Vanilla JS frontend) — 🗑 Dead code (Legacy web app version, superseded by the mobile app)
- `CHORIFY_AUDIT.md`, `CLAUDE.md`, `DEVELOPER_GUIDE.md` (Docs) — ✅ Complete
- `SUPABASE_SCHEMA.sql` — 🗑 Dead code (Legacy Supabase schema)

---

## 3. Architecture Assessment [ENG]

- **Overall structure:** Excellent. Clear monorepo structure separating the Vercel Edge API (`api/`) and the React Native Expo app (`mobile/`).
- **Data flow:** Clean and unidirectional. Turso DB -> Hono API -> `api.ts` fetch wrapper -> Zustand store -> React components.
- **State management:** Zustand is used appropriately for both Auth and Household data. The `load()` function in `useHouseholdStore` fetches all arrays in parallel. While this works well for standard households, it may face scaling issues if `tasks` and `completions` grow infinitely without pagination.
- **API / data layer:** Robust. Edge-compatible libraries (`jose` for JWT, Turso web client) are used perfectly. Silent token refresh logic in `api.ts` is implemented well.
- **TypeScript:** Mostly strict. A few `any` types remain (e.g., `confettiRef` in UI, error catching in `purchases.ts`).
- **Anti-patterns:** 
  - **Duplicate UI Logic:** `(home)/index.tsx` and `family/index.tsx` duplicate massive blocks of code for the filter picker modals.
  - **Client-Side Trust:** The `complete` task endpoint trusts the client to pass in the `memberId`. While validated against the household, parents and children share the same device/login in some setups.
- **Files that need immediate refactoring:** `mobile/app/(app)/(home)/index.tsx` and `mobile/app/(app)/family/index.tsx` need their filter modals extracted to a shared `<FilterPickers />` component to reduce 200+ lines of duplicate JSX.

---

## 4. Code Quality Flags [ENG]

- `mobile/app/(app)/(home)/index.tsx` — 🟡 MEDIUM — Component is over 400 lines due to inline modal definitions. Extract modals.
- `mobile/app/(app)/family/index.tsx` — 🟡 MEDIUM — Component is over 500 lines due to inline modal definitions. Extract modals.
- `mobile/app/(app)/rewards/index.tsx:75` — 🔴 CRITICAL — Fake functionality. Claiming a reward just shows a success alert but does not deduct points via the API.
- `api/lib/routes/members.ts` — 🟡 MEDIUM — The `avatarUrl` base64 string is accepted via PATCH without strict byte-length limits in the Zod schema, relying purely on the client-side compression.
- `mobile/lib/purchases.ts:24` — ⚪ LOW — Uses `any` type for `purchasePackage(pkg: any)`.
- `src/` — ⚪ LOW — Dead legacy code directory needs to be deleted to avoid confusion.

---

## 5. Feature Completeness [PM + ENG]

| Feature | Status | Edge cases handled | Persists on reload? | Notes |
|---|---|---|---|---|
| Authentication | ✅ Complete | Yes (silent refresh) | Yes | Uses JWT + SecureStore |
| Household Onboarding | ✅ Complete | Yes (join vs create) | Yes | |
| Task CRUD | ✅ Complete | Yes | Yes | |
| Task Recurrence | ✅ Complete | Yes (catches up past dates) | Yes | Handled well on backend |
| Push Notifications | ✅ Complete | Yes (permissions checked) | Yes | Uses Expo Push API |
| Leaderboard | ✅ Complete | Yes | Yes | Accurately calculates weekly points |
| Rewards | 🔴 Broken | No | No | Claiming does not deduct points |
| Monetization / Paywall | ⬜ Missing | No | No | Scaffolded but no UI or API gates exist |

---

## 6. UX Friction Inventory [DES]

- **Where:** Rewards Screen (`rewards/index.tsx`)
  - **What:** Users can tap "Claim" on a reward. It shows a success modal, but their point total does not decrease.
  - **Impact:** High. Breaks trust in the gamification system. Kids will realize they have infinite points.
- **Where:** Settings -> Add Member
  - **What:** The form is used exclusively for adding Child accounts, but it's labeled "Add Family Member". Adults must join via code, which is explained in a small banner.
  - **Impact:** Medium. Users might try to type their partner's name in here expecting to send an invite.
- **Where:** Task Deletion (Today / Tasks screen)
  - **What:** Swiping left deletes a task immediately after an alert confirmation. There is no "Undo" snackbar.
  - **Impact:** Low/Medium. Accidental deletions require recreating the task from scratch.

---

## 7. Visual & Design Audit [DES]

- **Spacing:** Excellent. The app utilizes a consistent rhythm (8/12/16/24px) and utilizes a `useLayout` hook to perfectly center content on tablets.
- **Typography:** Strong brand identity using `Fraunces` for display and `DM Sans` for UI text. Consistent hierarchy.
- **Colour:** Deep teal (`#486966`) and warm neutral backgrounds (`#F4F2F0`) create a very cohesive, modern, and friendly aesthetic.
- **Component consistency:** High. Cards, bottom sheets, and pills all use consistent `Radius` and `Shadows` tokens.
- **Dark mode:** Not present. The app is hardcoded to a light/warm theme.
- **Motion:** Confetti on completion is a great micro-interaction. Modals and bottom sheets use native slide/fade animations.
- **Mobile:** fully responsive, safe area insets respected everywhere.
- **App Store screenshot quality:** The UI is highly polished and absolutely ready for App Store screenshots.

---

## 8. Accessibility Audit [DES + ENG]

- Keyboard navigation: Relies on default React Native focus order. 
- ARIA: N/A (React Native), but missing explicit `accessibilityLabel` and `accessibilityRole` props on custom touchables (like filter pills).
- Focus management: Modals use standard RN focus trapping.
- Tap targets: Generally excellent. The add button is 44x44. Filter pills are large enough.
- Colour contrast: High contrast (dark text on light backgrounds, white text on primary teal).
- Images: Emojis are used extensively as icons, which screen readers will read aloud correctly.

---

## 9. Performance Assessment [ENG]

- Bundle: Standard Expo bundle size.
- Renders: `TasksScreen` correctly memoizes the leaderboard sorting to prevent lag on re-renders. 
- Data fetching: `useHouseholdStore.load()` fetches all tables concurrently. This is fast for new households but will cause memory/network bloat for old households since `ScrollView.map` is used instead of `FlashList`.
- Lists: The use of `ScrollView` over `FlashList` for the task lists is a known tech debt item (noted in `DEVELOPER_GUIDE.md`) that will impact performance as tasks grow.
- Images: Avatars are stored as Base64 strings. This is fine for small thumbnails but bloats the API payload.

---

## 10. Security Flags [ENG]

- No API keys exposed (RevenueCat uses `.env`).
- Missing backend validation length for `avatarUrl` base64 strings in the `/api/members` route, potentially allowing a malicious user to overload the DB row.
- The `complete` task endpoint relies on the client passing the `memberId`. Since children use the parent's device/session, this is an acceptable trust model, but prevents strict audit logging of *who* actually tapped the button.

---

## 11. Migration Readiness [ENG]

The active project (`mobile/`) is *already* fully written in React Native (Expo) and perfectly aligned with a modern mobile stack. 
However, the repository contains a legacy vanilla JS PWA in the `src/` directory. 

Legacy patterns in `src/` (to be deleted):
- `window.document.getElementById` / `innerHTML`
- Raw CSS strings and `style.cssText`
- Legacy Supabase auth (`supabase.auth.signInWithPassword`) directly in the client.

This `src/` directory should simply be deleted as the Expo migration is already complete.

---

## 12. Priority Stack Rank

1. 🔴 **CRITICAL** [PM + ENG] **Issue:** Reward claiming does not deduct points. **Fix:** Implement a `POST /api/rewards/:id/claim` endpoint to deduct points and update the UI. **Impact:** Core loop integrity.
2. 🔴 **CRITICAL** [PM] **Issue:** App has no paywall or monetization limits. **Fix:** Build a Paywall screen using the `react-native-purchases` scaffold and enforce limits (e.g. 15 tasks free). **Impact:** Revenue generation.
3. 🟠 **HIGH** [ENG] **Issue:** Filter modals duplicated across two massive files. **Fix:** Extract a `<FilterModal>` component to `components/`. **Impact:** Maintainability.
4. 🟡 **MEDIUM** [ENG] **Issue:** Legacy `src/` and `SUPABASE_SCHEMA.sql` code polluting repository. **Fix:** Delete the `src/` folder and old schema. **Impact:** Codebase cleanliness.
5. 🟡 **MEDIUM** [ENG] **Issue:** Avatar base64 strings lack strict size limits. **Fix:** Add `.max(75000)` to the `avatarUrl` zod schema in `members.ts`. **Impact:** Security/Stability.

---

## 13. Honest Verdict

**Staff Engineer:** The codebase is modern, type-safe, and utilizes a great Edge API architecture. The biggest technical risk is the lack of pagination or virtualized lists (`FlashList`), which will cause the app to choke on memory for households that have used it for >6 months.

**Principal Designer:** The app is visually gorgeous and feels incredibly cozy. The typography and color palette are top-tier. The single biggest UX risk is the broken reward claiming mechanism—users will lose trust the moment they realize the point economy is fake.

**Product Manager:** The core task-completion loop is deeply satisfying. However, the product is completely missing its monetization engine. Shipping this today means throwing away the day-1 cohort's revenue potential.

> **Verdict:** READY WITH CONDITIONS [Implement real reward claiming, add monetization paywall]

---

## 14. GTM Readiness Assessment

### 14a. First-Run Experience
- Brand new users see a polished Welcome screen, followed by a clear Onboarding flow to create or join a household and pick "Starter Packs".
- The "aha moment" happens when they complete their first task, see confetti, and check the leaderboard. This loop works flawlessly.

### 14b. Core Loop Integrity
- **Loop:** Add chore -> Do chore -> Mark complete -> Earn points -> Climb leaderboard / Claim reward.
- **Friction:** The loop fatally breaks at the "Claim reward" step, where points are not deducted.

### 14c. Retention Hooks
- **Leaderboard:** Yes, weekly resets keep family members competing.
- **Streaks:** Yes, tracks consecutive daily completions.
- **Push Notifications:** Yes, daily 8am summaries or per-task reminders.

### 14d. Monetisation Readiness
- **Paywall:** NO.
- `react-native-purchases` is initialized in the code, but there is no UI to show products, and no logic restricting free users. The app cannot make money in this state.

### 14e. Distribution Readiness
- [Yes] App icon designed and sized correctly
- [Yes] Launch screen / splash screen present and polished
- [Yes] App Store screenshots could be taken today
- [Yes] App name, subtitle, and description written (in `app.json`)
- [Yes] Privacy policy URL exists (served by Next.js API)
- [Yes] Onboarding asks for permissions correctly
- [Yes] No placeholder text visible

### 14f. The GTM Feature Gap

**[🔴 CRITICAL]** Functional Reward Claiming
- **What's missing:** Backend logic to deduct points when a reward is claimed.
- **Why it blocks GTM:** The gamification economy is broken. Users will abandon the app when they realize points don't matter.
- **Suggested implementation:** Add `POST /api/rewards/:id/claim` to decrement `members.points_total` and update the Zustand store.
- **Effort:** M (1-3 days)

**[🔴 CRITICAL]** Freemium Paywall
- **What's missing:** A UI to subscribe to Pro and backend limits on free tier features.
- **Why it blocks GTM:** You cannot launch a commercial app without a way to collect money.
- **Suggested implementation:** Build a `PaywallSheet.tsx` using `getOfferings()` and block creating >15 tasks if the user is not subscribed.
- **Effort:** L (3+ days)

**[🟡 MEDIUM]** FlashList Migration
- **What's missing:** Replacement of `ScrollView` with `@shopify/flash-list` for the Today and Tasks screens.
- **Why it blocks GTM:** It doesn't block day 1, but will cause crashes for highly active users by month 2.
- **Suggested implementation:** Refactor `TaskCard` mappings into `<FlashList data={tasks} renderItem={...} />`.
- **Effort:** M (1-3 days)

> **GTM verdict:** This app is 1-2 weeks from being ready to acquire its first paying users, assuming the rewards claiming logic and paywall are implemented.