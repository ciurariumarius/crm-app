"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { LmsWorkTaskCatalog } from "@/components/lms-work-entries/lms-work-task-catalog"
import { isLmsMobileOptimizedEnabled } from "@/lib/lms-tasks/feature-flags"
import { parseAllocationsFile, parseTasksFile } from "@/lib/lms-tasks/parsers"
import type { LmsSyncMode, ParseIssue } from "@/lib/lms-tasks/types"
import type { LmsWorkTaskOption } from "@/lib/lms-work-entries/types"
import { cn } from "@/lib/utils"

type ImportLog = {
  id: string
  at: string
  dataset: "Tasks" | "Allocations"
  fileName: string
  syncMode: LmsSyncMode
  status: "Success" | "Failed"
  incoming: number
  created: number
  updated: number
  unchanged: number
  deleted: number
  warningCount: number
  errorCount: number
  message: string
}

const LOGS_STORAGE_KEY = "lms-analysis-import-logs:v1"

function FileDropzone({
  title,
  description,
  file,
  onFileSelected,
}: {
  title: string
  description: string
  file: File | null
  onFileSelected: (file: File | null) => void
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = React.useState(false)

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        onFileSelected(event.dataTransfer.files?.[0] ?? null)
      }}
      className={[
        "rounded-2xl border border-dashed p-4 transition-colors",
        dragging
          ? "border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary-container)_16%,var(--surface-lowest))]"
          : "border-[var(--line-subtle)] bg-[var(--bg-surface)]",
      ].join(" ")}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => inputRef.current?.click()}>
            Choose File
          </Button>
          {file ? <Badge variant="secondary">{file.name}</Badge> : <span className="text-xs text-[var(--text-muted)]">No file selected</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          className="hidden"
          onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  )
}

function IssuesCard({ title, issues }: { title: string; issues: ParseIssue[] }) {
  if (issues.length === 0) return null
  return (
    <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</p>
      <ul className="space-y-1 text-xs">
        {issues.slice(0, 15).map((issue, index) => (
          <li key={`${issue.message}-${index}`} className={issue.level === "error" ? "text-rose-700" : "text-amber-700"}>
            [{issue.level.toUpperCase()}] {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LmsAnalysisDataWorkspace({ workTasks }: { workTasks: LmsWorkTaskOption[] }) {
  const mobileOptimized = isLmsMobileOptimizedEnabled()
  const { ready, loading, error, data, syncTasksToDatabase, syncAllocationsToDatabase, clearAllData } = useLmsTasksData()
  const [syncMode, setSyncMode] = React.useState<LmsSyncMode>("merge")
  const [tasksFile, setTasksFile] = React.useState<File | null>(null)
  const [allocationsFile, setAllocationsFile] = React.useState<File | null>(null)
  const [tasksIssues, setTasksIssues] = React.useState<ParseIssue[]>([])
  const [allocationsIssues, setAllocationsIssues] = React.useState<ParseIssue[]>([])
  const [tasksSummary, setTasksSummary] = React.useState<string | null>(null)
  const [allocationsSummary, setAllocationsSummary] = React.useState<string | null>(null)
  const [importingTasks, setImportingTasks] = React.useState(false)
  const [importingAllocations, setImportingAllocations] = React.useState(false)
  const [logs, setLogs] = React.useState<ImportLog[]>([])
  const [logsHydrated, setLogsHydrated] = React.useState(false)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LOGS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ImportLog[]
        if (Array.isArray(parsed)) setLogs(parsed)
      }
    } catch {
      // Ignore malformed local storage entries.
    } finally {
      setLogsHydrated(true)
    }
  }, [])

  React.useEffect(() => {
    if (!logsHydrated) return
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 200)))
  }, [logs, logsHydrated])

  const appendLog = React.useCallback((entry: ImportLog) => {
    setLogs((current) => [entry, ...current].slice(0, 200))
  }, [])

  const importTasks = React.useCallback(async () => {
    if (!tasksFile) return
    setImportingTasks(true)
    setTasksSummary(null)
    try {
      const parsed = await parseTasksFile(tasksFile)
      setTasksIssues(parsed.issues)
      const warningCount = parsed.issues.filter((issue) => issue.level === "warning").length
      const errorCount = parsed.issues.filter((issue) => issue.level === "error").length
      const summary = await syncTasksToDatabase(parsed.records, {
        syncMode,
        sourceFileName: tasksFile.name,
      })
      const message = `Synced ${parsed.records.length} task rows (${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.deleted} deleted).`
      setTasksSummary(message)
      appendLog({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        dataset: "Tasks",
        fileName: tasksFile.name,
        syncMode,
        status: "Success",
        incoming: parsed.records.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        deleted: summary.deleted,
        warningCount,
        errorCount,
        message,
      })
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Failed to import tasks."
      setTasksSummary(message)
      appendLog({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        dataset: "Tasks",
        fileName: tasksFile.name,
        syncMode,
        status: "Failed",
        incoming: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        deleted: 0,
        warningCount: 0,
        errorCount: 1,
        message,
      })
    } finally {
      setImportingTasks(false)
    }
  }, [appendLog, syncMode, syncTasksToDatabase, tasksFile])

  const importAllocations = React.useCallback(async () => {
    if (!allocationsFile) return
    setImportingAllocations(true)
    setAllocationsSummary(null)
    try {
      const parsed = await parseAllocationsFile(allocationsFile)
      setAllocationsIssues(parsed.issues)
      const warningCount = parsed.issues.filter((issue) => issue.level === "warning").length
      const errorCount = parsed.issues.filter((issue) => issue.level === "error").length
      const summary = await syncAllocationsToDatabase(parsed.records, {
        syncMode,
        sourceFileName: allocationsFile.name,
      })
      const message = `Synced ${parsed.records.length} allocation rows (${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.deleted} deleted).`
      setAllocationsSummary(message)
      appendLog({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        dataset: "Allocations",
        fileName: allocationsFile.name,
        syncMode,
        status: "Success",
        incoming: parsed.records.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        deleted: summary.deleted,
        warningCount,
        errorCount,
        message,
      })
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Failed to import allocations."
      setAllocationsSummary(message)
      appendLog({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        dataset: "Allocations",
        fileName: allocationsFile.name,
        syncMode,
        status: "Failed",
        incoming: 0,
        created: 0,
        updated: 0,
        unchanged: 0,
        deleted: 0,
        warningCount: 0,
        errorCount: 1,
        message,
      })
    } finally {
      setImportingAllocations(false)
    }
  }, [allocationsFile, appendLog, syncAllocationsToDatabase, syncMode])

  return (
    <div className="space-y-6">
      <section id="task-catalog" className="scroll-mt-6" aria-label="Task Catalog">
        <LmsWorkTaskCatalog tasks={workTasks} />
      </section>

      <section id="imports" className="scroll-mt-6" aria-label="Imports">
        {!ready ? (
          <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
        ) : (
          <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Data Upload</CardTitle>
          <CardDescription>Import task and project files here. Browser import history is available in the Import Logs section below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Sync Mode</span>
              <select
                value={syncMode}
                onChange={(event) => setSyncMode(event.target.value as LmsSyncMode)}
                className="h-10 min-w-[180px] rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-sm"
              >
                <option value="merge">Merge (Keep Existing)</option>
                <option value="replace">Replace (Reset + Import)</option>
              </select>
            </label>
            <Badge variant="secondary">{data.tasks.length} tasks in DB</Badge>
            <Badge variant="secondary">{data.allocations.length} projects in DB</Badge>
            <span className="ml-auto text-xs text-[var(--text-secondary)]">
              Last update: {data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : "Never"}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FileDropzone
              title="Tasks File"
              description="Upload .xlsx/.xls/.csv and map task logs."
              file={tasksFile}
              onFileSelected={setTasksFile}
            />
            <FileDropzone
              title="Projects File"
              description="Upload .xlsx/.xls/.csv and map client projects."
              file={allocationsFile}
              onFileSelected={setAllocationsFile}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="rounded-xl" disabled={!tasksFile || importingTasks} onClick={importTasks}>
              {importingTasks ? "Importing Tasks…" : "Import Tasks"}
            </Button>
            <Button className="rounded-xl" disabled={!allocationsFile || importingAllocations} onClick={importAllocations}>
              {importingAllocations ? "Importing Projects…" : "Import Projects"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={clearAllData}>
              Clear All Analysis Data
            </Button>
          </div>

          {tasksSummary ? <p className="text-xs text-[var(--text-secondary)]">Tasks: {tasksSummary}</p> : null}
          {allocationsSummary ? <p className="text-xs text-[var(--text-secondary)]">Projects: {allocationsSummary}</p> : null}
          {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          {loading ? <p className="text-xs text-[var(--text-secondary)]">Synchronizing with database…</p> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <IssuesCard title="Task Parse Issues" issues={tasksIssues} />
            <IssuesCard title="Project Parse Issues" issues={allocationsIssues} />
          </div>
        </CardContent>
          </Card>
        )}
      </section>

      <section id="import-logs" className="scroll-mt-6" aria-label="Import Logs">
        <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>Import Logs</CardTitle>
              <CardDescription>Recent imports from this browser for audit and quick troubleshooting.</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="w-full rounded-xl sm:w-auto" onClick={() => setLogs([])} disabled={logs.length === 0}>
              Clear Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mobileOptimized ? (
            <div className="space-y-3 md:hidden">
              {logs.map((log) => (
                <article key={`mobile-${log.id}`} className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">{new Date(log.at).toLocaleString()}</p>
                    <Badge
                      className={
                        log.status === "Success"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-rose-300 bg-rose-50 text-rose-700"
                      }
                    >
                      {log.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{log.dataset}</p>
                  <p className="line-clamp-1 text-xs text-[var(--text-secondary)]">{log.fileName}</p>
                  <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <p>Mode: <span className="font-semibold text-[var(--text-primary)]">{log.syncMode}</span></p>
                    <p>Changes: in:{log.incoming} · +{log.created} / ~{log.updated} / ={log.unchanged} / -{log.deleted}</p>
                    <p>Issues: {log.warningCount} warnings, {log.errorCount} errors</p>
                  </div>
                </article>
              ))}
              {logs.length === 0 ? (
                <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
                  No import logs yet.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={cn(mobileOptimized && "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Dataset</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.at).toLocaleString()}</TableCell>
                    <TableCell>{log.dataset}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{log.fileName}</TableCell>
                    <TableCell>{log.syncMode}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          log.status === "Success"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-rose-300 bg-rose-50 text-rose-700"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      in:{log.incoming} · +{log.created} / ~{log.updated} / ={log.unchanged} / -{log.deleted}
                    </TableCell>
                    <TableCell>
                      {log.warningCount} warnings, {log.errorCount} errors
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-[var(--text-secondary)]">
                      No import logs yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        </Card>
      </section>
    </div>
  )
}
