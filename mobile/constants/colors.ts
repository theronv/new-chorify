// ── Chorify design system colors ──────────────────────────────────────────────

export const Colors = {
  // Brand — deep teal
  primary:        '#486966',
  primaryLight:   '#EAF0EF', // tinted teal background for selected states
  primaryDark:    '#2E4542',

  // Accent — red
  accent:         '#BD2A2E',

  // Points / gamification
  gold:           '#C8902A',
  goldLight:      '#F5EDD8',

  // Semantic
  success:        '#3D8B6C', // muted forest green — completed
  successLight:   '#E4F0EB',
  warning:        '#C87D2A', // warm amber — due soon
  warningLight:   '#F5ECD6',
  danger:         '#BD2A2E', // red — overdue
  dangerLight:    '#F5E6E6',

  // Neutrals
  background:     '#F4F2F0', // warm off-white
  surface:        '#FFFFFF',
  surfaceRaised:  '#FFFFFF',
  border:         '#C8D4D4', // muted teal-gray
  borderSubtle:   '#E2EEEE', // very light teal

  // Text
  textPrimary:    '#3B3936', // dark charcoal
  textSecondary:  '#889C9B', // muted sage
  textTertiary:   '#B2BEBF', // light gray-blue
  textOnPrimary:  '#FFFFFF',
  textOnGold:     '#5C3800',

  // Tab bar
  tabActive:      '#486966',
  tabInactive:    '#889C9B',
  tabBackground:  '#FFFFFF',

  // Category badge colors (legacy static map — kept for reference)
  category: {
    home:    { bg: '#E4EEEE', text: '#486966' },
    pet:     { bg: '#F5EEEA', text: '#8B4513' },
    outdoor: { bg: '#E6EFEA', text: '#2D6A4F' },
    health:  { bg: '#F2E8EC', text: '#823050' },
    family:  { bg: '#F0EAE0', text: '#7A5C1A' },
    vehicle: { bg: '#E4EEF2', text: '#1E6080' },
  },
} as const

export type ColorKey = keyof typeof Colors

// ── Dynamic category color palette ────────────────────────────────────────────
// Assign colors by sort_order % palette length.
// Indices 0–5 intentionally match the legacy Colors.category entries above.
export const CATEGORY_COLORS: { bg: string; text: string }[] = [
  { bg: '#E4EEEE', text: '#486966' }, // 0: teal    (home)
  { bg: '#F5EEEA', text: '#8B4513' }, // 1: brown   (pet)
  { bg: '#E6EFEA', text: '#2D6A4F' }, // 2: forest  (outdoor)
  { bg: '#F2E8EC', text: '#823050' }, // 3: rose    (health)
  { bg: '#F0EAE0', text: '#7A5C1A' }, // 4: amber   (family)
  { bg: '#E4EEF2', text: '#1E6080' }, // 5: steel   (vehicle)
  { bg: '#ECE8F2', text: '#5E408A' }, // 6: muted purple
  { bg: '#F2E8E8', text: '#BD2A2E' }, // 7: red accent
]

/**
 * Returns bg + text colors for a category.
 * Uses the category's sort_order modulo the palette length for stable assignment.
 */
export function getCategoryColor(sortOrder: number): { bg: string; text: string } {
  return CATEGORY_COLORS[Math.abs(sortOrder) % CATEGORY_COLORS.length]
}

// ── Shadow presets ────────────────────────────────────────────────────────────
// Uses the dark charcoal as shadow base (warm-tinted, softer than pure #000)
export const Shadows = {
  /** Subtle lift — task cards, list items */
  sm: {
    shadowColor:   '#3B3936',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  6,
    elevation:     2,
  },
  /** Standard card depth */
  card: {
    shadowColor:   '#3B3936',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius:  14,
    elevation:     4,
  },
  /** Modals, sheets, overlaid UI */
  md: {
    shadowColor:   '#3B3936',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius:  20,
    elevation:     8,
  },
  /** Deep popups, pickers */
  lg: {
    shadowColor:   '#3B3936',
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius:  30,
    elevation:     14,
  },
  /** Coloured glow for primary action buttons */
  button: {
    shadowColor:   '#486966',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  12,
    elevation:     5,
  },
} as const

// ── Border radius scale ───────────────────────────────────────────────────────
export const Radius = {
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 28,
  full: 9999,
} as const
