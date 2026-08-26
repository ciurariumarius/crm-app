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

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    vertical: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
  }))).toEqual({ horizontal: true, vertical: true })
}

test("Notes uses the intended mobile, tablet, and desktop pane layouts", async ({ page }) => {
  await authenticate(page)

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ] as const) {
    await page.setViewportSize(viewport)
    await page.goto("/notes")

    const workspace = page.locator('[data-slot="notes-workspace"]')
    const folders = page.locator('[data-slot="notes-folders"]')
    const list = page.locator('[data-slot="notes-list"]')
    const editorPane = page.locator('[data-slot="notes-editor"]')
    const toolbar = page.locator('[data-slot="notes-formatting-toolbar"]')

    await expect(workspace).toBeVisible()
    await expect(list).toBeVisible()
    await expectNoDocumentOverflow(page)

    if (viewport.width < 768) {
      await expect(folders).toBeHidden()
      await expect(editorPane).toBeHidden()
      await expect(toolbar).toBeHidden()

      const firstNote = list.locator("button[data-note-id]").first()
      if (await firstNote.count()) {
        await firstNote.click()
        await expect(editorPane).toBeVisible()
        const editor = page.getByRole("textbox", { name: "Note content" })
        await expect(editor).toBeVisible()
        await expect(editor).not.toBeFocused()
        await expect(toolbar).toBeHidden()
        await expect(page).toHaveURL((url) => Boolean(url.searchParams.get("note")))
        await page.getByRole("button", { name: "Back to notes list" }).click()
        await expect(list).toBeVisible()
        await expect(page).toHaveURL((url) => !url.searchParams.has("note"))
      }
    } else if (viewport.width < 1280) {
      await expect(folders).toBeHidden()
      await expect(editorPane).toBeVisible()
      await expect(page.getByRole("button", { name: "Folders" })).toBeVisible()
      await expect(toolbar).toBeVisible()
    } else {
      await expect(folders).toBeVisible()
      await expect(editorPane).toBeVisible()
      await expect(toolbar).toBeVisible()
    }
  }
})

test("new-note deep link focuses a blank editor without persisting an untouched note", async ({ page }) => {
  await authenticate(page)
  await page.setViewportSize({ width: 390, height: 844 })

  const notesPostRequests: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/notes") {
      notesPostRequests.push(request.url())
    }
  })

  await page.goto("/notes?new=1")

  const editor = page.getByRole("textbox", { name: "Note content" })
  await expect(editor).toBeVisible()
  await expect(editor).toBeFocused()
  await expect(editor).toHaveText("")
  await expect(page.locator('[data-slot="notes-formatting-toolbar"]')).toBeHidden()
  await expect(page).toHaveURL((url) => url.pathname === "/notes" && !url.searchParams.has("new"))

  await page.waitForTimeout(1_000)
  expect(notesPostRequests).toEqual([])
})

test("Notes search exposes its keyboard shortcut and accessible name", async ({ page }) => {
  await authenticate(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto("/notes")

  const search = page.getByRole("textbox", { name: "Search notes" })
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K")
  await expect(search).toBeFocused()
})
