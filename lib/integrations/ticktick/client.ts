/**
 * TickTick Open API Client
 * Official REST endpoints: https://api.ticktick.com/open/v1
 */

export interface TickTickProject {
    id: string
    name: string
    color?: string
    closed?: boolean
    groupId?: string
    viewMode?: string
    kind?: string
}

export interface TickTickTask {
    id: string
    projectId: string
    title: string
    content?: string
    desc?: string
    status: number // 0 = Normal/Active, 2 = Completed
    completedTime?: string
    dueDate?: string
    isAllDay?: boolean
    timeZone?: string
    tags?: string[]
    priority?: number
}

export interface TickTickProjectData {
    project: TickTickProject
    tasks: TickTickTask[]
    columns?: Array<{ id: string; projectId: string; name: string }>
}

export interface CreateTickTickTaskPayload {
    title: string
    projectId: string
    content?: string
    dueDate?: string
    isAllDay?: boolean
    timeZone?: string
    priority?: number
}

export class TickTickApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code?: string,
        public isAuthError: boolean = false
    ) {
        super(message)
        this.name = "TickTickApiError"
    }
}

const TICKTICK_API_BASE_URL = "https://api.ticktick.com/open/v1"

async function tickTickFetch<T>(
    endpoint: string,
    accessToken: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${TICKTICK_API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
    const headers = new Headers(options.headers || {})
    headers.set("Authorization", `Bearer ${accessToken}`)
    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }

    const response = await fetch(url, {
        ...options,
        headers,
    })

    if (response.status === 401) {
        throw new TickTickApiError("TickTick access token is invalid or expired", 401, "UNAUTHORIZED", true)
    }

    if (!response.ok) {
        let errorMessage = `TickTick API returned error HTTP ${response.status}`
        try {
            const body = await response.json()
            if (body && typeof body === "object") {
                if ("errorMessage" in body && typeof body.errorMessage === "string") {
                    errorMessage = body.errorMessage
                } else if ("error" in body && typeof body.error === "string") {
                    errorMessage = body.error
                }
            }
        } catch {
            // Ignore json parse error for non-json responses
        }
        throw new TickTickApiError(errorMessage, response.status)
    }

    // Handle 204 or empty responses
    if (response.status === 204) {
        return null as T
    }

    const text = await response.text()
    if (!text || text.trim() === "") {
        return null as T
    }

    try {
        return JSON.parse(text) as T
    } catch {
        return text as unknown as T
    }
}

/**
 * Get all project lists for the authenticated user
 */
export async function getTickTickProjects(accessToken: string): Promise<TickTickProject[]> {
    const data = await tickTickFetch<TickTickProject[]>("/project", accessToken, {
        method: "GET",
    })
    return Array.isArray(data) ? data : []
}

/**
 * Create a new project list in TickTick (e.g. "Pixelist")
 */
export async function createTickTickProject(
    accessToken: string,
    name: string,
    color?: string
): Promise<TickTickProject> {
    return tickTickFetch<TickTickProject>("/project", accessToken, {
        method: "POST",
        body: JSON.stringify({
            name,
            color: color || "#6366f1",
        }),
    })
}

/**
 * Get project data including all tasks (open and completed) in the project
 */
export async function getTickTickProjectData(
    accessToken: string,
    projectId: string
): Promise<TickTickProjectData> {
    return tickTickFetch<TickTickProjectData>(`/project/${encodeURIComponent(projectId)}/data`, accessToken, {
        method: "GET",
    })
}

/**
 * Create a task in TickTick
 */
export async function createTickTickTask(
    accessToken: string,
    payload: CreateTickTickTaskPayload
): Promise<TickTickTask> {
    return tickTickFetch<TickTickTask>("/task", accessToken, {
        method: "POST",
        body: JSON.stringify(payload),
    })
}

/**
 * Mark a task as completed in TickTick
 */
export async function completeTickTickTask(
    accessToken: string,
    projectId: string,
    taskId: string
): Promise<boolean> {
    await tickTickFetch<unknown>(
        `/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`,
        accessToken,
        {
            method: "POST",
        }
    )
    return true
}

/**
 * Get single task details from TickTick
 */
export async function getTickTickTask(
    accessToken: string,
    projectId: string,
    taskId: string
): Promise<TickTickTask | null> {
    try {
        return await tickTickFetch<TickTickTask>(
            `/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`,
            accessToken,
            {
                method: "GET",
            }
        )
    } catch (err) {
        if (err instanceof TickTickApiError && err.status === 404) {
            return null
        }
        throw err
    }
}
