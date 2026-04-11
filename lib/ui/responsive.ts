export const RESPONSIVE_BREAKPOINTS = {
  mobileMax: 767,
  tabletPortraitMin: 768,
  tabletPortraitMax: 1023,
  tabletLandscapeMin: 1024,
  tabletLandscapeMax: 1279,
  desktopMin: 1280,
} as const

export type ResponsiveProfile = "mobile" | "tablet-portrait" | "tablet-landscape" | "desktop"

export function resolveResponsiveProfile(width: number): ResponsiveProfile {
  if (width <= RESPONSIVE_BREAKPOINTS.mobileMax) return "mobile"
  if (width <= RESPONSIVE_BREAKPOINTS.tabletPortraitMax) return "tablet-portrait"
  if (width <= RESPONSIVE_BREAKPOINTS.tabletLandscapeMax) return "tablet-landscape"
  return "desktop"
}

export const RESPONSIVE_MEDIA_QUERIES = {
  mobile: `(max-width: ${RESPONSIVE_BREAKPOINTS.mobileMax}px)`,
  tabletPortrait: `(min-width: ${RESPONSIVE_BREAKPOINTS.tabletPortraitMin}px) and (max-width: ${RESPONSIVE_BREAKPOINTS.tabletPortraitMax}px)`,
  tabletLandscape: `(min-width: ${RESPONSIVE_BREAKPOINTS.tabletLandscapeMin}px) and (max-width: ${RESPONSIVE_BREAKPOINTS.tabletLandscapeMax}px)`,
  desktop: `(min-width: ${RESPONSIVE_BREAKPOINTS.desktopMin}px)`,
} as const

