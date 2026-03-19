import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000"

export default defineConfig({
    testDir: "./tests/visual",
    timeout: 45_000,
    expect: {
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.02,
        },
    },
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    use: {
        baseURL,
        trace: "on-first-retry",
        viewport: { width: 1440, height: 900 },
    },
    projects: [
        { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    ],
})

