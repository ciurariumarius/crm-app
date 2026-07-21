"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Check, GripVertical, ListChecks, Loader2, Pencil, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { createLmsWorkTask, reorderLmsWorkTasks, updateLmsWorkTask } from "@/lib/actions/lms-work-entries"
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
  const [orderedTasks, setOrderedTasks] = React.useState(tasks)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)

  const activeCount = orderedTasks.filter((task) => task.isActive).length
  const inactiveCount = orderedTasks.length - activeCount
  const canReorder = filter === "all" && !search.trim() && editingId === null && busyId === null
  const visibleTasks = React.useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ro-RO")
    return orderedTasks.filter((task) => {
      if (filter === "active" && !task.isActive) return false
      if (filter === "inactive" && task.isActive) return false
      return !query || task.name.toLocaleLowerCase("ro-RO").includes(query)
    })
  }, [filter, orderedTasks, search])

  React.useEffect(() => {
    setOrderedTasks(tasks)
  }, [tasks])

  React.useEffect(() => {
    if (editingId && !orderedTasks.some((task) => task.id === editingId)) {
      setEditingId(null)
      setDraftName("")
    }
  }, [editingId, orderedTasks])

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

  async function persistTaskOrder(nextTasks: LmsWorkTaskOption[]) {
    const previousTasks = orderedTasks
    setOrderedTasks(nextTasks)
    setBusyId("reorder")
    const result = await reorderLmsWorkTasks(nextTasks.map((task) => task.id))
    setBusyId(null)
    if (!result.success) {
      setOrderedTasks(previousTasks)
      toast.error(result.error)
      return
    }
    toast.success("Task order saved")
  }

  function moveTask(taskId: string, targetId: string) {
    if (!canReorder || taskId === targetId) return
    const fromIndex = orderedTasks.findIndex((task) => task.id === taskId)
    const targetIndex = orderedTasks.findIndex((task) => task.id === targetId)
    if (fromIndex < 0 || targetIndex < 0) return
    const nextTasks = [...orderedTasks]
    const [movedTask] = nextTasks.splice(fromIndex, 1)
    nextTasks.splice(targetIndex, 0, movedTask)
    void persistTaskOrder(nextTasks)
  }

  function moveTaskByOffset(taskId: string, offset: -1 | 1) {
    if (!canReorder) return
    const currentIndex = orderedTasks.findIndex((task) => task.id === taskId)
    const target = orderedTasks[currentIndex + offset]
    if (currentIndex < 0 || !target) return
    moveTask(taskId, target.id)
  }

  const filters: Array<{ value: CatalogFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: orderedTasks.length },
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

        {orderedTasks.length > 1 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            {canReorder
              ? "Drag tasks by the handle to set their order in Record Work. Use Alt + Arrow Up/Down from the handle for keyboard reordering."
              : "Clear search and select All to reorder tasks."}
          </p>
        ) : null}

        <div className="space-y-2">
          {visibleTasks.map((task, index) => {
            const editing = editingId === task.id
            const busy = busyId === task.id || busyId === "reorder"
            return (
              <div
                key={task.id}
                onDragOver={(event) => {
                  if (!canReorder || !draggingId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setDragOverId(task.id)
                }}
                onDragLeave={() => setDragOverId((current) => current === task.id ? null : current)}
                onDrop={(event) => {
                  event.preventDefault()
                  const sourceId = draggingId || event.dataTransfer.getData("text/plain")
                  setDraggingId(null)
                  setDragOverId(null)
                  if (sourceId) moveTask(sourceId, task.id)
                }}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-3 transition-colors sm:flex-row sm:items-center",
                  draggingId === task.id && "opacity-50",
                  dragOverId === task.id && draggingId !== task.id && "border-[var(--brand-primary)] bg-[var(--bg-surface-soft)]"
                )}
              >
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    draggable={canReorder}
                    disabled={!canReorder}
                    aria-label={`Drag to reorder ${task.name}`}
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    title={canReorder ? "Drag to reorder" : "Clear filters to reorder"}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move"
                      event.dataTransfer.setData("text/plain", task.id)
                      setDraggingId(task.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setDragOverId(null)
                    }}
                    onKeyDown={(event) => {
                      if (!event.altKey) return
                      if (event.key === "ArrowUp") {
                        event.preventDefault()
                        moveTaskByOffset(task.id, -1)
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault()
                        moveTaskByOffset(task.id, 1)
                      }
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical />
                  </Button>
                  <div className="flex sm:hidden">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${task.name} up`} disabled={!canReorder || index === 0} onClick={() => moveTaskByOffset(task.id, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${task.name} down`} disabled={!canReorder || index === visibleTasks.length - 1} onClick={() => moveTaskByOffset(task.id, 1)}>
                      <ArrowDown />
                    </Button>
                  </div>
                </div>
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
              {orderedTasks.length === 0 ? "No predefined work tasks yet. Add the first one above." : "No tasks match this search and status filter."}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
