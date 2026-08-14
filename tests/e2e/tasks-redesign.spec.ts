import { expect, test } from "@playwright/test"

const authState = process.env.E2E_AUTH_STATE

const viewports = [
  { name: "mobile", width: 390, height: 844, columns: 1 },
  { name: "tablet-portrait", width: 768, height: 1024, columns: 2 },
  { name: "tablet-landscape", width: 1024, height: 768, columns: 3 },
  { name: "desktop", width: 1440, height: 900, columns: 4 },
  { name: "wide-desktop", width: 1920, height: 1080, columns: 4 },
] as const

test.describe("Tasks redesign", () => {
  test.skip(!authState, "Set E2E_AUTH_STATE to an authenticated Playwright storage-state file.")
  test.use({ storageState: authState || { cookies: [], origins: [] } })

  for (const viewport of viewports) {
    test(`${viewport.name} keeps controls and task cards responsive`, async ({ page }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto("/tasks")

      const header = page.locator('[data-slot="app-page-header"]')
      await expect(header).toBeVisible()
      await expect(header.getByRole("navigation", { name: "Task status" })).toBeVisible()
      await expect(header.getByRole("button", { name: /^Filters/ })).toBeVisible()
      await expect(page.locator('[data-slot="add-task-card"]')).toHaveCount(1)

      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      expect(hasOverflow).toBeFalsy()

      const gridItems = page.locator('[data-slot="tasks-grid"] > [data-task-card-id], [data-slot="tasks-grid"] > [data-slot="add-task-card"]')
      const boxes = await gridItems.evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { top: Math.round(box.top), width: box.width, height: box.height }
      }))
      expect(boxes.length).toBeGreaterThan(0)
      const firstRowCount = boxes.filter((box) => Math.abs(box.top - boxes[0].top) <= 2).length
      expect(firstRowCount).toBe(Math.min(viewport.columns, boxes.length))

      const taskCard = page.locator('[data-task-card-id]').first()
      if (await taskCard.count()) {
        const cardMetrics = await taskCard.evaluate((element) => {
          const box = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return { width: box.width, height: box.height, paddingLeft: Number.parseFloat(style.paddingLeft) }
        })
        expect(cardMetrics.paddingLeft).toBeGreaterThanOrEqual(16)
        if (viewport.width >= 768) {
          expect(cardMetrics.width / cardMetrics.height).toBeGreaterThan(1.15)
          expect(cardMetrics.width / cardMetrics.height).toBeLessThan(1.75)
        }
      }

      await page.getByRole("button", { name: "Add task", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: "Add task" })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByLabel(/Task name/)).toBeFocused()
      await expect(dialog.getByLabel("Planned time (min)")).toBeVisible()
      await expect(dialog.getByText(/LMS stays separate|Available for Freelance and LMS|Client work|My job/)).toHaveCount(0)

      const projectTrigger = dialog.getByRole("combobox", { name: /freelance project/i })
      await projectTrigger.click()
      const projectMenu = page.locator('[data-slot="popover-content"]').filter({ has: page.getByPlaceholder("Search projects…") })
      await expect(projectMenu).toBeVisible()
      const widths = await Promise.all([projectTrigger.boundingBox(), projectMenu.boundingBox()])
      expect(widths[0]).not.toBeNull()
      expect(widths[1]).not.toBeNull()
      expect(Math.abs((widths[0]?.width || 0) - (widths[1]?.width || 0))).toBeLessThanOrEqual(2)

      const projectList = projectMenu.locator('[cmdk-list]')
      const canScroll = await projectList.evaluate((element) => element.scrollHeight > element.clientHeight)
      if (canScroll) {
        await projectList.hover()
        await page.mouse.wheel(0, 500)
        await expect.poll(() => projectList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      }

      await page.keyboard.press("Escape")
      await expect(projectMenu).toBeHidden()
      await dialog.getByRole("button", { name: "Close" }).click()
      await expect(dialog).toBeHidden()
    })
  }
})
