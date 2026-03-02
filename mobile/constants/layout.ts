// ── Responsive layout utilities ───────────────────────────────────────────────
// Provides breakpoint-aware values for padding, max-width, and tab sizing.
// Tablet is defined as any screen ≥ 768 pt wide (covers all iPad models).

import { useWindowDimensions } from 'react-native'

export const TABLET_BREAKPOINT = 768

/** Max width for scrollable content on tablet (leaves comfortable side margins). */
export const CONTENT_MAX_WIDTH = 680

/** Max width for bottom sheets on tablet. */
export const SHEET_MAX_WIDTH = 560

export function useLayout() {
  const { width, height } = useWindowDimensions()
  const isTablet    = width >= TABLET_BREAKPOINT
  const isLandscape = width > height

  return {
    isTablet,
    isLandscape,
    /** Horizontal padding for scroll content containers. */
    contentPadding: isTablet ? 24 : 16,
    /** Horizontal padding for screen headers. */
    headerPadding: isTablet ? 32 : 20,
    /** Max-width for scroll content (undefined on phone = no constraint). */
    contentMaxWidth: isTablet ? CONTENT_MAX_WIDTH : undefined,
    /** Max-width for bottom sheets (undefined on phone). */
    sheetMaxWidth: isTablet ? SHEET_MAX_WIDTH : undefined,
  }
}
