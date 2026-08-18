export const PUBLIC_ASSET_PATHS = [
    "/apple-icon.png",
    "/brands/limitless-lms.png",
    "/file.svg",
    "/favicon.ico",
    "/globe.svg",
    "/icon.svg",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/icons/icon.svg",
    "/manifest.json",
    "/next.svg",
    "/sw.js",
    "/vercel.svg",
    "/window.svg",
] as const

export const PUBLIC_ASSET_PATH_SET = new Set<string>(PUBLIC_ASSET_PATHS)

export const BLOCKED_PUBLIC_DIAGNOSTIC_PATTERN = /^\/(?:diag-|pm2_).+\.txt$/i
