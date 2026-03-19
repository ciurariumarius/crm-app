import { test, expect, type Page } from "@playwright/test"

async function loginIfConfigured(page: Page) {
    const username = process.env.PLAYWRIGHT_USERNAME
    const password = process.env.PLAYWRIGHT_PASSWORD

    if (!username || !password) {
        return false
    }

    await page.goto("/login")
    await page.locator('input[name="username"]').fill(username)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole("button", { name: /sign in/i }).click()
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 })
    return true
}

test("login page baseline", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveScreenshot("login-page.png", {
        fullPage: true,
    })
})

test("tasks page baseline", async ({ page }) => {
    const loggedIn = await loginIfConfigured(page)
    await page.goto("/tasks")

    if (!loggedIn) {
        await expect(page).toHaveURL(/\/login/)
        return
    }

    await page.getByRole("heading", { name: /tasks/i }).first().waitFor({ state: "visible" })
    await expect(page).toHaveScreenshot("tasks-page.png", {
        fullPage: true,
    })
})

test("projects page baseline", async ({ page }) => {
    const loggedIn = await loginIfConfigured(page)
    await page.goto("/projects")

    if (!loggedIn) {
        await expect(page).toHaveURL(/\/login/)
        return
    }

    await page.getByRole("heading", { name: /projects/i }).first().waitFor({ state: "visible" })
    await expect(page).toHaveScreenshot("projects-page.png", {
        fullPage: true,
    })
})
