import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.E2E_BASE_URL
const username = process.env.E2E_USERNAME || process.env.SEED_ADMIN_USERNAME
const password = process.env.E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD

test.skip(!baseUrl || !username || !password, "Set E2E_BASE_URL and E2E credentials for Notes coverage.")

async function authenticate(page: Page) {
  await page.goto("/notes")
  if (new URL(page.url()).pathname !== "/login") return
  await page.locator('input[name="username"]').fill(username!)
  await page.locator('input[name="password"]').fill(password!)
  await Promise.all([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000, waitUntil: "commit" }),
    page.getByRole("button", { name: "Sign In" }).click(),
  ])
  await page.goto("/notes")
}

test("Notes stays entry-focused and overflow-free at every breakpoint", async ({ page }) => {
  await authenticate(page)
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
    { name: "wide", width: 1920, height: 1080 },
  ] as const) {
    await page.setViewportSize(viewport)
    await page.goto("/notes")

    const header = page.locator('[data-slot="app-page-header"]')
    await expect(header.getByRole("heading", { name: "Notes" })).toBeVisible()
    await expect(header.locator('input[placeholder="Search"]:visible')).toBeVisible()
    await expect(header.locator('button:visible').filter({ hasText: "New Note" })).toBeVisible()
    await expect(page.getByText("Smart Folders & Tags")).toHaveCount(0)
    await expect(page.getByText("Current View")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /gallery|list view/i })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)

    if (viewport.width >= 768) {
      const editor = page.getByRole("textbox", { name: "Note content" })
      await expect(editor).toBeVisible()
      await expect(editor).toHaveAttribute("aria-multiline", "true")
      await expect(editor).toHaveAttribute("inputmode", "text")
      await expect(editor).toHaveAttribute("autocorrect", "on")
      await expect(editor).toHaveAttribute("autocapitalize", "sentences")
      await expect(editor).toHaveAttribute("autocomplete", "off")
      await expect(editor).toHaveAttribute("enterkeyhint", "enter")
      await editor.evaluate((element) => (element as HTMLElement).focus())
      await expect(page.getByRole("button", { name: "Draw" })).toBeVisible()
      if (viewport.name === "tablet") {
        await page.getByRole("button", { name: "Draw" }).click({ force: true })
        const drawingDialog = page.getByRole("dialog", { name: "New drawing" })
        await expect(drawingDialog).toBeVisible()
        await expect(drawingDialog.getByRole("img", { name: "Drawing canvas" })).toBeVisible()
        await drawingDialog.getByRole("button", { name: "Cancel" }).click()
        await expect(drawingDialog).toBeHidden()
      }
    }

    if (viewport.width >= 1280) {
      await page.getByRole("button", { name: "Hide collections and folders" }).click()
      await expect(page.getByRole("button", { name: "Show collections and folders" })).toBeVisible()
      await page.getByRole("button", { name: "Hide notes list" }).click()
      await expect(page.getByRole("button", { name: "Show notes list" })).toBeVisible()
      await page.getByRole("button", { name: "Show notes list" }).click()
      await page.getByRole("button", { name: "Show collections and folders" }).click()
    }
  }
})
