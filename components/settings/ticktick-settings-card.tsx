"use client"

import * as React from "react"
import { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import {
    getTickTickStatus,
    getTickTickProjectList,
    setTickTickProject,
    createAndSetPixelistProject,
    syncTickTickNow,
    exportActiveTasksToTickTick,
    disconnectTickTickIntegration,
    type TickTickIntegrationStatus,
} from "@/lib/actions/integrations"
import { type TickTickProject } from "@/lib/integrations/ticktick/client"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    RefreshCw,
    ExternalLink,
    AlertCircle,
    Plus,
    Unlink,
    Check,
    Smartphone,
    Clock,
    FolderKanban,
    UploadCloud,
} from "lucide-react"
import { cn, formatRelativeDate } from "@/lib/utils"

export function TickTickSettingsCard({ initialStatus }: { initialStatus?: TickTickIntegrationStatus }) {
    const [status, setStatus] = useState<TickTickIntegrationStatus | null>(initialStatus || null)
    const [projects, setProjects] = useState<TickTickProject[]>([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [isSyncing, setIsSyncing] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const fetchStatus = React.useCallback(async () => {
        try {
            const current = await getTickTickStatus()
            setStatus(current)
            return current
        } catch {
            return null
        }
    }, [])

    useEffect(() => {
        if (!initialStatus) {
            void fetchStatus()
        }
    }, [fetchStatus, initialStatus])

    // Load available lists if connected
    const loadProjects = React.useCallback(async () => {
        setLoadingProjects(true)
        try {
            const res = await getTickTickProjectList()
            if (res.success && res.projects) {
                setProjects(res.projects)
            } else if (res.error) {
                toast.error(res.error)
            }
        } catch {
            toast.error("Failed to load TickTick lists")
        } finally {
            setLoadingProjects(false)
        }
    }, [])

    useEffect(() => {
        if (status?.isConnected && status.enabled) {
            void loadProjects()
        }
    }, [status?.isConnected, status?.enabled, loadProjects])

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const res = await syncTickTickNow()
            if (res.success) {
                const total = (res.importedCount || 0) + (res.completedInPixelistCount || 0) + (res.pushedToTickTickCount || 0) + (res.completedInTickTickCount || 0)
                if (total > 0) {
                    toast.success(`Sync finished: ${res.importedCount} imported, ${res.completedInPixelistCount} completed in Pixelist, ${res.pushedToTickTickCount} pushed`)
                } else {
                    toast.success("Sync completed. Everything is up to date!")
                }
                void fetchStatus()
            } else {
                toast.error(res.error || "Sync failed")
            }
        } catch {
            toast.error("Failed to execute sync")
        } finally {
            setIsSyncing(false)
        }
    }

    const handleExportActiveTasks = async () => {
        setIsExporting(true)
        try {
            const res = await exportActiveTasksToTickTick()
            if (res.success) {
                if (res.pushedCount > 0) {
                    toast.success(`Pushed ${res.pushedCount} active tasks to TickTick!`)
                } else {
                    toast.info("All active tasks are already synced to TickTick.")
                }
                void fetchStatus()
            } else {
                toast.error(res.error || "Failed to push tasks to TickTick")
            }
        } catch {
            toast.error("Failed to push tasks to TickTick")
        } finally {
            setIsExporting(false)
        }
    }

    const handleProjectChange = async (projectId: string) => {
        const found = projects.find((p) => p.id === projectId)
        const projectName = found?.name || "Pixelist"
        startTransition(async () => {
            const res = await setTickTickProject(projectId, projectName)
            if (res.success) {
                toast.success(`Synced list set to "${projectName}"`)
                await fetchStatus()
            } else {
                toast.error(res.error || "Failed to update list")
            }
        })
    }

    const handleCreatePixelistList = async () => {
        startTransition(async () => {
            const res = await createAndSetPixelistProject()
            if (res.success && res.project) {
                toast.success(`Created and selected "${res.project.name}" list in TickTick!`)
                await fetchStatus()
                await loadProjects()
            } else {
                toast.error(res.error || "Failed to create list")
            }
        })
    }

    const handleDisconnect = async () => {
        if (!window.confirm("Disconnect TickTick integration? Your Pixelist tasks will remain safe.")) return
        startTransition(async () => {
            const res = await disconnectTickTickIntegration()
            if (res.success) {
                toast.success("TickTick disconnected")
                await fetchStatus()
            } else {
                toast.error("error" in res && res.error ? res.error : "Failed to disconnect")
            }
        })
    }

    if (!status) {
        return (
            <div className="rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-6 shadow-[var(--shadow-apple)] animate-pulse h-48" />
        )
    }

    const isConnected = status.isConnected && status.enabled
    const hasError = Boolean(status.lastError)
    const needsReconnect = hasError && status.lastError?.toLowerCase().includes("reconnect")

    return (
        <div className="rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-6 shadow-[var(--shadow-apple)] space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,#6366f1_14%,transparent)] text-[#6366f1] dark:bg-[color:color-mix(in_srgb,#818cf8_18%,transparent)] dark:text-[#818cf8]">
                        <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">TickTick Integration</h2>
                            {isConnected && !needsReconnect ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--state-success-surface)] text-[var(--state-success)] border border-[color:color-mix(in_srgb,var(--state-success)_28%,var(--line-subtle))]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--state-success)] animate-pulse" />
                                    Connected
                                </span>
                            ) : needsReconnect ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--state-warning-surface)] text-[var(--state-warning)] border border-[color:color-mix(in_srgb,var(--state-warning)_28%,var(--line-subtle))]">
                                    <AlertCircle className="h-3 w-3" />
                                    Needs Reconnect
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                                    Not connected
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Use TickTick on your phone as a fast mobile interface for Pixelist tasks.
                        </p>
                    </div>
                </div>

                {isConnected && (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSyncing || isExporting || isPending}
                            onClick={handleSync}
                            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-[var(--line-subtle)] hover:bg-[var(--surface-low)]"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-primary")} />
                            {isSyncing ? "Syncing..." : "Sync now"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSyncing || isExporting || isPending}
                            onClick={handleExportActiveTasks}
                            title="Push all existing active tasks from Pixelist into TickTick"
                            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer border-[var(--line-subtle)] hover:bg-[var(--surface-low)]"
                        >
                            <UploadCloud className={cn("h-3.5 w-3.5", isExporting && "animate-pulse text-primary")} />
                            {isExporting ? "Pushing..." : "Push active tasks"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending || isSyncing || isExporting}
                            onClick={handleDisconnect}
                            className="h-8 gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        >
                            <Unlink className="h-3.5 w-3.5" />
                            Disconnect
                        </Button>
                    </div>
                )}
            </div>

            {/* Error banner if any */}
            {hasError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1">
                        <p className="font-semibold">{status.lastError}</p>
                        {needsReconnect && (
                            <p className="mt-1 text-xs opacity-90">
                                Click Reconnect below to renew access permissions.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Not connected view */}
            {!isConnected && (
                <div className="rounded-xl border border-dashed border-[var(--line-subtle)] bg-[var(--surface-low)]/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {needsReconnect ? "Reconnect your TickTick account" : "Connect your TickTick account"}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md">
                            Syncs tasks bidirectionally with a dedicated TickTick list. Quick-add on mobile, view tasks, and mark them completed instantly.
                        </p>
                    </div>

                    {status.isConfigured ? (
                        <Button
                            asChild
                            className="shrink-0 gap-2 font-semibold bg-[#6366f1] hover:bg-[#4f46e5] text-white shadow-sm"
                        >
                            <a href="/api/integrations/ticktick/authorize">
                                <ExternalLink className="h-4 w-4" />
                                {needsReconnect ? "Reconnect TickTick" : "Connect TickTick"}
                            </a>
                        </Button>
                    ) : (
                        <div className="text-right">
                            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 inline-block">
                                TICKTICK_CLIENT_ID missing in .env
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Connected view: Configured list & Metrics */}
            {isConnected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* List Selector Card */}
                    <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)]/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-1.5">
                                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                                Synced TickTick List
                            </label>
                            {status.externalProjectId && (
                                <span className="text-xs font-semibold text-[var(--state-success)] flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Active
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Select
                                value={status.externalProjectId || ""}
                                onValueChange={handleProjectChange}
                                disabled={loadingProjects || isPending}
                            >
                                <SelectTrigger className="h-9 text-xs font-semibold bg-[var(--surface-lowest)] border-[var(--line-subtle)]">
                                    <SelectValue placeholder={loadingProjects ? "Loading lists..." : "Select list to sync"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCreatePixelistList}
                                disabled={isPending}
                                title="Create new 'Pixelist' list in TickTick"
                                className="h-9 shrink-0 gap-1 text-xs font-semibold border-[var(--line-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)]"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New list
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Only tasks inside this specific list will be synchronized.
                        </p>
                    </div>

                    {/* Sync Info Card */}
                    <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-low)]/50 p-4 space-y-3">
                        <label className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            Sync Status
                        </label>

                        <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Last sync:</span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                    {status.lastSyncAt ? formatRelativeDate(status.lastSyncAt) : "Never"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Automatic schedule:</span>
                                <span className="font-semibold text-[var(--text-primary)]">Every 2–5 min</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">App-open trigger:</span>
                                <span className="font-semibold text-[var(--state-success)]">Enabled</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
