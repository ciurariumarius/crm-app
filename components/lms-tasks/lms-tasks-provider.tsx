"use client"

import * as React from "react"
import type { ClientAllocation, LmsModuleData, LmsSyncMode, LmsSyncSummary, TaskLog } from "@/lib/lms-tasks/types"

const DEFAULT_DATA: LmsModuleData = {
  tasks: [],
  allocations: [],
  lastUpdatedAt: null,
  tasksSourceFile: null,
  allocationsSourceFile: null,
}

type LmsTasksContextValue = {
  ready: boolean
  loading: boolean
  error: string | null
  data: LmsModuleData
  refreshFromDatabase: () => Promise<void>
  syncTasksToDatabase: (
    tasks: TaskLog[],
    options?: { syncMode?: LmsSyncMode; sourceFileName?: string }
  ) => Promise<LmsSyncSummary>
  syncAllocationsToDatabase: (
    allocations: ClientAllocation[],
    options?: { syncMode?: LmsSyncMode; sourceFileName?: string }
  ) => Promise<LmsSyncSummary>
  clearAllData: () => Promise<void>
}

const LmsTasksContext = React.createContext<LmsTasksContextValue | null>(null)

type DataResponse = {
  success: boolean
  data?: LmsModuleData
  error?: string
}

type ImportResponse = {
  success: boolean
  summary?: LmsSyncSummary
  data?: LmsModuleData
  error?: string
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export function LmsTasksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<LmsModuleData>(DEFAULT_DATA)

  const refreshFromDatabase = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/lms-tasks/data", {
        method: "GET",
        cache: "no-store",
      })
      const payload = await readJsonSafe<DataResponse>(response)
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.error || "Failed to load LMS data")
      }
      setData(payload.data)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load LMS data")
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [])

  const syncTasksToDatabase = React.useCallback(
    async (tasks: TaskLog[], options?: { syncMode?: LmsSyncMode; sourceFileName?: string }) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/lms-tasks/import/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: tasks,
            syncMode: options?.syncMode || "merge",
          }),
        })
        const payload = await readJsonSafe<ImportResponse>(response)
        if (!response.ok || !payload?.success || !payload.summary || !payload.data) {
          throw new Error(payload?.error || "Failed to sync task records")
        }

        setData({
          ...payload.data,
          tasksSourceFile: options?.sourceFileName || payload.data.tasksSourceFile,
        })
        return payload.summary
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to sync task records")
        throw nextError
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const syncAllocationsToDatabase = React.useCallback(
    async (allocations: ClientAllocation[], options?: { syncMode?: LmsSyncMode; sourceFileName?: string }) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/lms-tasks/import/allocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: allocations,
            syncMode: options?.syncMode || "merge",
          }),
        })
        const payload = await readJsonSafe<ImportResponse>(response)
        if (!response.ok || !payload?.success || !payload.summary || !payload.data) {
          throw new Error(payload?.error || "Failed to sync allocation records")
        }

        setData({
          ...payload.data,
          allocationsSourceFile: options?.sourceFileName || payload.data.allocationsSourceFile,
        })
        return payload.summary
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to sync allocation records")
        throw nextError
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const clearAllData = React.useCallback(async () => {
    await syncTasksToDatabase([], { syncMode: "replace" })
    await syncAllocationsToDatabase([], { syncMode: "replace" })
  }, [syncAllocationsToDatabase, syncTasksToDatabase])

  React.useEffect(() => {
    void refreshFromDatabase()
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [refreshFromDatabase])

  const value = React.useMemo<LmsTasksContextValue>(
    () => ({
      ready,
      loading,
      error,
      data,
      refreshFromDatabase,
      syncTasksToDatabase,
      syncAllocationsToDatabase,
      clearAllData,
    }),
    [ready, loading, error, data, refreshFromDatabase, syncTasksToDatabase, syncAllocationsToDatabase, clearAllData]
  )

  return <LmsTasksContext.Provider value={value}>{children}</LmsTasksContext.Provider>
}

export function useLmsTasksData() {
  const context = React.useContext(LmsTasksContext)
  if (!context) {
    throw new Error("useLmsTasksData must be used inside LmsTasksProvider.")
  }
  return context
}
