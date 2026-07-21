"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ListChecks, Loader2, Pencil, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { createLmsWorkTask, updateLmsWorkTask } from "@/lib/actions/lms-work-entries"
import type { LmsWorkTaskOption } from "@/lib/lms-work-entries/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type CatalogFilter = "all" | "active" | "inactive"

export function LmsWorkTaskCatalog({ tasks }: { tasks: LmsWorkTaskOption[] }) {
  const router = useRouter()
  const [newTask, setNewTask] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<CatalogFilter>("all")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draftName, setDraftName] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const activeCount = tasks.filter((task) => task.isActive).length
  const inactiveCount = tasks.length - activeCount
  const visibleTasks = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ro-RO")
    return tasks.filter((task) => {
      if (filter === "active" && !task.isActive) return false
      if (filter === "inactive" && task.isActive) return false
      return !query || task.name.toLocaleLowerCase("ro-RO").includes(query)
    })
  }, [filter, search, tasks])

  React.useEffect(() => {
    if (editingId && !tasks.some((task) => task.id === editingId)) {
      setEditingId(null)
      setDraftName("")
    }
  }, [editingId, tasks])

  async function addTask(event: React.FormEvent) {
    event.preventDefault()
    if (!newTask.trim()) return
    setBusyId("new")
    const result = await createLmsWorkTask(newTask)
    setBusyId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setNewTask("")
    toast.success("Task added")
    router.refresh()
  }

  function beginRename(task: LmsWorkTaskOption) {
    setEditingId(task.id)
    setDraftName(task.name)
  }

  function cancelRename() {
    setEditingId(null)
    setDraftName("")
  }

  async function saveRename(task: LmsWorkTaskOption) {
    const name = draftName.trim()
    if (!name) return
    if (name === task.name) {
      cancelRename()
      return
    }
    setBusyId(task.id)
    const result = await updateLmsWorkTask(task.id, { name, isActive: task.isActive })
    setBusyId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    cancelRename()
    toast.success("Task renamed")
    router.refresh()
  }

  async function setTaskActive(task: LmsWorkTaskOption, isActive: boolean) {
    setBusyId(task.id)
    const result = await updateLmsWorkTask(task.id, { name: task.name, isActive })
    setBusyId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(isActive ? "Task activated" : "Task deactivated")
    router.refresh()
  }

  const filters: Array<{ value: CatalogFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: tasks.length },
    { value: "active", label: "Active", count: activeCount },
    { value: "inactive", label: "Inactive", count: inactiveCount },
  ]

  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListChecks className="h-5 w-5 text-[var(--brand-primary)]" />
          Work-entry task catalog
        </CardTitle>
        <CardDescription>
          These choices appear only in Tasks → Record work. They do not change imported LMS task analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={addTask} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            placeholder="Add a predefined work task"
            maxLength={255}
            required
          />
          <Button type="submit" className="shrink-0" disabled={busyId === "new" || !newTask.trim()}>
            {busyId === "new" ? <Loader2 className="animate-spin" /> : <Plus />}
            Add task
          </Button>
        </form>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search task catalog"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--bg-surface-soft)] p-1">
            {filters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs",
                  filter === option.value && "bg-[var(--surface-lowest)] text-[var(--text-primary)] shadow-sm"
                )}
              >
                {option.label}
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{option.count}</Badge>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const editing = editingId === task.id
            const busy = busyId === task.id
            return (
              <div
                key={task.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <Input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") cancelRename()
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void saveRename(task)
                        }
                      }}
                      maxLength={255}
                      autoFocus
                      disabled={busy}
                      aria-label={`Rename ${task.name}`}
                    />
                  ) : (
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{task.name}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={task.isActive}
                      onCheckedChange={(checked) => setTaskActive(task, checked)}
                      disabled={busy || editing}
                      aria-label={`${task.isActive ? "Deactivate" : "Activate"} ${task.name}`}
                    />
                    <Badge variant={task.isActive ? "default" : "secondary"}>
                      {task.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {editing ? (
                    <div className="flex gap-1">
                      <Button type="button" size="icon-sm" onClick={() => saveRename(task)} disabled={busy || !draftName.trim()} aria-label="Save task name">
                        {busy ? <Loader2 className="animate-spin" /> : <Check />}
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" onClick={cancelRename} disabled={busy} aria-label="Cancel rename">
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => beginRename(task)} disabled={busy}>
                      {busy ? <Loader2 className="animate-spin" /> : <Pencil />}
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {visibleTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line-subtle)] p-8 text-center text-sm text-[var(--text-secondary)]">
              {tasks.length === 0 ? "No predefined work tasks yet. Add the first one above." : "No tasks match this search and status filter."}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
