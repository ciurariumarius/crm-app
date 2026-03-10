export const TASK_STATUS_VALUES = ["Active", "Completed"] as const
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number]

export const PROJECT_STATUS_VALUES = ["Active", "Completed", "Closed"] as const
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number]

export type LegacyProjectStatus = ProjectStatus | "Paused"
export type LegacyTaskStatus = TaskStatus | "Paused"

export function normalizeProjectStatus(status: string | null | undefined): ProjectStatus {
    if (status === "Completed") return "Completed"
    if (status === "Closed" || status === "Paused") return "Closed"
    return "Active"
}

export function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
    if (status === "Completed") return "Completed"
    return "Active"
}

export function projectStatusSortOrder(status: string | null | undefined): number {
    const normalized = normalizeProjectStatus(status)
    if (normalized === "Active") return 0
    if (normalized === "Completed") return 1
    return 2
}

export function taskStatusSortOrder(status: string | null | undefined): number {
    return normalizeTaskStatus(status) === "Active" ? 0 : 1
}
