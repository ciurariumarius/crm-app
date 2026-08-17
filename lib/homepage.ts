import type { Prisma } from "@prisma/client"

export const HOME_OPEN_TASK_LIMIT = 6
const BUCHAREST_TIME_ZONE = "Europe/Bucharest"
const BUCHAREST_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: BUCHAREST_TIME_ZONE,
    timeZoneName: "longOffset",
})

function getBucharestOffsetMinutes(value: Date) {
    const offsetLabel = BUCHAREST_OFFSET_FORMATTER
        .formatToParts(value)
        .find((part) => part.type === "timeZoneName")
        ?.value
    const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(offsetLabel || "")
    if (!match) throw new Error("Unable to resolve Europe/Bucharest UTC offset")

    const minutes = Number(match[2]) * 60 + Number(match[3] || 0)
    return match[1] === "-" ? -minutes : minutes
}

function bucharestMidnightUtc(year: number, monthIndex: number, day: number) {
    const utcMidnight = new Date(Date.UTC(year, monthIndex, day))
    return new Date(utcMidnight.getTime() - getBucharestOffsetMinutes(utcMidnight) * 60_000)
}

export function buildHomeBucharestMonthRange(asOf: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf)
    if (!match) throw new Error("Expected a valid Bucharest date in YYYY-MM-DD format")

    const year = Number(match[1])
    const monthIndex = Number(match[2]) - 1
    const day = Number(match[3])
    const parsed = new Date(Date.UTC(year, monthIndex, day))
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== monthIndex ||
        parsed.getUTCDate() !== day
    ) {
        throw new Error("Expected a valid Bucharest date in YYYY-MM-DD format")
    }

    return {
        gte: bucharestMidnightUtc(year, monthIndex, 1),
        lt: bucharestMidnightUtc(year, monthIndex + 1, 1),
    }
}

export const HOME_OPEN_TASK_SELECT = {
    id: true,
    projectId: true,
    taskScope: true,
    lmsAllocationId: true,
    lmsTaskTypeId: true,
    name: true,
    status: true,
    estimatedMinutes: true,
    lmsAllocation: {
        select: { id: true, client: true },
    },
    lmsTaskType: {
        select: { id: true, name: true, defaultDurationMinutes: true },
    },
    project: {
        select: {
            id: true,
            name: true,
            site: { select: { domainName: true } },
        },
    },
} satisfies Prisma.TaskSelect

export type HomeOpenTaskPayload = Prisma.TaskGetPayload<{
    select: typeof HOME_OPEN_TASK_SELECT
}>

export function buildHomeOpenTasksQuery() {
    return {
        where: { status: { in: ["Active", "Paused"] } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: HOME_OPEN_TASK_LIMIT,
        select: HOME_OPEN_TASK_SELECT,
    } satisfies Prisma.TaskFindManyArgs
}

export function buildHomeBilledRevenueWhere(range: { gte: Date; lt: Date }): Prisma.ProjectWhereInput {
    return {
        createdAt: {
            gte: range.gte,
            lt: range.lt,
        },
    }
}

export function buildHomeUnpaidWhere(): Prisma.ProjectWhereInput {
    return { paymentStatus: "Unpaid" }
}

export function buildHomeLmsAnalysisHref(input: {
    period: "this-month" | "this-quarter"
    employeeName: string
    from: string
    to: string
}) {
    const params = new URLSearchParams({
        period: input.period,
        employee: input.employeeName,
        from: input.from,
        to: input.to,
    })
    return `/lms-analysis/tasks?${params.toString()}`
}

export function formatHomeOpenTaskResultLabel(visibleCount: number, totalCount: number) {
    const visible = Math.max(0, Math.trunc(visibleCount))
    const total = Math.max(0, Math.trunc(totalCount))

    if (total > visible) return `${visible} of ${total} open tasks`
    return `${total} open ${total === 1 ? "task" : "tasks"}`
}

export type HomeOpenTaskState<T extends { id: string }> = {
    tasks: T[]
    totalOpenTasks: number
}

export function createHomeOpenTaskState<T extends { id: string }>(
    tasks: T[],
    totalOpenTasks: number
): HomeOpenTaskState<T> {
    return {
        tasks,
        totalOpenTasks: Math.max(tasks.length, Math.max(0, Math.trunc(totalOpenTasks))),
    }
}

export function completeHomeOpenTaskState<T extends { id: string }>(
    state: HomeOpenTaskState<T>,
    completedTaskId: string
): HomeOpenTaskState<T> {
    if (!state.tasks.some((task) => task.id === completedTaskId)) return state
    return {
        tasks: state.tasks.filter((task) => task.id !== completedTaskId),
        totalOpenTasks: Math.max(0, state.totalOpenTasks - 1),
    }
}
