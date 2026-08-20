import { Prisma } from "@prisma/client"
import { normalizeTaskUrgency, type TaskUrgency } from "../status"

const TASK_STATUS_FILTER_VALUES = ["All", "Active", "Pending", "Completed"] as const
const TASK_SCOPE_FILTER_VALUES = ["ALL", "FREELANCE", "LMS"] as const

export type TaskStatusFilter = (typeof TASK_STATUS_FILTER_VALUES)[number]
export type TaskScopeFilter = (typeof TASK_SCOPE_FILTER_VALUES)[number]
export type TaskUrgencyFilter = "all" | "High" | "Medium" | "Low" | TaskUrgency

export type TaskFiltersInput = {
    q?: string | null
    status?: string | null
    partnerId?: string | null
    projectId?: string | null
    taskId?: string | null
    urgency?: string | null
    overdue?: string | null
    dueToday?: string | null
    scope?: string | null
}

export type NormalizedTaskFilters = {
    q?: string
    status: TaskStatusFilter
    partnerId?: string
    projectId?: string
    taskId?: string
    urgency: TaskUrgencyFilter
    overdueOnly: boolean
    dueTodayOnly: boolean
    scope: TaskScopeFilter
}

export type DayBounds = {
    todayStart: Date
    todayEnd: Date
}

function normalizeOptionalText(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : undefined
}

function parseBooleanParam(value: string | null | undefined) {
    return value === "1" || value === "true"
}

export function getLocalDayBounds(now = new Date()): DayBounds {
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    return { todayStart, todayEnd }
}

export function normalizeTaskFilters(input: TaskFiltersInput): NormalizedTaskFilters {
    const q = normalizeOptionalText(input.q)
    const rawStatus = input.status?.trim()
    const normalizedStatusInput = rawStatus === "Paused" || rawStatus === "Pending"
        ? "Pending"
        : rawStatus === "Done" || rawStatus === "Completed"
            ? "Completed"
            : rawStatus
    const status = (TASK_STATUS_FILTER_VALUES as readonly string[]).includes(normalizedStatusInput || "")
        ? (normalizedStatusInput as TaskStatusFilter)
        : "Active"

    const urgencyInput = normalizeOptionalText(input.urgency)
    const urgency: TaskUrgencyFilter = !urgencyInput || urgencyInput === "all" ? "all" : normalizeTaskUrgency(urgencyInput)
    const dueTodayOnly = parseBooleanParam(input.dueToday)
    const overdueOnly = parseBooleanParam(input.overdue) && !dueTodayOnly

    const projectId = normalizeOptionalText(input.projectId)
    const partnerId = normalizeOptionalText(input.partnerId)
    const taskId = normalizeOptionalText(input.taskId)
    const normalizedScope = normalizeOptionalText(input.scope)?.toUpperCase()
    const scope = (TASK_SCOPE_FILTER_VALUES as readonly string[]).includes(normalizedScope || "")
        ? (normalizedScope as TaskScopeFilter)
        : "ALL"

    return {
        q,
        status,
        taskId: taskId && taskId !== "all" ? taskId : undefined,
        projectId: projectId && projectId !== "all" ? projectId : undefined,
        partnerId: partnerId && partnerId !== "all" ? partnerId : undefined,
        urgency,
        overdueOnly,
        dueTodayOnly,
        scope,
    }
}

export function buildTaskWhereInput(input: {
    filters: NormalizedTaskFilters
    todayStart: Date
    todayEnd: Date
}): Prisma.TaskWhereInput {
    const { filters, todayStart, todayEnd } = input
    const where: Prisma.TaskWhereInput = {}

    if (filters.status !== "All") {
        if (filters.status === "Active") {
            where.status = "Active"
        } else if (filters.status === "Pending") {
            where.status = { in: ["Pending", "Paused"] }
        } else if (filters.status === "Completed") {
            where.status = { in: ["Completed", "Done"] }
        }
    }

    if (filters.scope !== "ALL") {
        where.taskScope = filters.scope
    }

    if (filters.taskId) {
        where.id = filters.taskId
    } else if (filters.projectId) {
        where.projectId = filters.projectId
    } else if (filters.partnerId) {
        where.project = { site: { partnerId: filters.partnerId } }
    }

    if (filters.urgency !== "all") {
        const normalized = normalizeTaskUrgency(filters.urgency)
        where.urgency =
            normalized === "High"
                ? { in: ["High", "Urgent", "urgent", "high"] }
                : normalized === "Low"
                  ? { in: ["Low", "Idea", "idea", "low"] }
                  : { in: ["Medium", "Normal", "normal", "medium"] }
    }

    if (filters.q) {
        where.OR = [
            { name: { contains: filters.q } },
            { description: { contains: filters.q } },
            { project: { name: { contains: filters.q } } },
            { project: { site: { domainName: { contains: filters.q } } } },
            { project: { site: { partner: { name: { contains: filters.q } } } } },
            { lmsAllocation: { client: { contains: filters.q } } },
            { lmsTaskType: { name: { contains: filters.q } } },
        ]
    }

    if (filters.overdueOnly) {
        where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
            { status: { in: ["Active", "Paused"] } },
            { deadline: { not: null, lt: todayStart } },
        ]
    }

    if (filters.dueTodayOnly) {
        where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
            { status: { in: ["Active", "Paused"] } },
            { deadline: { not: null, gte: todayStart, lte: todayEnd } },
        ]
    }

    return where
}
