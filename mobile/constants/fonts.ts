// ── Chorify font definitions ──────────────────────────────────────────────────
// Lexend  → display headings (modern geometric sans)
// Inter   → body, UI text (highly legible grotesque)

import {
  Lexend_700Bold,
  Lexend_600SemiBold,
} from '@expo-google-fonts/lexend'

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'

export const fontMap = {
  'Lexend-Bold':         Lexend_700Bold,
  'Lexend-SemiBold':     Lexend_600SemiBold,
  'Inter-Regular':       Inter_400Regular,
  'Inter-Medium':        Inter_500Medium,
  'Inter-SemiBold':      Inter_600SemiBold,
  'Inter-Bold':          Inter_700Bold,
} as const

export const Font = {
  // Display
  displayBold:    'Lexend-Bold',
  displaySemiBold:'Lexend-SemiBold',
  // Body
  regular:        'Inter-Regular',
  medium:         'Inter-Medium',
  semiBold:       'Inter-SemiBold',
  bold:           'Inter-Bold',
} as const

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 30,
  '3xl': 36,
} as const

export const LineHeight = {
  tight:  1.15,
  normal: 1.4,
  loose:  1.6,
} as const
