// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  createLmsWorkEntry: vi.fn(),
  deleteLmsWorkEntry: vi.fn(),
  getLmsWorkComposerContext: vi.fn(),
  reopenTask: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/lms-analysis/work-log",
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/actions/lms-work-entries", () => ({
  createLmsWorkClient: vi.fn(),
  createLmsWorkEntry: mocks.createLmsWorkEntry,
  deleteLmsWorkEntry: mocks.deleteLmsWorkEntry,
  getLmsWorkComposerContext: mocks.getLmsWorkComposerContext,
  updateLmsWorkEntry: vi.fn(),
}))

vi.mock("@/lib/actions/tasks", () => ({
  reopenTask: mocks.reopenTask,
}))

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
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
  uniqueClientsCount: 1,
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
  origin: "all",
  exportStatus: "not-exported",
}

describe("Record Work composer", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

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
    mocks.deleteLmsWorkEntry.mockResolvedValue({ success: true })
    mocks.reopenTask.mockResolvedValue({ success: true, data: { entryDeleted: true, exportedEntryPreserved: false } })
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

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Select predefined task" })).toHaveFocus()
    })
    expect(screen.getByText(/Already logged:/)).toHaveTextContent("Already logged: 2h")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("separates a linked CRM task entry and reopens it instead of offering delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const crmTaskEntry = {
      id: "33333333-3333-4333-8333-333333333333",
      lmsAllocationId: clientId,
      taskTypeId: taskId,
      workDate: "2026-08-04",
      durationMinutes: 90,
      clientDomain: "example.ro",
      taskName: "Development",
      origin: "CRM_TASK" as const,
      crmTaskId: "44444444-4444-4444-8444-444444444444",
      crmTaskName: "Fix checkout tracking",
      employeeName: "Marius Ciurariu",
      exportedAt: null,
      createdAt: "2026-08-04T10:00:00.000Z",
      updatedAt: "2026-08-04T10:00:00.000Z",
    }

    render(
      <LmsWorkLogWorkspace
        data={{
          ...pageData,
          entries: [crmTaskEntry],
          totalEntries: 1,
          allMatchingEntries: 1,
          unexportedEntries: 1,
          totalMinutes: 90,
          workedDays: 1,
          firstWorkDate: crmTaskEntry.workDate,
          lastWorkDate: crmTaskEntry.workDate,
        }}
        activePeriod="all"
        initialComposerContext={composerContext}
      />
    )

    expect(screen.getAllByText("CRM task").length).toBeGreaterThan(0)
    expect(screen.getAllByText("CRM: Fix checkout tracking").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: "Delete Development" })).not.toBeInTheDocument()

    const reopenButtons = screen.getAllByRole("button", { name: "Reopen CRM task Fix checkout tracking" })
    fireEvent.click(reopenButtons[0])
    await waitFor(() => {
      expect(mocks.reopenTask).toHaveBeenCalledWith(crmTaskEntry.crmTaskId)
      expect(mocks.toastSuccess).toHaveBeenCalledWith("CRM task reopened")
    })
  })

  it("locks exported CRM task edits while keeping reopen available", () => {
    const crmTaskEntry = {
      id: "55555555-5555-4555-8555-555555555555",
      lmsAllocationId: clientId,
      taskTypeId: taskId,
      workDate: "2026-08-04",
      durationMinutes: 90,
      clientDomain: "example.ro",
      taskName: "Development",
      origin: "CRM_TASK" as const,
      crmTaskId: "66666666-6666-4666-8666-666666666666",
      crmTaskName: "Fix consent mode",
      employeeName: "Marius Ciurariu",
      exportedAt: "2026-08-05T10:00:00.000Z",
      createdAt: "2026-08-04T10:00:00.000Z",
      updatedAt: "2026-08-05T10:00:00.000Z",
    }

    render(
      <LmsWorkLogWorkspace
        data={{ ...pageData, entries: [crmTaskEntry], totalEntries: 1, allMatchingEntries: 1 }}
        activePeriod="all"
        initialComposerContext={composerContext}
      />
    )

    for (const button of screen.getAllByRole("button", { name: /Editing Development is locked/ })) {
      expect(button).toBeDisabled()
    }
    for (const button of screen.getAllByRole("button", { name: "Reopen CRM task Fix consent mode" })) {
      expect(button).toBeEnabled()
    }
    expect(screen.queryByRole("button", { name: "Delete Development" })).not.toBeInTheDocument()
  })

  it("allows an unexported orphan CRM task entry to be cleaned up", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const orphanEntry = {
      id: "77777777-7777-4777-8777-777777777777",
      lmsAllocationId: clientId,
      taskTypeId: taskId,
      workDate: "2026-08-04",
      durationMinutes: 30,
      clientDomain: "example.ro",
      taskName: "Development",
      origin: "CRM_TASK" as const,
      crmTaskId: null,
      crmTaskName: "Deleted CRM task",
      employeeName: "Marius Ciurariu",
      exportedAt: null,
      createdAt: "2026-08-04T10:00:00.000Z",
      updatedAt: "2026-08-04T10:00:00.000Z",
    }

    render(
      <LmsWorkLogWorkspace
        data={{ ...pageData, entries: [orphanEntry], totalEntries: 1, allMatchingEntries: 1 }}
        activePeriod="all"
        initialComposerContext={composerContext}
      />
    )

    expect(screen.queryByRole("button", { name: /Reopen CRM task/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Delete Development" })[0])
    await waitFor(() => expect(mocks.deleteLmsWorkEntry).toHaveBeenCalledWith(orphanEntry.id))
  })

  it("renders unique clients card and calculates capacity from tasks timeframe when all time is selected", () => {
    render(
      <LmsWorkLogWorkspace
        data={{
          ...pageData,
          totalEntries: 2,
          totalMinutes: 180,
          workedDays: 2,
          uniqueClientsCount: 4,
          firstWorkDate: "2026-08-03",
          lastWorkDate: "2026-08-04",
          from: null,
          to: null,
        }}
        activePeriod="all"
        initialComposerContext={composerContext}
      />
    )

    expect(screen.getByText("Unique clients")).toBeInTheDocument()
    expect(screen.getByText("Unique clients").closest("div")).toHaveTextContent("4")
    expect(screen.queryByText("Choose a date range")).not.toBeInTheDocument()
    expect(screen.getByText(/16h · 19%/)).toBeInTheDocument()
  })
})
