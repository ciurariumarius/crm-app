import { expect, test, type Locator, type Page } from "@playwright/test"

const baseUrl = process.env.E2E_BASE_URL
const authState = process.env.E2E_AUTH_STATE
const username = process.env.E2E_USERNAME || process.env.SEED_ADMIN_USERNAME
const password = process.env.E2E_PASSWORD || process.env.SEED_ADMIN_PASSWORD
const twoFactorCode = process.env.E2E_TOTP
const preferredLmsProject = process.env.E2E_LMS_PROJECT
const preferredLmsCategory = process.env.E2E_LMS_CATEGORY
const mutationsEnabled = process.env.E2E_LMS_FLOW_MUTATIONS === "1"

test.skip(!baseUrl, "Set E2E_BASE_URL to run the authenticated LMS task flow.")
test.skip(!mutationsEnabled, "Set E2E_LMS_FLOW_MUTATIONS=1 to allow temporary task and work-entry writes.")
test.skip(
  !authState && (!username || !password),
  "Set E2E_AUTH_STATE or E2E_USERNAME/E2E_PASSWORD for the authenticated LMS task flow."
)

test.use({
  viewport: { width: 390, height: 844 },
  storageState: authState || { cookies: [], origins: [] },
})

function pathName(page: Page) {
  return new URL(page.url()).pathname
}

async function authenticate(page: Page) {
  await page.goto("/tasks")
  if (pathName(page) !== "/login") return

  if (!username || !password) {
    throw new Error("E2E_AUTH_STATE is no longer valid and no E2E_USERNAME/E2E_PASSWORD fallback was provided.")
  }

  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole("button", { name: "Sign In" }).click()

  const twoFactorHeading = page.getByRole("heading", { name: "Two-Factor Authentication" })
  const loginOutcome = await Promise.race([
    page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000, waitUntil: "commit" }).then(() => "authenticated" as const),
    twoFactorHeading.waitFor({ state: "visible", timeout: 20_000 }).then(() => "two-factor" as const),
  ])

  if (loginOutcome === "two-factor") {
    if (!twoFactorCode) {
      throw new Error("This account requires 2FA. Provide a current code through E2E_TOTP or use E2E_AUTH_STATE.")
    }
    await page.locator('input[placeholder="000 000"]').fill(twoFactorCode)
    await page.getByRole("button", { name: "Verify Identity" }).click()
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000, waitUntil: "commit" })
  }

  if (pathName(page) !== "/tasks") {
    await page.goto("/tasks", { waitUntil: "commit" })
  }
  await expect(page).toHaveURL(/\/tasks(?:\?|$)/, { timeout: 20_000 })
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )).toBe(true)
}

async function chooseLmsOption({
  page,
  combobox,
  searchPlaceholder,
  preferredLabel,
}: {
  page: Page
  combobox: Locator
  searchPlaceholder: string
  preferredLabel?: string
}) {
  await expect(combobox).toBeEnabled({ timeout: 20_000 })
  await combobox.click()

  const search = page.getByPlaceholder(searchPlaceholder)
  await expect(search).toBeVisible()
  if (preferredLabel) await search.fill(preferredLabel)

  const options = page.getByRole("option").filter({ hasNotText: /^Not linked yet$/i })
  const option = preferredLabel
    ? options.filter({ hasText: preferredLabel }).first()
    : options.first()

  await expect(option, `Expected an LMS option for ${searchPlaceholder}`).toBeVisible({ timeout: 20_000 })
  await option.click()

  const preferredExpectedLabel = preferredLabel?.trim()
  if (preferredExpectedLabel) {
    await expect(combobox).toContainText(preferredExpectedLabel)
    return preferredExpectedLabel
  }

  // Read the selected value from the closed trigger. Option rows may contain
  // secondary metadata (for example a default duration) that is not part of
  // the persisted project/category label.
  const selectedLabel = (await combobox.locator("span").first().textContent())?.trim()
  if (!selectedLabel) throw new Error(`Could not read the selected LMS option for ${searchPlaceholder}.`)
  return selectedLabel
}

async function getPersistedLmsMapping(page: Page, taskName: string) {
  const response = await page.evaluate(async (url) => {
    const result = await fetch(url, { cache: "no-store", credentials: "same-origin" })
    return { ok: result.ok, payload: await result.json() }
  },
    `/api/search/tasks?q=${encodeURIComponent(taskName)}&status=All&limit=10&cacheBust=${Date.now()}`,
  )
  if (!response.ok) return null

  const payload = response.payload as {
    tasks?: Array<{
      name?: string
      lmsAllocationId?: string | null
      lmsTaskTypeId?: string | null
      lmsAllocation?: { client?: string | null } | null
      lmsTaskType?: { name?: string | null } | null
    }>
  }
  return payload.tasks?.find((task) => task.name === taskName) || null
}

async function openTask(page: Page, taskName: string) {
  const taskHeading = page.getByRole("heading", { name: taskName, exact: true }).first()
  await expect(taskHeading).toBeVisible({ timeout: 20_000 })
  await taskHeading.locator("xpath=ancestor::div[@data-task-card-id]").click()
  const taskSheet = page.locator('[data-slot="sheet-content"]').filter({ hasText: taskName }).last()
  await expect(taskSheet).toBeVisible({ timeout: 20_000 })
  return taskSheet
}

async function reopenGeneratedWorkEntry(page: Page, taskName: string) {
  await page.goto("/lms-analysis/work-log?origin=CRM_TASK&exportStatus=not-exported&pageSize=100")
  const reopenButton = page.getByRole("button", { name: `Reopen CRM task ${taskName}`, exact: true }).last()
  if (!await reopenButton.isVisible().catch(() => false)) return

  page.once("dialog", async (dialog) => {
    await dialog.accept()
  })
  await reopenButton.click()
  await expect(page.getByText("CRM task reopened", { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(`CRM: ${taskName}`, { exact: true })).toHaveCount(0, { timeout: 20_000 })
}

async function deleteTaskIfPresent(page: Page, taskName: string) {
  await page.goto(`/tasks?status=All&q=${encodeURIComponent(taskName)}`)
  const taskHeading = page.getByRole("heading", { name: taskName, exact: true }).first()
  if (!await taskHeading.isVisible().catch(() => false)) return

  const taskSheet = await openTask(page, taskName)
  const completedButton = taskSheet.getByRole("button", { name: "Completed", exact: true })
  if (await completedButton.isVisible().catch(() => false)) {
    await completedButton.click()
    await page.getByRole("menuitem", { name: "Active", exact: true }).click()
    await expect(taskSheet.getByRole("button", { name: "Active", exact: true })).toBeVisible({ timeout: 20_000 })
  }

  await taskSheet.getByRole("button", { name: "Delete Task ID" }).click()
  await expect(taskSheet).toBeHidden({ timeout: 20_000 })
}

test("creates, maps, and completes an LMS task without mixing manual work", async ({ page }) => {
  test.setTimeout(120_000)
  const taskName = `E2E LMS task ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  await authenticate(page)

  try {
    await expectNoHorizontalOverflow(page)
    await page.getByRole("button", { name: "Add", exact: true }).click()

    const createDialog = page.getByRole("dialog", { name: "Add New Task" })
    await expect(createDialog).toBeVisible()
    await createDialog.getByRole("radio", { name: /^LMS\b/ }).click()
    await createDialog.getByPlaceholder("ex. Verificare dataLayer").fill(taskName)
    await createDialog.getByRole("button", { name: "Add Additional Details" }).click()
    await createDialog.getByPlaceholder("ex. 60").fill("37")
    await expectNoHorizontalOverflow(page)
    await createDialog.getByRole("button", { name: "Create Task" }).click()
    await expect(createDialog).toBeHidden({ timeout: 20_000 })

    await page.goto(`/tasks?q=${encodeURIComponent(taskName)}`)
    let taskSheet = await openTask(page, taskName)
    await expect(taskSheet.getByText("LMS time is recorded on completion", { exact: true })).toBeVisible()
    await expect(taskSheet.getByText("Add Time", { exact: true })).toHaveCount(0)

    const lmsProjectLabel = await chooseLmsOption({
      page,
      combobox: taskSheet.getByRole("combobox", { name: "Select LMS project" }),
      searchPlaceholder: "Search LMS project…",
      preferredLabel: preferredLmsProject,
    })
    await expect.poll(
      () => taskSheet.getByRole("combobox", { name: "Select LMS project" }).textContent(),
      { timeout: 20_000 }
    ).toContain(lmsProjectLabel.trim())

    // Target edits auto-save. Wait for the project write to finish before
    // changing the category so the second request cannot race the first one.
    await expect.poll(async () => {
      const persisted = await getPersistedLmsMapping(page, taskName)
      return Boolean(persisted?.lmsAllocationId)
    }, { timeout: 20_000 }).toBe(true)

    const lmsCategoryLabel = await chooseLmsOption({
      page,
      combobox: taskSheet.getByRole("combobox", { name: "Select LMS work category" }),
      searchPlaceholder: "Search work category…",
      preferredLabel: preferredLmsCategory,
    })
    await expect.poll(
      () => taskSheet.getByRole("combobox", { name: "Select LMS work category" }).textContent(),
      { timeout: 20_000 }
    ).toContain(lmsCategoryLabel.trim())
    await expect.poll(async () => {
      const persisted = await getPersistedLmsMapping(page, taskName)
      return Boolean(persisted?.lmsAllocationId && persisted?.lmsTaskTypeId)
    }, { timeout: 20_000 }).toBe(true)

    // Reloading proves the optional LMS mapping was persisted by the edit flow.
    await page.reload()
    taskSheet = await openTask(page, taskName)
    await expect(taskSheet.getByRole("combobox", { name: "Select LMS project" })).toContainText(lmsProjectLabel)
    await expect(taskSheet.getByRole("combobox", { name: "Select LMS work category" })).toContainText(lmsCategoryLabel)

    await taskSheet.getByRole("button", { name: "Active", exact: true }).click()
    await page.getByRole("menuitem", { name: "Completed", exact: true }).click()

    const completionDialog = page.getByRole("dialog", { name: "Complete LMS task" })
    await expect(completionDialog).toBeVisible({ timeout: 20_000 })
    await expect(completionDialog.getByRole("combobox", { name: "Select LMS project" })).toContainText(lmsProjectLabel)
    await expect(completionDialog.getByRole("combobox", { name: "Select LMS work category" })).toContainText(lmsCategoryLabel)
    await expect(completionDialog.getByLabel(/Actual minutes/)).toHaveValue("37")

    const workDate = await completionDialog.getByLabel(/Work date/).inputValue()
    const workDay = new Date(`${workDate}T12:00:00Z`).getUTCDay()
    expect(workDay).toBeGreaterThanOrEqual(1)
    expect(workDay).toBeLessThanOrEqual(5)

    await completionDialog.getByLabel(/Actual minutes/).fill("43")
    await expectNoHorizontalOverflow(page)
    await completionDialog.getByRole("button", { name: "Complete & record work" }).click()
    await expect(completionDialog).toBeHidden({ timeout: 20_000 })
    await expect(page.getByText("Task completed and LMS work recorded", { exact: true }).last()).toBeVisible({ timeout: 20_000 })

    await page.goto("/lms-analysis/work-log?origin=CRM_TASK&exportStatus=not-exported&pageSize=100")
    await expect(page.getByText("Record work", { exact: true }).first()).toBeVisible()
    const generatedEntryLabel = page.getByText(`CRM: ${taskName}`, { exact: true }).last()
    await expect(generatedEntryLabel).toBeVisible({ timeout: 20_000 })
    const generatedEntryCard = generatedEntryLabel.locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]")
    await expect(generatedEntryCard.getByText(/^(?:0h )?43m$/, { exact: true })).toBeVisible()
    await expect(page.getByText("CRM task", { exact: true }).last()).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await reopenGeneratedWorkEntry(page, taskName)
    await page.goto(`/tasks?q=${encodeURIComponent(taskName)}`)
    taskSheet = await openTask(page, taskName)
    await expect(taskSheet.getByRole("button", { name: "Active", exact: true })).toBeVisible()
    await taskSheet.getByRole("button", { name: "Delete Task ID" }).click()
    await expect(taskSheet).toBeHidden({ timeout: 20_000 })

    await page.reload()
    await expect(page.getByRole("heading", { name: taskName, exact: true })).toHaveCount(0)
  } finally {
    await reopenGeneratedWorkEntry(page, taskName).catch(() => undefined)
    await deleteTaskIfPresent(page, taskName).catch(() => undefined)
  }
})
