import { beforeEach, describe, expect, it, vi } from "vitest"
import { LMS_CRM_EMPLOYEE_NAME } from "@/lib/lms-work-entries/crm-template"
import {
  buildLmsOwnerCapacitySummary,
  buildLmsOwnerPeriodSummary,
  getLmsOwnerSummaryRanges,
} from "@/lib/lms-tasks/owner-summary"

const prismaMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    lmsTaskLog: {
      aggregate: prismaMocks.aggregate,
      findFirst: prismaMocks.findFirst,
    },
  },
}))

import { getLmsOwnerCapacitySummary } from "@/lib/lms-tasks/db"

describe("LMS owner summary periods", () => {
  it("builds month-to-date and quarter-to-date ranges", () => {
    expect(getLmsOwnerSummaryRanges("2026-08-17")).toEqual({
      month: { from: "2026-08-01", to: "2026-08-17" },
      quarter: { from: "2026-07-01", to: "2026-08-17" },
    })
    expect(getLmsOwnerSummaryRanges("2026-01-01")).toEqual({
      month: { from: "2026-01-01", to: "2026-01-01" },
      quarter: { from: "2026-01-01", to: "2026-01-01" },
    })
  })

  it("rejects invalid date-only values instead of normalizing them", () => {
    expect(() => getLmsOwnerSummaryRanges("2026-02-30")).toThrow(
      "Expected a valid date in YYYY-MM-DD format"
    )
  })

  it("calculates Romanian workday capacity and one-decimal utilization", () => {
    const summary = buildLmsOwnerCapacitySummary({
      employeeName: LMS_CRM_EMPLOYEE_NAME,
      asOf: "2026-08-17",
      latestTaskDate: "2026-08-14",
      monthLoggedMinutes: 2_640,
      quarterLoggedMinutes: 8_160,
    })

    expect(summary.latestTaskDate).toBe("2026-08-14")
    expect(summary.month).toEqual({
      from: "2026-08-01",
      to: "2026-08-17",
      loggedMinutes: 2_640,
      capacityMinutes: 5_280,
      capacityHours: 88,
      utilizationPercent: 50,
    })
    expect(summary.quarter).toEqual({
      from: "2026-07-01",
      to: "2026-08-17",
      loggedMinutes: 8_160,
      capacityMinutes: 16_320,
      capacityHours: 272,
      utilizationPercent: 50,
    })
  })

  it("uses the canonical Romanian holidays including 6 and 7 January", () => {
    const firstWeek = buildLmsOwnerCapacitySummary({
      employeeName: LMS_CRM_EMPLOYEE_NAME,
      asOf: "2026-01-07",
      latestTaskDate: null,
      monthLoggedMinutes: 0,
      quarterLoggedMinutes: 0,
    })

    expect(firstWeek.month.capacityMinutes).toBe(8 * 60)
  })

  it("keeps the full-year Romanian capacity on the canonical calendar", () => {
    const fullYear = buildLmsOwnerPeriodSummary({
      from: "2026-01-01",
      to: "2026-12-31",
      loggedMinutes: 0,
    })

    expect(fullYear.capacityMinutes).toBe(250 * 8 * 60)
  })

  it("returns zero utilization when the range has no workday capacity", () => {
    const summary = buildLmsOwnerCapacitySummary({
      employeeName: LMS_CRM_EMPLOYEE_NAME,
      asOf: "2026-01-01",
      latestTaskDate: null,
      monthLoggedMinutes: 60,
      quarterLoggedMinutes: 60,
    })

    expect(summary.month.capacityMinutes).toBe(0)
    expect(summary.month.utilizationPercent).toBe(0)
    expect(summary.quarter.capacityMinutes).toBe(0)
    expect(summary.quarter.utilizationPercent).toBe(0)
  })

  it("preserves utilization above 100 percent", () => {
    expect(buildLmsOwnerPeriodSummary({
      from: "2026-08-17",
      to: "2026-08-17",
      loggedMinutes: 960,
    }).utilizationPercent).toBe(200)
  })
})

describe("getLmsOwnerCapacitySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses only owner LmsTaskLog aggregates and returns the latest owner task date", async () => {
    prismaMocks.aggregate
      .mockResolvedValueOnce({ _sum: { durationMinutes: 600 } })
      .mockResolvedValueOnce({ _sum: { durationMinutes: 1_800 } })
    prismaMocks.findFirst.mockResolvedValue({
      taskDate: new Date("2026-08-14T00:00:00.000Z"),
    })

    const summary = await getLmsOwnerCapacitySummary("2026-08-17")

    expect(summary).toMatchObject({
      employeeName: LMS_CRM_EMPLOYEE_NAME,
      asOf: "2026-08-17",
      latestTaskDate: "2026-08-14",
      month: { loggedMinutes: 600 },
      quarter: { loggedMinutes: 1_800 },
    })
    expect(prismaMocks.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        executant: LMS_CRM_EMPLOYEE_NAME,
        taskDate: {
          gte: new Date("2026-08-01T00:00:00.000Z"),
          lt: new Date("2026-08-18T00:00:00.000Z"),
        },
      },
      _sum: { durationMinutes: true },
    })
    expect(prismaMocks.aggregate).toHaveBeenNthCalledWith(2, {
      where: {
        executant: LMS_CRM_EMPLOYEE_NAME,
        taskDate: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lt: new Date("2026-08-18T00:00:00.000Z"),
        },
      },
      _sum: { durationMinutes: true },
    })
    expect(prismaMocks.findFirst).toHaveBeenCalledWith({
      where: {
        executant: LMS_CRM_EMPLOYEE_NAME,
        taskDate: { lt: new Date("2026-08-18T00:00:00.000Z") },
      },
      orderBy: { taskDate: "desc" },
      select: { taskDate: true },
    })
  })
})
