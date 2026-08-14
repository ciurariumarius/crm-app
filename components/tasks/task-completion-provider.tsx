"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Check, CheckCircle2, ChevronsUpDown, Clock3, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { completeTask, getTaskLmsOptions, reopenTask } from "@/lib/actions/tasks"
import { getBucharestDateOnly, getDefaultLmsWorkDate, isLmsWorkWeekday } from "@/lib/lms-work-entries/date"
import { cn } from "@/lib/utils"
import {
  resolveCompletionDefaultMinutes,
  validCompletionMinutes,
} from "@/components/tasks/task-completion-defaults"

export type TaskCompletionTask = {
  id: string
  projectId?: string | null
  name?: string | null
  status?: string | null
  taskScope?: "GENERAL" | "FREELANCE" | "LMS" | string | null
  estimatedMinutes?: number | null
  lmsAllocationId?: string | null
  lmsTaskTypeId?: string | null
  lmsAllocation?: { id?: string; client?: string | null } | null
  lmsTaskType?: { id?: string; name?: string | null; defaultDurationMinutes?: number | null } | null
}

type LmsOptions = {
  allocations: Array<{ id: string; client: string }>
  workTasks: Array<{ id: string; name: string; defaultDurationMinutes: number | null }>
  projects: Array<{ id: string; label: string; status: string }>
}

type CompletionRequestOptions = {
  onCompleted?: () => void
}

type TaskCompletionContextValue = {
  requestCompletion: (task: TaskCompletionTask, options?: CompletionRequestOptions) => void
  requestReopen: (task: TaskCompletionTask, options?: CompletionRequestOptions) => Promise<boolean>
  pendingTaskId: string | null
  lmsOptions: LmsOptions
  lmsOptionsLoading: boolean
  lmsOptionsError: string | null
  loadLmsOptions: (force?: boolean) => Promise<LmsOptions>
}

const EMPTY_LMS_OPTIONS: LmsOptions = { allocations: [], workTasks: [], projects: [] }
const TaskCompletionContext = React.createContext<TaskCompletionContextValue | null>(null)

function normalizeLmsOptions(result: unknown): LmsOptions {
  const payload = result && typeof result === "object" && "data" in result
    ? (result as { data?: unknown }).data
    : null
  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const allocations = Array.isArray(data.allocations) ? data.allocations : []
  const workTasks = Array.isArray(data.workTasks)
    ? data.workTasks
    : Array.isArray(data.taskTypes) ? data.taskTypes : []
  const projects = Array.isArray(data.projects) ? data.projects : []

  return {
    allocations: allocations.flatMap((value) => {
      if (!value || typeof value !== "object") return []
      const option = value as Record<string, unknown>
      return typeof option.id === "string" && typeof option.client === "string"
        ? [{ id: option.id, client: option.client }]
        : []
    }),
    workTasks: workTasks.flatMap((value) => {
      if (!value || typeof value !== "object") return []
      const option = value as Record<string, unknown>
      return typeof option.id === "string" && typeof option.name === "string"
        ? [{
            id: option.id,
            name: option.name,
            defaultDurationMinutes: typeof option.defaultDurationMinutes === "number" ? option.defaultDurationMinutes : null,
          }]
        : []
    }),
    projects: projects.flatMap((value) => {
      if (!value || typeof value !== "object") return []
      const option = value as Record<string, unknown>
      return typeof option.id === "string" && typeof option.label === "string"
        ? [{
            id: option.id,
            label: option.label,
            status: typeof option.status === "string" ? option.status : "Active",
          }]
        : []
    }),
  }
}

function getResultError(result: unknown, fallback: string) {
  if (result && typeof result === "object" && "error" in result && typeof (result as { error?: unknown }).error === "string") {
    return (result as { error: string }).error
  }
  return fallback
}

function resultSucceeded(result: unknown) {
  return Boolean(result && typeof result === "object" && "success" in result && (result as { success?: unknown }).success === true)
}

function CompletionCombobox({
  id,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  options,
  value,
  onValueChange,
  disabled,
  invalid,
}: {
  id: string
  label: string
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  options: Array<{ id: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((option) => option.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-left font-normal",
            selected && "border-[color:color-mix(in_srgb,var(--primary)_44%,var(--line-subtle))]",
            invalid && "border-[var(--state-urgent)]"
          )}
        >
          <span className={cn("truncate", !selected && "text-[var(--text-muted)]")}>
            {selected?.label || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.id}`}
                  onSelect={() => {
                    onValueChange(option.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function TaskCompletionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pendingTaskId, setPendingTaskId] = React.useState<string | null>(null)
  const [dialogTask, setDialogTask] = React.useState<TaskCompletionTask | null>(null)
  const [completionCallback, setCompletionCallback] = React.useState<(() => void) | null>(null)
  const [lmsOptions, setLmsOptions] = React.useState<LmsOptions>(EMPTY_LMS_OPTIONS)
  const [lmsOptionsLoading, setLmsOptionsLoading] = React.useState(false)
  const [lmsOptionsLoaded, setLmsOptionsLoaded] = React.useState(false)
  const [lmsOptionsError, setLmsOptionsError] = React.useState<string | null>(null)
  const requestRef = React.useRef<Promise<LmsOptions> | null>(null)
  const activeDialogTaskIdRef = React.useRef<string | null>(null)
  const durationSourceRef = React.useRef<"empty" | "estimate" | "category" | "manual">("empty")

  const [lmsAllocationId, setLmsAllocationId] = React.useState("")
  const [lmsTaskTypeId, setLmsTaskTypeId] = React.useState("")
  const [workDate, setWorkDate] = React.useState("")
  const [durationMinutes, setDurationMinutes] = React.useState("")
  const [formAttempted, setFormAttempted] = React.useState(false)

  const loadLmsOptions = React.useCallback(async (force = false) => {
    if (lmsOptionsLoaded && !force) return lmsOptions
    if (requestRef.current && !force) return requestRef.current

    setLmsOptionsLoading(true)
    setLmsOptionsError(null)
    const request = (async () => {
      try {
        const result = await getTaskLmsOptions()
        if (!resultSucceeded(result)) throw new Error(getResultError(result, "Failed to load LMS options"))
        const normalized = normalizeLmsOptions(result)
        setLmsOptions(normalized)
        setLmsOptionsLoaded(true)
        return normalized
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load LMS options"
        setLmsOptionsError(message)
        return EMPTY_LMS_OPTIONS
      } finally {
        setLmsOptionsLoading(false)
        requestRef.current = null
      }
    })()
    requestRef.current = request
    return request
  }, [lmsOptions, lmsOptionsLoaded])

  const finishCompletion = React.useCallback(() => {
    completionCallback?.()
    activeDialogTaskIdRef.current = null
    setDialogTask(null)
    setCompletionCallback(null)
    router.refresh()
  }, [completionCallback, router])

  const completeWithoutLmsDialog = React.useCallback(async (
    task: TaskCompletionTask,
    options?: CompletionRequestOptions
  ) => {
    setPendingTaskId(task.id)
    try {
      const result = await completeTask(task.id)
      if (!resultSucceeded(result)) {
        toast.error(getResultError(result, "Failed to complete task"))
        return
      }
      toast.success("Task completed")
      options?.onCompleted?.()
      router.refresh()
    } catch {
      toast.error("Failed to complete task")
    } finally {
      setPendingTaskId(null)
    }
  }, [router])

  const requestCompletion = React.useCallback((task: TaskCompletionTask, options?: CompletionRequestOptions) => {
    if (task.status === "Completed" || pendingTaskId === task.id) return
    if (task.taskScope !== "LMS") {
      void completeWithoutLmsDialog(task, options)
      return
    }

    const today = getDefaultLmsWorkDate(getBucharestDateOnly())
    activeDialogTaskIdRef.current = task.id
    setDialogTask(task)
    setCompletionCallback(() => options?.onCompleted || null)
    setLmsAllocationId(task.lmsAllocationId || task.lmsAllocation?.id || "")
    setLmsTaskTypeId(task.lmsTaskTypeId || task.lmsTaskType?.id || "")
    setWorkDate(today)
    const initialDefault = resolveCompletionDefaultMinutes(task, lmsOptions.workTasks)
    durationSourceRef.current = initialDefault.source
    setDurationMinutes(initialDefault.minutes === null ? "" : String(initialDefault.minutes))
    setFormAttempted(false)
    void loadLmsOptions().then((optionsData) => {
      if (activeDialogTaskIdRef.current !== task.id) return
      const loadedDefault = resolveCompletionDefaultMinutes(task, optionsData.workTasks)
      if (loadedDefault.minutes !== null && durationSourceRef.current === "empty") {
        durationSourceRef.current = loadedDefault.source
        setDurationMinutes((current) => current || String(loadedDefault.minutes))
      }
    })
  }, [completeWithoutLmsDialog, lmsOptions.workTasks, loadLmsOptions, pendingTaskId])

  const requestReopen = React.useCallback(async (task: TaskCompletionTask, options?: CompletionRequestOptions) => {
    if (pendingTaskId === task.id) return false
    setPendingTaskId(task.id)
    try {
      const result = await reopenTask(task.id)
      if (!resultSucceeded(result)) {
        toast.error(getResultError(result, "Failed to reopen task"))
        return false
      }
      const warning = result && typeof result === "object" && "warning" in result
        && typeof (result as { warning?: unknown }).warning === "string"
        ? (result as { warning: string }).warning
        : null
      if (warning) {
        toast.warning(warning)
      } else {
        const resultData = result && typeof result === "object" && "data" in result
          ? (result as { data?: { entryDeleted?: boolean } }).data
          : undefined
        toast.success(resultData?.entryDeleted
          ? "Task reopened and its unexported LMS entry was removed"
          : "Task reopened")
      }
      options?.onCompleted?.()
      router.refresh()
      return true
    } catch {
      toast.error("Failed to reopen task")
      return false
    } finally {
      setPendingTaskId(null)
    }
  }, [pendingTaskId, router])

  const selectedWorkTask = lmsOptions.workTasks.find((option) => option.id === lmsTaskTypeId)
  const parsedDuration = Number(durationMinutes)
  const validDuration = Number.isInteger(parsedDuration) && parsedDuration >= 1 && parsedDuration <= 1440
  const validDate = Boolean(workDate && isLmsWorkWeekday(workDate))
  const canSubmit = Boolean(lmsAllocationId && lmsTaskTypeId && validDate && validDuration && !lmsOptionsLoading)

  function selectWorkTask(value: string) {
    setLmsTaskTypeId(value)
    if (durationSourceRef.current === "estimate" || durationSourceRef.current === "manual") return
    const defaultMinutes = validCompletionMinutes(
      lmsOptions.workTasks.find((option) => option.id === value)?.defaultDurationMinutes
    )
    durationSourceRef.current = defaultMinutes === null ? "empty" : "category"
    setDurationMinutes(defaultMinutes === null ? "" : String(defaultMinutes))
  }

  async function submitLmsCompletion(event: React.FormEvent) {
    event.preventDefault()
    setFormAttempted(true)
    if (!dialogTask || !canSubmit) return

    setPendingTaskId(dialogTask.id)
    try {
      const result = await completeTask(dialogTask.id, {
        lmsAllocationId,
        lmsTaskTypeId,
        workDate,
        durationMinutes: parsedDuration,
      })
      if (!resultSucceeded(result)) {
        toast.error(getResultError(result, "Failed to complete task"))
        return
      }
      const resultData = result && typeof result === "object" && "data" in result
        ? (result as { data?: { lmsEntryAlreadyExists?: boolean } }).data
        : undefined
      toast.success(resultData?.lmsEntryAlreadyExists
        ? "Task completed; its existing LMS work entry was kept"
        : "Task completed and LMS work recorded")
      finishCompletion()
    } catch {
      toast.error("Failed to complete task")
    } finally {
      setPendingTaskId(null)
    }
  }

  const contextValue = React.useMemo<TaskCompletionContextValue>(() => ({
    requestCompletion,
    requestReopen,
    pendingTaskId,
    lmsOptions,
    lmsOptionsLoading,
    lmsOptionsError,
    loadLmsOptions,
  }), [loadLmsOptions, lmsOptions, lmsOptionsError, lmsOptionsLoading, pendingTaskId, requestCompletion, requestReopen])

  return (
    <TaskCompletionContext.Provider value={contextValue}>
      {children}
      <Dialog
        open={Boolean(dialogTask)}
        onOpenChange={(open) => {
          if (open || pendingTaskId) return
          activeDialogTaskIdRef.current = null
          setDialogTask(null)
          setCompletionCallback(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--state-success)]" />
              Complete LMS task
            </DialogTitle>
            <DialogDescription>
              Confirm where and how much time to record for “{dialogTask?.name || "Untitled task"}”. The task and LMS work entry are saved together.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitLmsCompletion} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-completion-lms-project">LMS project *</Label>
                <CompletionCombobox
                  id="task-completion-lms-project"
                  label="Select LMS project"
                  value={lmsAllocationId}
                  onValueChange={setLmsAllocationId}
                  options={lmsOptions.allocations.map((option) => ({ id: option.id, label: option.client }))}
                  placeholder={lmsOptionsLoading ? "Loading LMS projects…" : "Select LMS project"}
                  searchPlaceholder="Search LMS project…"
                  emptyLabel="No LMS project found."
                  disabled={lmsOptionsLoading || Boolean(pendingTaskId)}
                  invalid={formAttempted && !lmsAllocationId}
                />
                {formAttempted && !lmsAllocationId ? <p className="text-xs font-medium text-[var(--state-urgent)]">Select an LMS project.</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-completion-lms-category">Work category *</Label>
                <CompletionCombobox
                  id="task-completion-lms-category"
                  label="Select LMS work category"
                  value={lmsTaskTypeId}
                  onValueChange={selectWorkTask}
                  options={lmsOptions.workTasks.map((option) => ({ id: option.id, label: option.name }))}
                  placeholder={lmsOptionsLoading ? "Loading categories…" : "Select work category"}
                  searchPlaceholder="Search work category…"
                  emptyLabel="No active work category found."
                  disabled={lmsOptionsLoading || Boolean(pendingTaskId)}
                  invalid={formAttempted && !lmsTaskTypeId}
                />
                {formAttempted && !lmsTaskTypeId ? <p className="text-xs font-medium text-[var(--state-urgent)]">Select a work category.</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-completion-work-date" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Work date *</Label>
                <Input
                  id="task-completion-work-date"
                  type="date"
                  value={workDate}
                  onChange={(event) => setWorkDate(event.target.value)}
                  disabled={Boolean(pendingTaskId)}
                  className="h-11"
                />
                {formAttempted && !validDate ? <p className="text-xs font-medium text-[var(--state-urgent)]">Choose a Monday–Friday work date.</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-completion-duration" className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Actual minutes *</Label>
                <Input
                  id="task-completion-duration"
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(event) => {
                    durationSourceRef.current = "manual"
                    setDurationMinutes(event.target.value)
                  }}
                  disabled={Boolean(pendingTaskId)}
                  placeholder={selectedWorkTask?.defaultDurationMinutes ? String(selectedWorkTask.defaultDurationMinutes) : "e.g. 60"}
                  className="h-11"
                />
                {formAttempted && !validDuration ? <p className="text-xs font-medium text-[var(--state-urgent)]">Enter 1–1440 whole minutes.</p> : null}
              </div>
            </div>
            {lmsOptionsError ? (
              <p className="rounded-xl border border-[color:color-mix(in_srgb,var(--state-urgent)_30%,var(--line-subtle))] bg-[var(--state-danger-surface)] px-3 py-2 text-sm text-[var(--state-urgent)]">
                {lmsOptionsError}{" "}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void loadLmsOptions(true)}>Retry</button>
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(pendingTaskId)}
                onClick={() => {
                  activeDialogTaskIdRef.current = null
                  setDialogTask(null)
                  setCompletionCallback(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={Boolean(pendingTaskId) || lmsOptionsLoading}>
                {pendingTaskId ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Complete & record work
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TaskCompletionContext.Provider>
  )
}

export function useTaskCompletion() {
  const value = React.useContext(TaskCompletionContext)
  if (!value) throw new Error("useTaskCompletion must be used inside TaskCompletionProvider")
  return value
}
