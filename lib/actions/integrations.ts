"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"
import {
    getTickTickIntegrationRecord,
    getTickTickAccessToken,
    getTickTickAuthUrl,
    disconnectTickTick,
    updateTickTickSyncedProject,
    isTickTickOAuthConfigured,
} from "@/lib/integrations/ticktick/auth"
import {
    getTickTickProjects,
    createTickTickProject,
    type TickTickProject,
} from "@/lib/integrations/ticktick/client"
import { syncTickTick, type SyncResult } from "@/lib/integrations/ticktick/sync"
import { logger } from "@/lib/logger"

export interface TickTickIntegrationStatus {
    isConfigured: boolean
    isConnected: boolean
    enabled: boolean
    externalProjectId: string | null
    externalProjectName: string | null
    lastSyncAt: string | null
    lastSuccessfulSyncAt: string | null
    lastError: string | null
    authUrl: string | null
}

export async function getTickTickStatus(): Promise<TickTickIntegrationStatus> {
    try {
        const session = await getSession()
        const isConfigured = isTickTickOAuthConfigured()
        const integration = await getTickTickIntegrationRecord()

        const isConnected = Boolean(integration && integration.enabled && integration.accessTokenEncrypted)
        let authUrl: string | null = null

        if (session?.userId && isConfigured && (!isConnected || integration?.lastError?.includes("Needs reconnect"))) {
            try {
                authUrl = getTickTickAuthUrl(session.userId)
            } catch {
                authUrl = null
            }
        }

        return {
            isConfigured,
            isConnected,
            enabled: Boolean(integration?.enabled),
            externalProjectId: integration?.externalProjectId || null,
            externalProjectName: integration?.externalProjectName || null,
            lastSyncAt: integration?.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
            lastSuccessfulSyncAt: integration?.lastSuccessfulSyncAt ? integration.lastSuccessfulSyncAt.toISOString() : null,
            lastError: integration?.lastError || null,
            authUrl,
        }
    } catch {
        return {
            isConfigured: isTickTickOAuthConfigured(),
            isConnected: false,
            enabled: false,
            externalProjectId: null,
            externalProjectName: null,
            lastSyncAt: null,
            lastSuccessfulSyncAt: null,
            lastError: null,
            authUrl: null,
        }
    }
}

export async function getTickTickProjectList(): Promise<{ success: boolean; projects?: TickTickProject[]; error?: string }> {
    const session = await getSession()
    if (!session?.userId) {
        return { success: false, error: "Unauthorized" }
    }
    const token = await getTickTickAccessToken()
    if (!token) {
        return { success: false, error: "Not connected to TickTick" }
    }

    try {
        const projects = await getTickTickProjects(token)
        return { success: true, projects }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch TickTick lists"
        return { success: false, error: message }
    }
}

export async function setTickTickProject(projectId: string, projectName?: string) {
    const session = await getSession()
    if (!session?.userId) {
        return { success: false, error: "Unauthorized" }
    }
    try {
        await updateTickTickSyncedProject(projectId, projectName)
        revalidatePath("/settings")
        return { success: true }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to set synced list"
        return { success: false, error: message }
    }
}

export async function createAndSetPixelistProject() {
    const session = await getSession()
    if (!session?.userId) {
        return { success: false, error: "Unauthorized" }
    }
    const token = await getTickTickAccessToken()
    if (!token) {
        return { success: false, error: "Not connected to TickTick" }
    }

    try {
        const newProject = await createTickTickProject(token, "Pixelist", "#6366f1")
        await updateTickTickSyncedProject(newProject.id, newProject.name)
        revalidatePath("/settings")
        return { success: true, project: newProject }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create Pixelist list in TickTick"
        return { success: false, error: message }
    }
}

export async function syncTickTickNow(): Promise<SyncResult> {
    const session = await getSession()
    if (!session?.userId) {
        return {
            success: false,
            importedCount: 0,
            completedInPixelistCount: 0,
            pushedToTickTickCount: 0,
            completedInTickTickCount: 0,
            error: "Unauthorized",
        }
    }
    try {
        const result = await syncTickTick({ manual: true })
        revalidatePath("/tasks")
        revalidatePath("/settings")
        return result
    } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed"
        logger.error("[actions-integrations] Manual sync failed", { error: message })
        return {
            success: false,
            importedCount: 0,
            completedInPixelistCount: 0,
            pushedToTickTickCount: 0,
            completedInTickTickCount: 0,
            error: message,
        }
    }
}

export async function exportActiveTasksToTickTick() {
    const session = await getSession()
    if (!session?.userId) {
        return { success: false, pushedCount: 0, error: "Unauthorized" }
    }
    try {
        const { pushAllActiveTasksToTickTick } = await import("@/lib/integrations/ticktick/sync")
        const result = await pushAllActiveTasksToTickTick()
        revalidatePath("/settings")
        revalidatePath("/tasks")
        return result
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to export tasks"
        return { success: false, pushedCount: 0, error: message }
    }
}

export async function disconnectTickTickIntegration() {
    const session = await getSession()
    if (!session?.userId) {
        return { success: false, error: "Unauthorized" }
    }
    try {
        const result = await disconnectTickTick()
        revalidatePath("/settings")
        return result
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to disconnect"
        return { success: false, error: message }
    }
}
