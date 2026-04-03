"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLmsTasksData } from "@/components/lms-tasks/lms-tasks-provider"
import { parseAllocationsFile, parseTasksFile } from "@/lib/lms-tasks/parsers"
import type { LmsSyncMode, ParseIssue } from "@/lib/lms-tasks/types"

type DropzoneProps = {
  title: string
  description: string
  file: File | null
  onFileSelected: (file: File | null) => void
  accept: string
}

function FileDropzone({ title, description, file, onFileSelected, accept }: DropzoneProps) {
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
        const nextFile = event.dataTransfer.files?.[0] ?? null
        onFileSelected(nextFile)
      }}
      className={[
        "rounded-2xl border border-dashed p-4 transition-colors",
        dragging
          ? "border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary-container)_16%,white)]"
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
          accept={accept}
          className="hidden"
          onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  )
}

function IssueList({ issues }: { issues: ParseIssue[] }) {
  if (issues.length === 0) return null
  return (
    <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Parse Issues</p>
      <ul className="space-y-1 text-xs">
        {issues.slice(0, 20).map((issue, index) => (
          <li key={`${issue.message}-${index}`} className={issue.level === "error" ? "text-rose-700" : "text-amber-700"}>
            [{issue.level.toUpperCase()}] {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function LmsIngestionPage() {
  const { ready, loading, error, data, syncTasksToDatabase, syncAllocationsToDatabase, clearAllData } = useLmsTasksData()
  const [tasksFile, setTasksFile] = React.useState<File | null>(null)
  const [allocationsFile, setAllocationsFile] = React.useState<File | null>(null)
  const [syncMode, setSyncMode] = React.useState<LmsSyncMode>("merge")
  const [tasksIssues, setTasksIssues] = React.useState<ParseIssue[]>([])
  const [allocationsIssues, setAllocationsIssues] = React.useState<ParseIssue[]>([])
  const [loadingTaskImport, setLoadingTaskImport] = React.useState(false)
  const [loadingAllocationImport, setLoadingAllocationImport] = React.useState(false)
  const [taskImportSummary, setTaskImportSummary] = React.useState<string | null>(null)
  const [allocationImportSummary, setAllocationImportSummary] = React.useState<string | null>(null)

  const importTasks = React.useCallback(async () => {
    if (!tasksFile) return
    setLoadingTaskImport(true)
    try {
      const result = await parseTasksFile(tasksFile)
      setTasksIssues(result.issues)
      const summary = await syncTasksToDatabase(result.records, {
        syncMode,
        sourceFileName: tasksFile.name,
      })
      setTaskImportSummary(
        `Synced ${result.records.length} task rows (${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.deleted} deleted).`
      )
    } finally {
      setLoadingTaskImport(false)
    }
  }, [syncMode, syncTasksToDatabase, tasksFile])

  const importAllocations = React.useCallback(async () => {
    if (!allocationsFile) return
    setLoadingAllocationImport(true)
    try {
      const result = await parseAllocationsFile(allocationsFile)
      setAllocationsIssues(result.issues)
      if (result.issues.some((issue) => issue.level === "error")) {
        setAllocationImportSummary("Import blocked due to file errors.")
        return
      }
      const summary = await syncAllocationsToDatabase(result.records, {
        syncMode,
        sourceFileName: allocationsFile.name,
      })
      setAllocationImportSummary(
        `Synced ${result.records.length} allocation rows (${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.deleted} deleted).`
      )
    } finally {
      setLoadingAllocationImport(false)
    }
  }, [allocationsFile, syncAllocationsToDatabase, syncMode])

  const importBoth = React.useCallback(async () => {
    await importTasks()
    await importAllocations()
  }, [importAllocations, importTasks])

  if (!ready) {
    return <Card className="rounded-2xl border-[var(--line-subtle)] p-6 text-sm text-[var(--text-secondary)]">Loading LMS data…</Card>
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Data Ingestion</CardTitle>
          <CardDescription>
            Upload Task Logs and Client Allocations from Excel/CSV. Parser maps headers from the first row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-[360px]">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Sync Mode</span>
              <select
                value={syncMode}
                onChange={(event) => setSyncMode(event.target.value as LmsSyncMode)}
                className="h-10 rounded-xl border border-[var(--line-subtle)] bg-white px-3 text-sm"
              >
                <option value="merge">Merge</option>
                <option value="replace">Replace (Full Refresh)</option>
              </select>
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              `Merge` updates existing rows and inserts new rows, while keeping older rows not present in the uploaded file.
            </p>
          </div>
          <FileDropzone
            title="Tasks File"
            description="Accepted: .xlsx, .xls, .csv, .tsv. Expected headers include id/cod, data/date, client/domeniu, executant."
            file={tasksFile}
            onFileSelected={setTasksFile}
            accept=".xlsx,.xls,.csv,.tsv,.txt"
          />
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" disabled={!tasksFile || loadingTaskImport} onClick={importTasks}>
              {loadingTaskImport ? "Importing Tasks…" : "Import Tasks"}
            </Button>
            <Badge variant="secondary">{data.tasks.length} tasks currently loaded</Badge>
          </div>
          {taskImportSummary ? <p className="text-xs text-emerald-700">{taskImportSummary}</p> : null}
          <IssueList issues={tasksIssues} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Allocations File</CardTitle>
          <CardDescription>
            Required column: <code>Client - domeniu.ro</code> or <code>Client</code>. Status blanks fallback to <code>-</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropzone
            title="Allocations File"
            description="Accepted: .xlsx, .xls, .csv, .tsv. Expected headers include Status serviciu SEO/GAds/FAds/TAds and Specialist."
            file={allocationsFile}
            onFileSelected={setAllocationsFile}
            accept=".xlsx,.xls,.csv,.tsv,.txt"
          />
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" disabled={!allocationsFile || loadingAllocationImport} onClick={importAllocations}>
              {loadingAllocationImport ? "Importing Allocations…" : "Import Allocations"}
            </Button>
            <Badge variant="secondary">{data.allocations.length} allocations currently loaded</Badge>
          </div>
          {allocationImportSummary ? <p className="text-xs text-emerald-700">{allocationImportSummary}</p> : null}
          <IssueList issues={allocationsIssues} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[var(--line-subtle)]">
        <CardHeader>
          <CardTitle>Dataset Controls</CardTitle>
          <CardDescription>Quick actions for loading both files or resetting the LMS module dataset.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button className="rounded-xl" onClick={importBoth} disabled={!tasksFile && !allocationsFile}>
            Import Both
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={clearAllData}>
            Clear Imported Data
          </Button>
          <div className="ml-auto text-xs text-[var(--text-secondary)]">
            Last update: {data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : "Never"}
          </div>
        </CardContent>
      </Card>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          Synchronizing with database…
        </div>
      ) : null}
    </div>
  )
}
