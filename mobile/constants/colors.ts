// ── Keptt design system colors ────────────────────────────────────────────────

export const Colors = {
  // Brand
  primary:        '#5B6EF5', // indigo — main action color
  primaryLight:   '#EEF0FE', // tinted background for cards
  primaryDark:    '#3A4ED4',

  // Accent / points
  gold:           '#F5A623',
  goldLight:      '#FEF3DC',

  // Semantic
  success:        '#34C759', // green — completed
  successLight:   '#E8F8ED',
  warning:        '#FF9500', // orange — due soon
  warningLight:   '#FFF3E0',
  danger:         '#FF3B30', // red — overdue
  dangerLight:    '#FFECEB',

  // Neutrals
  background:     '#F5F7FF',
  surface:        '#FFFFFF',
  surfaceRaised:  '#FFFFFF', // card with shadow
  border:         '#E8EAFF',
  borderSubtle:   '#F0F2FF',

  // Text
  textPrimary:    '#1A1D3B',
  textSecondary:  '#6B7280',
  textTertiary:   '#9CA3AF',
  textOnPrimary:  '#FFFFFF',
  textOnGold:     '#7A4F00',

  // Tab bar
  tabActive:      '#5B6EF5',
  tabInactive:    '#9CA3AF',
  tabBackground:  '#FFFFFF',

  // Category badge colors — must match API CATEGORIES enum
  category: {
    home:    { bg: '#EEF0FE', text: '#5B6EF5' },
    pet:     { bg: '#FFF7ED', text: '#C2410C' },
    outdoor: { bg: '#E8F8ED', text: '#15803D' },
    health:  { bg: '#FCE7F3', text: '#9D174D' },
    family:  { bg: '#FEF3DC', text: '#B45309' },
    vehicle: { bg: '#F0F9FF', text: '#0369A1' },
  },
} as const

export type ColorKey = keyof typeof Colors
