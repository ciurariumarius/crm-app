import { expect, test } from "@playwright/test"

test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run deployment smoke tests.")

test("public health and login surfaces are available", async ({ request, page }) => {
    const health = await request.get("/api/health")
    expect(health.ok()).toBeTruthy()
    await expect(health.json()).resolves.toEqual({ status: "ok" })

    await page.goto("/login")
    await expect(page).toHaveTitle(/Pixelist/i)
    await expect(page.locator("body")).toBeVisible()
})

test("diagnostic filenames are not publicly exposed", async ({ request }) => {
    for (const filename of ["diag-logs.txt", "pm2_status.txt", "pm2_out.txt"]) {
        const response = await request.get(`/${filename}`)
        expect(response.status()).toBe(404)
    }
})
