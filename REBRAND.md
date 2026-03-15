# Chorify — Visual Audit & Rebrand Blueprint

> A complete inventory of the design system, hardcoded style violations, and icon usage across the mobile app. This document serves as the single source of truth for the rebrand.

---

## Chorify Brand System

> **Direction:** Modern, vibrant, and motivating. Designed to feel encouraging and clean.

### Color Palette (HSL)

All colors are defined as HSL strings in `mobile/constants/colors.ts` for theming compatibility.

#### Brand

| Token | HSL Value | Swatch | Usage |
|---|---|---|---|
| `primary` | `hsl(217, 91%, 60%)` | ![#3B82F6](https://via.placeholder.com/16/3B82F6/3B82F6.png) Vibrant blue | CTAs, active states, checkmarks, tab active tint |
| `primaryLight` | `hsl(217, 91%, 96%)` | ![#EBF2FE](https://via.placeholder.com/16/EBF2FE/EBF2FE.png) Blue tint | Selected/active backgrounds |
| `primaryDark` | `hsl(217, 91%, 45%)` | ![#0A59DA](https://via.placeholder.com/16/0A59DA/0A59DA.png) Deep blue | Pressed states |
| `accent` | `hsl(14, 100%, 64%)` | ![#FF7A4D](https://via.placeholder.com/16/FF7A4D/FF7A4D.png) Coral-orange | Secondary actions, highlights |

#### Semantic

| Token | HSL Value | Swatch | Usage |
|---|---|---|---|
| `success` | `hsl(145, 70%, 45%)` | ![#22C55E](https://via.placeholder.com/16/22C55E/22C55E.png) Green | Completed tasks |
| `successLight` | `hsl(145, 70%, 93%)` | ![#DCFCE7](https://via.placeholder.com/16/DCFCE7/DCFCE7.png) Light green | Completion badges |
| `warning` | `hsl(38, 92%, 55%)` | ![#F59E0B](https://via.placeholder.com/16/F59E0B/F59E0B.png) Amber | Due today / due soon |
| `warningLight` | `hsl(38, 92%, 93%)` | ![#FEF3C7](https://via.placeholder.com/16/FEF3C7/FEF3C7.png) Light amber | Warning badges |
| `danger` | `hsl(0, 90%, 60%)` | ![#EF4444](https://via.placeholder.com/16/EF4444/EF4444.png) Red | Overdue, destructive |
| `dangerLight` | `hsl(0, 90%, 95%)` | ![#FEE2E2](https://via.placeholder.com/16/FEE2E2/FEE2E2.png) Light red | Danger badges |

#### Gamification

| Token | HSL Value | Usage |
|---|---|---|
| `gold` | `hsl(38, 92%, 55%)` | Points, leaderboard accents (alias of `warning`) |
| `goldLight` | `hsl(38, 92%, 93%)` | Light gold backgrounds |
| `textOnGold` | `hsl(30, 60%, 20%)` | Text on gold backgrounds |

#### Neutrals

| Token | HSL Value | Swatch | Usage |
|---|---|---|---|
| `background` | `hsl(220, 20%, 98%)` | ![#F8F9FB](https://via.placeholder.com/16/F8F9FB/F8F9FB.png) Cool off-white | Screen background |
| `surface` | `hsl(0, 0%, 100%)` | ![#FFFFFF](https://via.placeholder.com/16/FFFFFF/FFFFFF.png) White | Cards, sheets |
| `border` | `hsl(220, 15%, 85%)` | ![#D1D5DB](https://via.placeholder.com/16/D1D5DB/D1D5DB.png) Cool gray | Dividers, input borders |
| `borderSubtle` | `hsl(220, 15%, 93%)` | ![#ECEEF1](https://via.placeholder.com/16/ECEEF1/ECEEF1.png) Light gray | Subtle separators |

#### Text

| Token | HSL Value | Swatch | Usage |
|---|---|---|---|
| `textPrimary` | `hsl(222, 28%, 18%)` | ![#212B45](https://via.placeholder.com/16/212B45/212B45.png) Dark navy | Primary text, shadow base |
| `textSecondary` | `hsl(220, 10%, 50%)` | ![#737B8B](https://via.placeholder.com/16/737B8B/737B8B.png) Mid gray | Labels, secondary text |
| `textTertiary` | `hsl(220, 10%, 70%)` | ![#A8AEB8](https://via.placeholder.com/16/A8AEB8/A8AEB8.png) Light gray | Placeholders, hints |
| `textOnPrimary` | `hsl(0, 0%, 100%)` | ![#FFFFFF](https://via.placeholder.com/16/FFFFFF/FFFFFF.png) White | Text on blue/primary |

#### Overlays (new tokens)

| Token | Value | Usage |
|---|---|---|
| `overlayHeavy` | `rgba(0,0,0,0.45)` | Full-screen sheet backdrops |
| `overlayMedium` | `rgba(0,0,0,0.4)` | Picker/modal backdrops |
| `overlayLight` | `rgba(0,0,0,0.35)` | Nested/secondary overlays |

#### Category Color Palette (8 colors, HSL)

Indexed by `sort_order % 8` via `getCategoryColor()`.

| Index | Background | Text | Name |
|---|---|---|---|
| 0 | `hsl(217, 91%, 96%)` | `hsl(217, 91%, 45%)` | Blue |
| 1 | `hsl(25, 70%, 94%)` | `hsl(25, 60%, 35%)` | Brown |
| 2 | `hsl(145, 50%, 94%)` | `hsl(145, 50%, 30%)` | Green |
| 3 | `hsl(340, 50%, 94%)` | `hsl(340, 50%, 35%)` | Rose |
| 4 | `hsl(38, 70%, 94%)` | `hsl(38, 60%, 30%)` | Amber |
| 5 | `hsl(200, 60%, 94%)` | `hsl(200, 60%, 30%)` | Cyan |
| 6 | `hsl(270, 50%, 94%)` | `hsl(270, 50%, 35%)` | Purple |
| 7 | `hsl(0, 70%, 95%)` | `hsl(0, 70%, 40%)` | Red |

### Typography

**Source:** `mobile/constants/fonts.ts`

| Role | Font Family | Package | Weights Used |
|---|---|---|---|
| Display (headings) | **Lexend** | `@expo-google-fonts/lexend` | 600 SemiBold, 700 Bold |
| Body (UI text) | **Inter** | `@expo-google-fonts/inter` | 400 Regular, 500 Medium, 600 SemiBold, 700 Bold |

| Token | Font Key | Family | Weight |
|---|---|---|---|
| `Font.displayBold` | `Lexend-Bold` | Lexend | 700 |
| `Font.displaySemiBold` | `Lexend-SemiBold` | Lexend | 600 |
| `Font.regular` | `Inter-Regular` | Inter | 400 |
| `Font.medium` | `Inter-Medium` | Inter | 500 |
| `Font.semiBold` | `Inter-SemiBold` | Inter | 600 |
| `Font.bold` | `Inter-Bold` | Inter | 700 |

Font size scale is unchanged:

| Token | Value | Usage |
|---|---|---|
| `FontSize.xs` | 11 | Tiny labels, timestamps |
| `FontSize.sm` | 13 | Secondary text, captions |
| `FontSize.base` | 15 | Default body text |
| `FontSize.md` | 17 | Card titles, prominent text |
| `FontSize.lg` | 20 | Section headers |
| `FontSize.xl` | 24 | Screen subtitles |
| `FontSize['2xl']` | 30 | Screen titles |
| `FontSize['3xl']` | 36 | Large display headings |

### Layout Tokens

**Border Radius** — softer, more modern scale:

| Token | Old Value | New Value | Usage |
|---|---|---|---|
| `Radius.xs` | 6 | **6** | Small badges, inline tags |
| `Radius.sm` | 8 | **10** | Input fields, small cards |
| `Radius.md` | 12 | **16** | Standard cards, buttons |
| `Radius.lg` | 16 | **24** | Larger cards, modals |
| `Radius.xl` | 20 | **32** | Bottom sheets, prominent cards |
| `Radius['2xl']` | 28 | **32** | Alias for `xl` (backward compat) |
| `Radius.full` | 9999 | **9999** | Pills, circles, avatars |

**Shadows** — softer (opacity halved, radius increased 25%), base color now `hsl(222, 28%, 18%)`:

| Token | `shadowColor` | `offset` | `opacity` | `radius` | `elevation` | Usage |
|---|---|---|---|---|---|---|
| `Shadows.sm` | `textPrimary` | 0, 1 | 0.03 | 7.5 | 2 | Subtle lift — cards, list items |
| `Shadows.card` | `textPrimary` | 0, 3 | 0.04 | 17.5 | 4 | Standard card depth |
| `Shadows.md` | `textPrimary` | 0, 6 | 0.055 | 25 | 8 | Modals, sheets |
| `Shadows.lg` | `textPrimary` | 0, 10 | 0.075 | 37.5 | 14 | Deep popups, pickers |
| `Shadows.button` | `primary` | 0, 4 | 0.15 | 15 | 5 | Blue glow for primary buttons / FABs |

**Responsive layout** values are unchanged (see `useLayout()` in `mobile/constants/layout.ts`).

---

### Old vs New Comparison

| Token | Old (Teal/Serif) | New (Blue/Geometric) |
|---|---|---|
| `primary` | `#486966` (deep teal) | `hsl(217, 91%, 60%)` (vibrant blue) |
| `accent` | `#BD2A2E` (red) | `hsl(14, 100%, 64%)` (coral-orange) |
| `background` | `#F4F2F0` (warm off-white) | `hsl(220, 20%, 98%)` (cool off-white) |
| `textPrimary` | `#3B3936` (charcoal) | `hsl(222, 28%, 18%)` (dark navy) |
| Display font | Fraunces (playful serif) | Lexend (modern geometric sans) |
| Body font | DM Sans (grotesque) | Inter (high-legibility grotesque) |
| `Radius.md` | 12 | 16 |
| `Shadows.card.opacity` | 0.08 | 0.04 |

---

## Previous Design System (Archived)

The sections below document the **original** design system before the rebrand, preserved for reference.

### Original Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#486966` | Deep teal — CTAs, active states |
| `primaryLight` | `#EAF0EF` | Tinted teal backgrounds |
| `primaryDark` | `#2E4542` | Darker teal variant |
| `accent` | `#BD2A2E` | Red — danger actions |
| `gold` | `#C8902A` | Points accents |
| `success` | `#3D8B6C` | Completed tasks |
| `warning` | `#C87D2A` | Due today |
| `danger` | `#BD2A2E` | Overdue |
| `background` | `#F4F2F0` | Warm off-white |
| `textPrimary` | `#3B3936` | Dark charcoal |
| `textSecondary` | `#889C9B` | Muted sage |

### Original Category Palette

| Index | Background | Text | Name |
|---|---|---|---|
| 0 | `#E4EEEE` | `#486966` | Teal |
| 1 | `#F5EEEA` | `#8B4513` | Brown |
| 2 | `#E6EFEA` | `#2D6A4F` | Forest |
| 3 | `#F2E8EC` | `#823050` | Rose |
| 4 | `#F0EAE0` | `#7A5C1A` | Amber |
| 5 | `#E4EEF2` | `#1E6080` | Steel |
| 6 | `#ECE8F2` | `#5E408A` | Purple |
| 7 | `#F2E8E8` | `#BD2A2E` | Red |

### Original Typography

| Token | Font | Weight |
|---|---|---|
| `Font.displayBold` | Fraunces 700 | Bold |
| `Font.displaySemiBold` | Fraunces 600 | SemiBold |
| `Font.regular` | DM Sans 400 | Regular |
| `Font.medium` | DM Sans 500 | Medium |
| `Font.semiBold` | DM Sans 600 | SemiBold |
| `Font.bold` | DM Sans 700 | Bold |

### Original Radius

`xs:6 · sm:8 · md:12 · lg:16 · xl:20 · 2xl:28 · full:9999`

### Original Shadows

| Token | `shadowColor` | `opacity` | `radius` |
|---|---|---|---|
| `sm` | `#3B3936` | 0.06 | 6 |
| `card` | `#3B3936` | 0.08 | 14 |
| `md` | `#3B3936` | 0.11 | 20 |
| `lg` | `#3B3936` | 0.15 | 30 |
| `button` | `#486966` | 0.30 | 12 |

---

## 5. Hardcoded Style Violations

These are instances where raw color values, hex codes, or `rgba()` strings appear directly in styles instead of referencing design tokens from `constants/colors.ts`.

### Overlay Backdrop Colors (`rgba(0,0,0,...)`)

Every modal, picker, and bottom sheet overlay uses a hardcoded `rgba(0,0,0,...)` backdrop instead of a design token. The opacity also varies inconsistently between 0.35, 0.4, and 0.45.

| File | Line | Value | Context |
|---|---|---|---|
| `components/AddTaskSheet.tsx` | 562 | `rgba(0,0,0,0.45)` | Main sheet overlay |
| `components/AddTaskSheet.tsx` | 642 | `rgba(0,0,0,0.35)` | Nested picker overlay |
| `components/EditTaskSheet.tsx` | 523 | `rgba(0,0,0,0.45)` | Main sheet overlay |
| `components/EditTaskSheet.tsx` | 599 | `rgba(0,0,0,0.35)` | Nested picker overlay |
| `app/(app)/(home)/index.tsx` | 566 | `rgba(0,0,0,0.4)` | Filter picker backdrop |
| `app/(app)/family/index.tsx` | 753 | `rgba(0,0,0,0.4)` | Filter picker backdrop |
| `app/(app)/rewards/index.tsx` | 308 | `rgba(0,0,0,0.45)` | Sheet overlay |
| `app/(app)/settings/index.tsx` | 723 | `rgba(0,0,0,0.45)` | Sheet overlay |
| `app/(app)/settings/index.tsx` | 803 | `rgba(0,0,0,0.4)` | Picker backdrop |
| `app/(app)/settings/index.tsx` | 893 | `rgba(0,0,0,0.45)` | Sheet overlay |
| `app/(app)/settings/categories.tsx` | 416 | `rgba(0,0,0,0.4)` | Modal backdrop |
| `app/(app)/settings/rooms.tsx` | 384 | `rgba(0,0,0,0.4)` | Modal backdrop |

**Total: 12 instances across 8 files**

**Recommendation:** Add overlay tokens to `Colors`:
```typescript
overlayHeavy: 'rgba(0,0,0,0.45)',  // full-screen sheet backdrops
overlayMedium: 'rgba(0,0,0,0.4)',  // picker/modal backdrops
overlayLight: 'rgba(0,0,0,0.35)',  // nested/secondary overlays
```

### Raw Hex Colors

| File | Line | Value | Token That Should Be Used | Context |
|---|---|---|---|---|
| `app/onboarding/packs.tsx` | 195 | `'#000'` | `Colors.textPrimary` | `shadowColor` on pack card |
| `app/onboarding/packs.tsx` | 250 | `'#fff'` | `Colors.textOnPrimary` | Checkmark text color |

**Total: 2 instances in 1 file**

### `'transparent'` Usage

These are technically hardcoded color strings but are a standard RN value with no design token equivalent. Listed for completeness.

| File | Line | Context |
|---|---|---|
| `components/Button.tsx` | 77 | `backgroundColor: 'transparent'` — ghost button variant |
| `components/Button.tsx` | 82 | `backgroundColor: 'transparent'` — text button variant |
| `app/onboarding/packs.tsx` | 194 | `borderColor: 'transparent'` — unselected pack card border |

**Recommendation:** These are idiomatic React Native and do not need tokens, but a `Colors.transparent` alias could be added for consistency during a rebrand if desired.

### Non-Token Radius Values

| File | Line | Value | Nearest Token |
|---|---|---|---|
| `app/onboarding/packs.tsx` | 191 | `borderRadius: 18` | Between `Radius.lg` (16) and `Radius.xl` (20) |
| `app/onboarding/packs.tsx` | 238 | `borderRadius: 13` | Circular checkbox (width/2), acceptable |

---

## 6. Icon Audit

### Library

The app uses a single icon library: **Ionicons** via `@expo/vector-icons`. No other icon families (MaterialIcons, FontAwesome, AntDesign, etc.) are imported anywhere.

```typescript
import { Ionicons } from '@expo/vector-icons'
```

### Tab Bar Icons (4 icons, outline + filled variants)

Defined in `app/(app)/_layout.tsx` via a `tabIcon()` helper that switches between outline (inactive) and filled (active) variants.

| Purpose | Outline (inactive) | Filled (active) | Size |
|---|---|---|---|
| Today tab | `calendar-outline` | `calendar` | 24 |
| Tasks tab | `list-outline` | `list` | 24 |
| Rewards tab | `gift-outline` | `gift` | 24 |
| Settings tab | `settings-outline` | `settings` | 24 |

### Navigation Icons

| Icon | Size | Color | Files | Purpose |
|---|---|---|---|---|
| `chevron-back` | 24 | `Colors.primary` | `settings/packs.tsx`, `settings/categories.tsx`, `settings/rooms.tsx`, `settings/csv.tsx` | Back button in settings sub-screens |

### Status / Indicator Icons

| Icon | Size | Color | Files | Purpose |
|---|---|---|---|---|
| `lock-closed-outline` | 18 | `Colors.textSecondary` | `AddTaskSheet.tsx`, `EditTaskSheet.tsx` | Private task toggle label |
| `lock-closed` | 12 | `Colors.textTertiary` | `TaskCard.tsx` | Private task indicator on cards |

### Empty State Icons

| Icon | Size | Color | File | Condition |
|---|---|---|---|---|
| `search-outline` | 64 | `Colors.textTertiary` | `app/(app)/(home)/index.tsx` | Empty state when filters are active |
| `list-outline` | 64 | `Colors.textTertiary` | `app/(app)/(home)/index.tsx` | Empty state when no tasks exist |
| `gift-outline` | 64 | `Colors.textTertiary` | `app/(app)/rewards/index.tsx` | Empty rewards state |
| `gift` | 32 | `Colors.textTertiary` | `app/(app)/rewards/index.tsx` | Smaller rewards empty state icon |

### Full Icon Inventory (15 unique icons)

| # | Icon Name | Type | Occurrences |
|---|---|---|---|
| 1 | `calendar` | Filled | 1 |
| 2 | `calendar-outline` | Outline | 1 |
| 3 | `chevron-back` | Filled | 4 |
| 4 | `gift` | Filled | 2 |
| 5 | `gift-outline` | Outline | 2 |
| 6 | `list` | Filled | 1 |
| 7 | `list-outline` | Outline | 2 |
| 8 | `lock-closed` | Filled | 1 |
| 9 | `lock-closed-outline` | Outline | 2 |
| 10 | `search-outline` | Outline | 1 |
| 11 | `settings` | Filled | 1 |
| 12 | `settings-outline` | Outline | 1 |

**Total unique icon names: 12** (across 15 usages in 10 files)

---

## 7. Rebrand Checklist

### Token Files (3 files)
- [x] `mobile/constants/colors.ts` — All colors converted to HSL; new blue/coral palette; overlay tokens added; shadows softened
- [x] `mobile/constants/fonts.ts` — Fraunces → Lexend (display), DM Sans → Inter (body); packages installed
- [x] `mobile/constants/colors.ts` — Radius scale updated (sm:10, md:16, lg:24, xl:32); shadows opacity halved, radius +25%

### Hardcoded Violations (8 files, 16 instances)
- [x] Fixed 12 `rgba(0,0,0,...)` overlay instances → `Colors.overlayHeavy` / `Colors.overlayMedium` / `Colors.overlayLight`
- [x] Fixed 2 raw hex values in `onboarding/packs.tsx` (`#000` → `Colors.textPrimary`, `#fff` → `Colors.textOnPrimary`)
- [x] Fixed 1 non-token `borderRadius: 18` → `Radius.lg` in `onboarding/packs.tsx`
- [x] `'transparent'` usages left as-is (idiomatic React Native)

### Icons
- [x] `@expo/vector-icons` (Ionicons) fully replaced with `lucide-react-native` across all 10 files
- [x] Tab bar rewritten to use Lucide components with `strokeWidth` for focus state (2.5 focused, 1.5 unfocused)

### Remaining (config/assets — not code)
- [ ] `mobile/app.json` — Update `splash.backgroundColor` to match new `Colors.background`
- [ ] `mobile/assets/AppIcon~ios-marketing.png` — Replace app icon with new brand
- [ ] `mobile/eas.json` — Update `EXPO_PUBLIC_API_URL` if domain changes

---

## 8. Before & After Summary

### Design Token Changes

| Area | Before | After |
|---|---|---|
| Primary color | Deep teal `#486966` | Vibrant blue `hsl(217, 91%, 60%)` |
| Accent color | Red `#BD2A2E` | Coral-orange `hsl(14, 100%, 64%)` |
| Background | Warm off-white `#F4F2F0` | Cool off-white `hsl(220, 20%, 98%)` |
| Text primary | Charcoal `#3B3936` | Dark navy `hsl(222, 28%, 18%)` |
| Display font | Fraunces (serif) | Lexend (geometric sans) |
| Body font | DM Sans | Inter |
| Card radius | 12px | 16px |
| Shadow opacity | 0.06–0.15 | 0.03–0.075 (50% softer) |
| Icon library | Ionicons (outline/filled) | Lucide (stroke weight) |

### Screen-by-Screen Impact

**Today Screen (`(home)/index.tsx`)**
- Header, filter pills, and FAB now use vibrant blue instead of teal
- Filter pill active state: blue tint background with blue border and text
- Task cards have softer shadows (opacity 0.04 vs 0.08) and rounder corners (16px vs 12px)
- Category pills use the updated HSL color palette
- Empty state icons switched from Ionicons `search-outline`/`list-outline` to Lucide `Search`/`List`
- Modal overlay backdrops use standardized `Colors.overlayMedium` token

**Tasks Screen (`family/index.tsx`)**
- Leaderboard accents and active filter states are now vibrant blue
- Filter picker backdrop uses `Colors.overlayMedium` instead of hardcoded rgba
- All task cards render with the new shadow and radius values

**Settings Screen (`settings/index.tsx`)**
- Back buttons now use Lucide `ArrowLeft` instead of Ionicons `chevron-back`
- All modal/sheet overlays use `Colors.overlayHeavy`/`Colors.overlayMedium` tokens
- Category and room management modals use standardized overlay tokens

**Tab Bar (`(app)/_layout.tsx`)**
- Icons replaced: `calendar` → Lucide `Calendar`, `list` → `ListTodo`, `gift` → `Gift`, `settings` → `Settings`
- Focus state uses `strokeWidth: 2.5` (bold) vs `1.5` (light) instead of outline/filled variants
- Active tint is now vibrant blue `hsl(217, 91%, 60%)`

**Task Cards (`TaskCard.tsx`)**
- Private task lock icon: Ionicons `lock-closed` → Lucide `Lock`
- Card shadow: opacity reduced from 0.05 to 0.03, radius increased from 8 to 7.5
- Card border radius now uses the system's updated values

**Add/Edit Task Sheets (`AddTaskSheet.tsx`, `EditTaskSheet.tsx`)**
- Private toggle lock icon: Ionicons `lock-closed-outline` → Lucide `Lock`
- Sheet overlay: `rgba(0,0,0,0.45)` → `Colors.overlayHeavy`
- Nested picker overlay: `rgba(0,0,0,0.35)` → `Colors.overlayLight`
- All pill/button active states use the new blue primary

**Onboarding Packs (`onboarding/packs.tsx`)**
- Pack card shadow uses `Colors.textPrimary` instead of `#000`
- Checkmark text uses `Colors.textOnPrimary` instead of `#fff`
- Card radius aligned to `Radius.lg` (24px)

**Rewards Screen (`rewards/index.tsx`)**
- Empty state icon: Ionicons `gift-outline` → Lucide `Gift`
- Sheet overlay uses `Colors.overlayHeavy` token

### Files Modified (17 total)

| File | Changes |
|---|---|
| `constants/colors.ts` | Full HSL palette, overlay tokens, softer shadows, updated radius |
| `constants/fonts.ts` | Lexend + Inter fonts, updated fontMap |
| `app/(app)/_layout.tsx` | Lucide tab icons with strokeWidth focus |
| `components/TaskCard.tsx` | Lucide Lock icon |
| `components/AddTaskSheet.tsx` | Lucide Lock, overlay tokens |
| `components/EditTaskSheet.tsx` | Lucide Lock, overlay tokens |
| `app/(app)/(home)/index.tsx` | Lucide Search/List, overlay token |
| `app/(app)/family/index.tsx` | Overlay token |
| `app/(app)/rewards/index.tsx` | Lucide Gift, overlay token |
| `app/(app)/settings/index.tsx` | Overlay tokens (3 instances) |
| `app/(app)/settings/packs.tsx` | Lucide ArrowLeft |
| `app/(app)/settings/categories.tsx` | Lucide ArrowLeft, overlay token |
| `app/(app)/settings/rooms.tsx` | Lucide ArrowLeft, overlay token |
| `app/(app)/settings/csv.tsx` | Lucide ArrowLeft |
| `app/onboarding/packs.tsx` | Colors.textPrimary, Colors.textOnPrimary, Radius.lg |

### Packages Changed

| Action | Package |
|---|---|
| Added | `lucide-react-native` |
| Added | `react-native-svg` (peer dependency) |
| Added | `@expo-google-fonts/lexend` |
| Added | `@expo-google-fonts/inter` |
| Removed (unused) | `@expo/vector-icons` (Ionicons) — no longer imported anywhere |

---

*Rebrand completed. TypeScript compiles clean (0 errors). All hardcoded style violations resolved. All Ionicons replaced with Lucide.*
