// ── Chorify font definitions ──────────────────────────────────────────────────
// Fraunces  → display headings (playful serif)
// DM Sans   → body, UI text (modern grotesque)

import {
  Fraunces_700Bold,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces'

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'

export const fontMap = {
  'Fraunces-Bold':         Fraunces_700Bold,
  'Fraunces-SemiBold':     Fraunces_600SemiBold,
  'DMSans-Regular':        DMSans_400Regular,
  'DMSans-Medium':         DMSans_500Medium,
  'DMSans-SemiBold':       DMSans_600SemiBold,
  'DMSans-Bold':           DMSans_700Bold,
} as const

export const Font = {
  // Display
  displayBold:    'Fraunces-Bold',
  displaySemiBold:'Fraunces-SemiBold',
  // Body
  regular:        'DMSans-Regular',
  medium:         'DMSans-Medium',
  semiBold:       'DMSans-SemiBold',
  bold:           'DMSans-Bold',
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
