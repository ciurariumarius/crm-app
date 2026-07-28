"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { resolveLmsDatePreset } from "@/lib/lms-tasks/date-presets"
import type {
  ClientAllocation,
  LmsDataAggregates,
  LmsModuleData,
  LmsSyncMode,
  LmsSyncSummary,
  TaskLog,
} from "@/lib/lms-tasks/types"

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
  aggregates: LmsDataAggregates | null
  loadedRange: { from: string | null; to: string | null }
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
  rows?: TaskLog[]
  allocations?: ClientAllocation[]
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  aggregates?: LmsDataAggregates
  lastUpdatedAt?: string | null
  tasksSourceFile?: string | null
  allocationsSourceFile?: string | null
  error?: string
}

type ImportResponse = {
  success: boolean
  summary?: LmsSyncSummary
  error?: string
}

type AllocationsResponse = {
  success: boolean
  rows?: ClientAllocation[]
  totalPages?: number
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
  const searchParams = useSearchParams()
  const [ready, setReady] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<LmsModuleData>(DEFAULT_DATA)
  const [aggregates, setAggregates] = React.useState<LmsDataAggregates | null>(null)
  const explicitFrom = searchParams.get("from")
  const explicitTo = searchParams.get("to")
  const period = searchParams.get("period")
  const loadedRange = React.useMemo(() => {
    if (explicitFrom || explicitTo) {
      return { from: explicitFrom, to: explicitTo }
    }
    if (period === "all") {
      return { from: null, to: null }
    }
    const preset = resolveLmsDatePreset(period || "this-quarter")
    return { from: preset.from, to: preset.to }
  }, [explicitFrom, explicitTo, period])

  const refreshFromDatabase = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows: TaskLog[] = []
      const allocations: ClientAllocation[] = []
      let firstPayload: DataResponse | null = null
      let page = 1
      let totalPages = 1

      do {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "500",
          includeAllocations: "0",
        })
        if (loadedRange.from) params.set("from", loadedRange.from)
        if (loadedRange.to) params.set("to", loadedRange.to)

        const response = await fetch(`/api/lms-tasks/data?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        })
        const payload = await readJsonSafe<DataResponse>(response)
        if (!response.ok || !payload?.success || !payload.rows) {
          throw new Error(payload?.error || "Failed to load LMS data")
        }
        if (!firstPayload) {
          firstPayload = payload
          totalPages = Math.min(Math.max(1, payload.totalPages || 1), 100)
        }
        rows.push(...payload.rows)
        page += 1
      } while (page <= totalPages)

      if (!firstPayload) {
        throw new Error("Failed to load LMS data")
      }

      let allocationPage = 1
      let allocationTotalPages = 1
      do {
        const response = await fetch(
          `/api/lms-tasks/allocations?page=${allocationPage}&pageSize=250`,
          { cache: "no-store" }
        )
        const payload = await readJsonSafe<AllocationsResponse>(response)
        if (!response.ok || !payload?.success || !payload.rows) {
          throw new Error(payload?.error || "Failed to load LMS allocations")
        }
        allocations.push(...payload.rows)
        allocationTotalPages = Math.min(Math.max(1, payload.totalPages || 1), 100)
        allocationPage += 1
      } while (allocationPage <= allocationTotalPages)

      setAggregates(firstPayload.aggregates || null)
      setData({
        tasks: rows,
        allocations,
        lastUpdatedAt: firstPayload.lastUpdatedAt || null,
        tasksSourceFile: firstPayload.tasksSourceFile || null,
        allocationsSourceFile: firstPayload.allocationsSourceFile || null,
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load LMS data")
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [loadedRange.from, loadedRange.to])

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
        if (!response.ok || !payload?.success || !payload.summary) {
          throw new Error(payload?.error || "Failed to sync task records")
        }

        await refreshFromDatabase()
        if (options?.sourceFileName) {
          setData((current) => ({ ...current, tasksSourceFile: options.sourceFileName || null }))
        }
        return payload.summary
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to sync task records")
        throw nextError
      } finally {
        setLoading(false)
      }
    },
    [refreshFromDatabase]
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
        if (!response.ok || !payload?.success || !payload.summary) {
          throw new Error(payload?.error || "Failed to sync allocation records")
        }

        await refreshFromDatabase()
        if (options?.sourceFileName) {
          setData((current) => ({ ...current, allocationsSourceFile: options.sourceFileName || null }))
        }
        return payload.summary
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Failed to sync allocation records")
        throw nextError
      } finally {
        setLoading(false)
      }
    },
    [refreshFromDatabase]
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
      aggregates,
      loadedRange,
      refreshFromDatabase,
      syncTasksToDatabase,
      syncAllocationsToDatabase,
      clearAllData,
    }),
    [ready, loading, error, data, aggregates, loadedRange, refreshFromDatabase, syncTasksToDatabase, syncAllocationsToDatabase, clearAllData]
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
