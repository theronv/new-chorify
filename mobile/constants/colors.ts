// ── Chorify design system colors (HSL) ───────────────────────────────────────
// All colors defined as HSL strings for theming compatibility.

export const Colors = {
  // Brand — vibrant blue
  primary:        'hsl(217, 91%, 60%)',
  primaryLight:   'hsl(217, 91%, 96%)',
  primaryDark:    'hsl(217, 91%, 45%)',

  // Accent — energetic coral-orange
  accent:         'hsl(14, 100%, 64%)',

  // Points / gamification
  gold:           'hsl(38, 92%, 55%)',
  goldLight:      'hsl(38, 92%, 93%)',

  // Semantic
  success:        'hsl(145, 70%, 45%)',
  successLight:   'hsl(145, 70%, 93%)',
  warning:        'hsl(38, 92%, 55%)',
  warningLight:   'hsl(38, 92%, 93%)',
  danger:         'hsl(0, 90%, 60%)',
  dangerLight:    'hsl(0, 90%, 95%)',

  // Neutrals
  background:     'hsl(220, 20%, 98%)',
  surface:        'hsl(0, 0%, 100%)',
  surfaceRaised:  'hsl(0, 0%, 100%)',
  border:         'hsl(220, 15%, 85%)',
  borderSubtle:   'hsl(220, 15%, 93%)',

  // Text
  textPrimary:    'hsl(222, 28%, 18%)',
  textSecondary:  'hsl(220, 10%, 50%)',
  textTertiary:   'hsl(220, 10%, 70%)',
  textOnPrimary:  'hsl(0, 0%, 100%)',
  textOnGold:     'hsl(30, 60%, 20%)',

  // Tab bar
  tabActive:      'hsl(217, 91%, 60%)',
  tabInactive:    'hsl(220, 10%, 50%)',
  tabBackground:  'hsl(0, 0%, 100%)',

  // Overlays (standardised backdrop tokens)
  overlayHeavy:   'rgba(0,0,0,0.45)',
  overlayMedium:  'rgba(0,0,0,0.4)',
  overlayLight:   'rgba(0,0,0,0.35)',

  // Category badge colors (legacy static map — kept for reference)
  category: {
    home:    { bg: 'hsl(217, 91%, 96%)', text: 'hsl(217, 91%, 45%)' },
    pet:     { bg: 'hsl(25, 70%, 94%)',  text: 'hsl(25, 60%, 35%)' },
    outdoor: { bg: 'hsl(145, 50%, 94%)', text: 'hsl(145, 50%, 30%)' },
    health:  { bg: 'hsl(340, 50%, 94%)', text: 'hsl(340, 50%, 35%)' },
    family:  { bg: 'hsl(38, 70%, 94%)',  text: 'hsl(38, 60%, 30%)' },
    vehicle: { bg: 'hsl(200, 60%, 94%)', text: 'hsl(200, 60%, 30%)' },
  },
} as const

export type ColorKey = keyof typeof Colors

// ── Dynamic category color palette ────────────────────────────────────────────
// Assign colors by sort_order % palette length.
// Vibrant, modern palette that complements the new blue primary.
export const CATEGORY_COLORS: { bg: string; text: string }[] = [
  { bg: 'hsl(217, 91%, 96%)', text: 'hsl(217, 91%, 45%)' }, // 0: blue     (home)
  { bg: 'hsl(25, 70%, 94%)',  text: 'hsl(25, 60%, 35%)' },  // 1: brown    (pet)
  { bg: 'hsl(145, 50%, 94%)', text: 'hsl(145, 50%, 30%)' },  // 2: green    (outdoor)
  { bg: 'hsl(340, 50%, 94%)', text: 'hsl(340, 50%, 35%)' },  // 3: rose     (health)
  { bg: 'hsl(38, 70%, 94%)',  text: 'hsl(38, 60%, 30%)' },   // 4: amber    (family)
  { bg: 'hsl(200, 60%, 94%)', text: 'hsl(200, 60%, 30%)' },  // 5: cyan     (vehicle)
  { bg: 'hsl(270, 50%, 94%)', text: 'hsl(270, 50%, 35%)' },  // 6: purple
  { bg: 'hsl(0, 70%, 95%)',   text: 'hsl(0, 70%, 40%)' },    // 7: red
]

/**
 * Returns bg + text colors for a category.
 * Uses the category's sort_order modulo the palette length for stable assignment.
 */
export function getCategoryColor(sortOrder: number): { bg: string; text: string } {
  return CATEGORY_COLORS[Math.abs(sortOrder) % CATEGORY_COLORS.length]
}

// ── Shadow presets ────────────────────────────────────────────────────────────
// Softer shadows using the new textPrimary as base color.
// Opacity reduced 50% and radius increased 25% from the previous system.
export const Shadows = {
  /** Subtle lift — task cards, list items */
  sm: {
    shadowColor:   'hsl(222, 28%, 18%)',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius:  7.5,
    elevation:     2,
  },
  /** Standard card depth */
  card: {
    shadowColor:   'hsl(222, 28%, 18%)',
    shadowOffset:  { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius:  17.5,
    elevation:     4,
  },
  /** Modals, sheets, overlaid UI */
  md: {
    shadowColor:   'hsl(222, 28%, 18%)',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.055,
    shadowRadius:  25,
    elevation:     8,
  },
  /** Deep popups, pickers */
  lg: {
    shadowColor:   'hsl(222, 28%, 18%)',
    shadowOffset:  { width: 0, height: 10 },
    shadowOpacity: 0.075,
    shadowRadius:  37.5,
    elevation:     14,
  },
  /** Coloured glow for primary action buttons */
  button: {
    shadowColor:   'hsl(217, 91%, 60%)',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius:  15,
    elevation:     5,
  },
} as const

// ── Border radius scale ───────────────────────────────────────────────────────
// Softer, more modern radii.
export const Radius = {
  xs:   6,
  sm:   10,
  md:   16,
  lg:   24,
  xl:   32,
  '2xl': 32, // kept as alias for backward compat; same as xl in new system
  full: 9999,
} as const
