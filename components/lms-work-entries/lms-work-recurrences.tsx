"use client"

import * as React from "react"
import { AlertTriangle, CalendarClock, Clock3, Loader2, Pencil, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createLmsWorkRecurrence,
  setLmsWorkRecurrenceActive,
  updateLmsWorkRecurrence,
} from "@/lib/actions/lms-work-entries"
import {
  LMS_RECURRENCE_WEEKDAYS,
  LMS_RECURRENCE_WORKDAYS,
  LMS_STANDARD_WORK_WEEK_MINUTES,
  formatRecurrenceSchedule,
  getLmsRecurrenceWeeklyMinutes,
} from "@/lib/lms-work-entries/recurrence"
import type {
  LmsWorkRecurrenceInput,
  LmsWorkRecurrencePageData,
  LmsWorkRecurrenceRow,
} from "@/lib/lms-work-entries/types"
import { ClientCombobox, TaskCombobox } from "@/components/lms-work-entries/lms-work-log-workspace"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const DEFAULT_DURATION = "60"

function emptyDraft(): LmsWorkRecurrenceInput & { durationText: string } {
  return {
    lmsAllocationId: "",
    taskTypeId: "",
    durationMinutes: 60,
    durationText: DEFAULT_DURATION,
    weekdays: [...LMS_RECURRENCE_WORKDAYS],
  }
}

function formatLastRun(value: string | null) {
  if (!value) return "Not run yet"
  return `Last run ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`
}

function formatWeeklyDuration(value: number) {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (hours === 0) return `${minutes}m`
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

export function LmsWorkRecurrences({ data }: { data: LmsWorkRecurrencePageData }) {
  const router = useRouter()
  const [draft, setDraft] = React.useState(emptyDraft)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const duration = Number(draft.durationText)
  const durationValid = Number.isInteger(duration) && duration >= 1 && duration <= 1440
  const canSave = Boolean(
    draft.lmsAllocationId && draft.taskTypeId && draft.weekdays.length && durationValid && !busyId
  )

  function resetEditor() {
    setEditingId(null)
    setEditorOpen(false)
    setDraft(emptyDraft())
  }

  function editRule(rule: LmsWorkRecurrenceRow) {
    setEditingId(rule.id)
    setEditorOpen(true)
    setDraft({
      lmsAllocationId: rule.lmsAllocationId ?? "",
      taskTypeId: rule.taskInactive ? "" : rule.taskTypeId,
      durationMinutes: rule.durationMinutes,
      durationText: String(rule.durationMinutes),
      weekdays: rule.weekdays,
    })
    requestAnimationFrame(() => {
      document.getElementById("recurring-work-editor")?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  function beginNewRule() {
    setEditingId(null)
    setDraft(emptyDraft())
    setEditorOpen(true)
    requestAnimationFrame(() => {
      document.getElementById("recurring-work-editor")?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  function toggleWeekday(weekday: number) {
    setDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((value) => value !== weekday)
        : [...current.weekdays, weekday].sort((left, right) => left - right),
    }))
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return
    const input: LmsWorkRecurrenceInput = {
      lmsAllocationId: draft.lmsAllocationId,
      taskTypeId: draft.taskTypeId,
      durationMinutes: duration,
      weekdays: draft.weekdays,
    }
    setBusyId(editingId ?? "new")
    const result = editingId
      ? await updateLmsWorkRecurrence(editingId, input)
      : await createLmsWorkRecurrence(input)
    setBusyId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(editingId ? "Recurring rule updated" : "Recurring rule created")
    resetEditor()
    router.refresh()
  }

  async function changeStatus(rule: LmsWorkRecurrenceRow, active: boolean) {
    setBusyId(rule.id)
    const result = await setLmsWorkRecurrenceActive(rule.id, active)
    setBusyId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(active ? "Recurring rule activated" : "Recurring rule deactivated")
    router.refresh()
  }

  const activeRecurrences = data.recurrences.filter((rule) => rule.isActive)
  const runnableRecurrences = activeRecurrences.filter((rule) => !rule.clientDetached && !rule.taskInactive)
  const excludedRecurrences = activeRecurrences.length - runnableRecurrences.length
  const weeklyRecurringMinutes = runnableRecurrences.reduce(
    (total, rule) => total + getLmsRecurrenceWeeklyMinutes(rule.durationMinutes, rule.weekdays),
    0
  )
  const weeklyRemainingMinutes = Math.max(0, LMS_STANDARD_WORK_WEEK_MINUTES - weeklyRecurringMinutes)
  const weeklyUtilizationPercent = Math.round(
    (weeklyRecurringMinutes / LMS_STANDARD_WORK_WEEK_MINUTES) * 100
  )

  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-[var(--brand-primary)]" />
              Recurring Work
            </CardTitle>
            <CardDescription>
              One daily cron creates normal, not-exported Work Entries for every active rule. Romanian legal holidays are skipped.
            </CardDescription>
          </div>
          {!editorOpen ? (
            <Button type="button" className="rounded-xl" onClick={beginNewRule}>
              <Plus /> Add new rule
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {editorOpen ? <form
          id="recurring-work-editor"
          onSubmit={saveRule}
          className="space-y-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {editingId ? "Edit recurring rule" : "Add recurring rule"}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={resetEditor}>
              <X /> Cancel
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Client</Label>
              <ClientCombobox
                clients={data.clients}
                value={draft.lmsAllocationId}
                onValueChange={(value) => setDraft((current) => ({ ...current, lmsAllocationId: value }))}
                large
                disabled={Boolean(busyId)}
              />
            </div>
            <div className="space-y-2">
              <Label>Task</Label>
              <TaskCombobox
                tasks={data.tasks}
                value={draft.taskTypeId}
                onValueChange={(value) => setDraft((current) => ({ ...current, taskTypeId: value }))}
                disabled={Boolean(busyId)}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[180px_1fr_auto] xl:items-end">
            <div className="space-y-2">
              <Label htmlFor="recurrence-duration">Minutes</Label>
              <div className="relative">
                <Input
                  id="recurrence-duration"
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={draft.durationText}
                  onChange={(event) => setDraft((current) => ({ ...current, durationText: event.target.value }))}
                  className="h-12! rounded-xl pr-12"
                  disabled={Boolean(busyId)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">min</span>
              </div>
            </div>
            <fieldset className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="text-sm font-medium text-[var(--text-primary)]">Runs on</legend>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDraft((current) => ({ ...current, weekdays: [...LMS_RECURRENCE_WORKDAYS] }))}
                >
                  Workdays
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {LMS_RECURRENCE_WEEKDAYS.map((weekday) => {
                  const selected = draft.weekdays.includes(weekday.value)
                  return (
                    <Button
                      key={weekday.value}
                      type="button"
                      variant="outline"
                      aria-pressed={selected}
                      aria-label={weekday.label}
                      onClick={() => toggleWeekday(weekday.value)}
                      className={cn(
                        "h-12 rounded-xl px-2",
                        selected && "border-[var(--brand-primary)] bg-[var(--primary-container)] text-[var(--brand-primary)]"
                      )}
                      disabled={Boolean(busyId)}
                    >
                      {weekday.shortLabel}
                    </Button>
                  )
                })}
              </div>
            </fieldset>
            <Button type="submit" className="h-12 min-w-36 rounded-xl" disabled={!canSave}>
              {busyId ? <Loader2 className="animate-spin" /> : editingId ? <Pencil /> : <Plus />}
              {editingId ? "Save rule" : "Add rule"}
            </Button>
          </div>
          {!durationValid && draft.durationText ? (
            <p className="text-xs text-rose-700">Minutes must be a whole number from 1 to 1440.</p>
          ) : null}
          {draft.weekdays.length === 0 ? (
            <p className="text-xs text-rose-700">Select at least one weekday.</p>
          ) : null}
        </form> : null}

        <div className="space-y-2">
          {activeRecurrences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">
              No active recurring rules configured yet.
            </div>
          ) : activeRecurrences.map((rule) => {
            const warning = rule.clientDetached || rule.taskInactive
            return (
              <article
                key={rule.id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                      {rule.clientName} <span className="text-[var(--text-muted)]">—</span> {rule.taskName}
                    </p>
                    {warning ? (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                        <AlertTriangle /> Needs attention
                      </Badge>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5" aria-label={`Runs on ${formatRecurrenceSchedule(rule.weekdays)}`}>
                      {LMS_RECURRENCE_WEEKDAYS.map((weekday) => {
                        const active = rule.weekdays.includes(weekday.value)
                        return (
                          <span
                            key={weekday.value}
                            className={cn(
                              "inline-flex h-7 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold",
                              active
                                ? "bg-[var(--primary-container)] text-[var(--brand-primary)]"
                                : "bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
                            )}
                          >
                            {weekday.shortLabel}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-[var(--bg-surface-soft)] px-3 py-2 text-[var(--brand-primary)]">
                    <Clock3 className="h-5 w-5" />
                    <div className="text-right">
                      <p className="text-sm font-semibold leading-none">
                        {rule.durationMinutes} min <span className="text-xs text-[var(--text-muted)]">/ run</span>
                      </p>
                      <p className="mt-1 text-base font-bold leading-none">
                        {formatWeeklyDuration(getLmsRecurrenceWeeklyMinutes(rule.durationMinutes, rule.weekdays))}
                        <span className="ml-1 text-xs font-semibold text-[var(--text-muted)]">/ week</span>
                      </p>
                    </div>
                  </div>
                </div>
                {warning ? (
                  <p className="text-xs text-amber-800">
                    {rule.clientDetached ? "Client was removed from LMS Projects. " : ""}
                    {rule.taskInactive ? "Task is inactive. " : ""}
                    This rule is skipped until corrected.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-3">
                  <p className="text-xs text-[var(--text-muted)]">{formatLastRun(rule.lastRunAt)}</p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span>Active</span>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => void changeStatus(rule, checked)}
                        disabled={busyId === rule.id}
                        aria-label={`Deactivate ${rule.taskName}`}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => editRule(rule)}
                      disabled={Boolean(busyId)}
                    >
                      <Pencil /> Edit
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="space-y-3 border-t border-[var(--line-subtle)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-4 py-3">
              <CalendarClock className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Recurring work / week</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {formatWeeklyDuration(weeklyRecurringMinutes)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-surface-soft)] px-4 py-3">
              <Clock3 className="h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Standard work week</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {formatWeeklyDuration(LMS_STANDARD_WORK_WEEK_MINUTES)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
              <span className="text-[var(--text-secondary)]">Weekly recurring load</span>
              <span className="text-[var(--brand-primary)]">{weeklyUtilizationPercent}% of 40h</span>
            </div>
            <div
              role="progressbar"
              aria-label="Weekly recurring work load"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(weeklyUtilizationPercent, 100)}
              className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-surface-soft)]"
            >
              <div
                className="h-full rounded-full bg-[var(--brand-primary)] transition-[width]"
                style={{ width: `${Math.min(weeklyUtilizationPercent, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>{formatWeeklyDuration(weeklyRemainingMinutes)} remaining</span>
              <span>{runnableRecurrences.length} active {runnableRecurrences.length === 1 ? "rule" : "rules"}</span>
            </div>
          </div>

          {excludedRecurrences > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {excludedRecurrences} {excludedRecurrences === 1 ? "rule needs" : "rules need"} attention and {excludedRecurrences === 1 ? "is" : "are"} excluded from the weekly total.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
