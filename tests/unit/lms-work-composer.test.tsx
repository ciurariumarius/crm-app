// @vitest-environment jsdom

import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createLmsWorkEntry: vi.fn(),
  getLmsWorkComposerContext: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/lms-analysis/work-log",
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/actions/lms-work-entries", () => ({
  createLmsWorkClient: vi.fn(),
  createLmsWorkEntry: mocks.createLmsWorkEntry,
  deleteLmsWorkEntry: vi.fn(),
  getLmsWorkComposerContext: mocks.getLmsWorkComposerContext,
  updateLmsWorkEntry: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { LmsWorkLogWorkspace } from "@/components/lms-work-entries/lms-work-log-workspace"
import type { LmsWorkComposerContext, LmsWorkLogPageData } from "@/lib/lms-work-entries/types"

const clientId = "11111111-1111-4111-8111-111111111111"
const taskId = "22222222-2222-4222-8222-222222222222"

const composerContext: LmsWorkComposerContext = {
  selectedDate: "2026-08-04",
  lmsAllocationId: null,
  weekStart: "2026-08-03",
  weekEnd: "2026-08-07",
  days: [
    { date: "2026-08-03", totalMinutes: 390 },
    { date: "2026-08-04", totalMinutes: 0 },
    { date: "2026-08-05", totalMinutes: 270 },
    { date: "2026-08-06", totalMinutes: 360 },
    { date: "2026-08-07", totalMinutes: 120 },
  ],
  frequentTasks: [{
    id: taskId,
    name: "Development",
    isActive: true,
    defaultDurationMinutes: 120,
  }],
}

const pageData: LmsWorkLogPageData = {
  clients: [{ id: clientId, client: "example.ro" }],
  tasks: composerContext.frequentTasks,
  frequentClients: [{ id: clientId, client: "example.ro" }],
  frequentTasks: composerContext.frequentTasks,
  frequentDurations: [],
  dateFilterOptions: [],
  clientFilterOptions: [],
  taskFilterOptions: [],
  entries: [],
  totalEntries: 0,
  allMatchingEntries: 0,
  unexportedEntries: 0,
  totalMinutes: 0,
  workedDays: 0,
  firstWorkDate: null,
  lastWorkDate: null,
  page: 1,
  pageSize: 50,
  totalPages: 1,
  from: null,
  to: null,
  workDate: null,
  clientId: null,
  taskId: null,
  exportStatus: "not-exported",
}

describe("Record Work composer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    mocks.createLmsWorkEntry.mockResolvedValue({ success: true, id: "entry-1" })
    mocks.getLmsWorkComposerContext.mockResolvedValue({
      success: true,
      context: {
        ...composerContext,
        lmsAllocationId: clientId,
        days: composerContext.days.map((day) => day.date === "2026-08-04"
          ? { ...day, totalMinutes: 120 }
          : day),
      },
    })
  })

  it("supports fast repeated entry without resetting the selected date or client", async () => {
    render(
      <LmsWorkLogWorkspace
        data={pageData}
        activePeriod="all"
        initialComposerContext={composerContext}
      />
    )

    const initialSave = screen.getByRole("button", { name: /Save · 4 Aug/i })
    expect(initialSave).toBeDisabled()
    expect(screen.queryByText("Select a client.")).not.toBeInTheDocument()
    expect(screen.queryByText("Select a task.")).not.toBeInTheDocument()
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent("TUE")
    expect(screen.queryByText("SAT")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "example.ro" }))
    fireEvent.click(screen.getByRole("button", { name: "Development" }))

    const save = screen.getByRole("button", { name: /Save 120 min · 4 Aug/i })
    expect(save).toBeEnabled()
    fireEvent.keyDown(save.closest("form") as HTMLFormElement, { key: "Enter", ctrlKey: true })

    await waitFor(() => expect(mocks.createLmsWorkEntry).toHaveBeenCalledWith({
      workDate: "2026-08-04",
      lmsAllocationId: clientId,
      taskTypeId: taskId,
      durationMinutes: 120,
    }))
    await waitFor(() => expect(screen.getByRole("button", { name: /Save · 4 Aug/i })).toBeDisabled())

    expect(screen.getByRole("button", { name: "example.ro" })).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector('[aria-current="date"]')).toHaveTextContent("TUE")
    expect(screen.getByRole("combobox", { name: "Select predefined task" })).toHaveFocus()
    expect(screen.getByText(/Already logged:/)).toHaveTextContent("Already logged: 2h")
    expect(mocks.refresh).toHaveBeenCalled()
  })
})
