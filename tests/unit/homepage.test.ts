import { describe, expect, it } from "vitest"
import {
    HOME_OPEN_TASK_LIMIT,
    HOME_OPEN_TASK_SELECT,
    buildHomeBucharestMonthRange,
    buildHomeBilledRevenueWhere,
    buildHomeLmsAnalysisHref,
    buildHomeOpenTasksQuery,
    buildHomeUnpaidWhere,
    completeHomeOpenTaskState,
    createHomeOpenTaskState,
    formatHomeOpenTaskResultLabel,
} from "@/lib/homepage"

describe("homepage data definitions", () => {
    it("loads the six oldest active-compatible tasks", () => {
        expect(buildHomeOpenTasksQuery()).toEqual({
            where: { status: { in: ["Active", "Paused"] } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: HOME_OPEN_TASK_LIMIT,
            select: HOME_OPEN_TASK_SELECT,
        })
        expect(HOME_OPEN_TASK_LIMIT).toBe(6)
        expect(HOME_OPEN_TASK_SELECT).not.toHaveProperty("urgency")
        expect(HOME_OPEN_TASK_SELECT).not.toHaveProperty("deadline")
        expect(HOME_OPEN_TASK_SELECT).not.toHaveProperty("timeLogs")
        expect(HOME_OPEN_TASK_SELECT.project.select).not.toHaveProperty("tasks")
    })

    it("defines revenue as all projects created in the billing month", () => {
        const gte = new Date("2026-08-01T00:00:00.000Z")
        const lt = new Date("2026-09-01T00:00:00.000Z")

        expect(buildHomeBilledRevenueWhere({ gte, lt })).toEqual({
            createdAt: { gte, lt },
        })
    })

    it("uses Bucharest midnight for winter and summer billing months", () => {
        expect(buildHomeBucharestMonthRange("2026-01-17")).toEqual({
            gte: new Date("2025-12-31T22:00:00.000Z"),
            lt: new Date("2026-01-31T22:00:00.000Z"),
        })
        expect(buildHomeBucharestMonthRange("2026-08-17")).toEqual({
            gte: new Date("2026-07-31T21:00:00.000Z"),
            lt: new Date("2026-08-31T21:00:00.000Z"),
        })
        expect(() => buildHomeBucharestMonthRange("2026-02-30")).toThrow(
            "Expected a valid Bucharest date"
        )
    })

    it("defines unpaid independently of project age or status", () => {
        expect(buildHomeUnpaidWhere()).toEqual({ paymentStatus: "Unpaid" })
    })

    it("links LMS cards to the exact period-to-date range and employee", () => {
        expect(buildHomeLmsAnalysisHref({
            period: "this-quarter",
            employeeName: "Marius Ciurariu",
            from: "2026-07-01",
            to: "2026-08-17",
        })).toBe(
            "/lms-analysis/tasks?period=this-quarter&employee=Marius+Ciurariu&from=2026-07-01&to=2026-08-17"
        )
    })
})

describe("homepage open-task summary", () => {
    it("describes zero, one, capped and overflowing task states", () => {
        expect(formatHomeOpenTaskResultLabel(0, 0)).toBe("0 open tasks")
        expect(formatHomeOpenTaskResultLabel(1, 1)).toBe("1 open task")
        expect(formatHomeOpenTaskResultLabel(6, 6)).toBe("6 open tasks")
        expect(formatHomeOpenTaskResultLabel(6, 8)).toBe("6 of 8 open tasks")
    })

    it("removes a completed task immediately and decrements the open count", () => {
        const initial = createHomeOpenTaskState(
            [{ id: "oldest" }, { id: "next" }],
            8
        )

        expect(completeHomeOpenTaskState(initial, "oldest")).toEqual({
            tasks: [{ id: "next" }],
            totalOpenTasks: 7,
        })
        expect(completeHomeOpenTaskState(initial, "missing")).toBe(initial)
    })
})
