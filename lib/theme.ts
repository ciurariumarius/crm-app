export const THEME_MODES = ["light", "dark", "system"] as const

export type ThemeMode = (typeof THEME_MODES)[number]

export const THEME_STORAGE_KEY = "crm-theme"
export const DEFAULT_THEME_MODE: ThemeMode = "system"
