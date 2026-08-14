import { expect, test } from "@playwright/test"

const authState = process.env.E2E_AUTH_STATE

const routes = [
  "/",
  "/tasks",
  "/projects",
  "/payments",
  "/notes",
  "/lms-analysis/work-log",
  "/analytics",
  "/ledger",
  "/partners",
  "/ppc/google-ads",
  "/ppc/facebook-ads",
  "/settings",
] as const

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide-desktop", width: 1920, height: 1080 },
] as const

test.describe("design system route captures", () => {
  test.skip(!authState, "Set E2E_AUTH_STATE to a Playwright storage-state file for authenticated design captures.")
  test.use({ storageState: authState || { cookies: [], origins: [] } })

  for (const theme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      test(`${theme} · ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.addInitScript((selectedTheme) => {
          window.localStorage.setItem("crm-theme", selectedTheme)
        }, theme)

        for (const route of routes) {
          await page.goto(route)
          await expect(page.locator('[data-slot="app-page-header"]')).toHaveCount(1)
          await expect(page.locator("body")).toBeVisible()

          const hasPageOverflow = await page.evaluate(() =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
          )
          expect(hasPageOverflow, `${route} must not create page-level horizontal overflow`).toBeFalsy()

          if (route === "/tasks") {
            await expect(page.locator('[data-slot="add-task-card"]')).toHaveCount(1)
            await expect(page.getByRole("button", { name: /^Filters/ }).first()).toBeVisible()
          }

          const slug = route === "/" ? "overview" : route.slice(1).replaceAll("/", "-")
          await page.screenshot({
            path: test.info().outputPath(`${theme}-${viewport.name}-${slug}.png`),
            fullPage: true,
            animations: "disabled",
          })
        }
      })
    }
  }
})
