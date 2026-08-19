export const TASK_STATUS_VALUES = ["Active", "Pending", "Completed"] as const
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number]
export const TASK_URGENCY_VALUES = ["Normal", "Idea", "Urgent"] as const
export type TaskUrgency = (typeof TASK_URGENCY_VALUES)[number]

export const PROJECT_STATUS_VALUES = ["Active", "Paused", "Completed", "Closed"] as const
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number]

export type LegacyProjectStatus = ProjectStatus | "Paused"
export type LegacyTaskStatus = TaskStatus | "Paused" | "Done"

export function normalizeProjectStatus(status: string | null | undefined): ProjectStatus {
    if (status === "Paused") return "Paused"
    if (status === "Completed") return "Completed"
    if (status === "Closed") return "Closed"
    return "Active"
}

export function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
    if (status === "Completed" || status === "Done") return "Completed"
    if (status === "Pending" || status === "Paused") return "Pending"
    return "Active"
}

export function normalizeTaskUrgency(urgency: string | null | undefined): TaskUrgency {
    const value = (urgency || "").toLowerCase()
    if (value === "urgent" || value === "high") return "Urgent"
    if (value === "idea" || value === "low") return "Idea"
    return "Normal"
}

export function projectStatusSortOrder(status: string | null | undefined): number {
    const normalized = normalizeProjectStatus(status)
    if (normalized === "Active") return 0
    if (normalized === "Paused") return 1
    if (normalized === "Completed") return 2
    return 3
}

export function taskStatusSortOrder(status: string | null | undefined): number {
    const normalized = normalizeTaskStatus(status)
    if (normalized === "Active") return 0
    if (normalized === "Pending") return 1
    return 2
}
