"use client"

import * as React from "react"
import { AlertTriangle, CalendarClock, Loader2, Pencil, Plus, X } from "lucide-react"
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
  formatRecurrenceSchedule,
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

export function LmsWorkRecurrences({ data }: { data: LmsWorkRecurrencePageData }) {
  const router = useRouter()
  const [draft, setDraft] = React.useState(emptyDraft)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const duration = Number(draft.durationText)
  const durationValid = Number.isInteger(duration) && duration >= 1 && duration <= 1440
  const canSave = Boolean(
    draft.lmsAllocationId && draft.taskTypeId && draft.weekdays.length && durationValid && !busyId
  )

  function resetEditor() {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  function editRule(rule: LmsWorkRecurrenceRow) {
    setEditingId(rule.id)
    setDraft({
      lmsAllocationId: rule.lmsAllocationId ?? "",
      taskTypeId: rule.taskInactive ? "" : rule.taskTypeId,
      durationMinutes: rule.durationMinutes,
      durationText: String(rule.durationMinutes),
      weekdays: rule.weekdays,
    })
    document.getElementById("recurring-work-editor")?.scrollIntoView({ behavior: "smooth", block: "center" })
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

  return (
    <Card className="rounded-2xl border-[var(--line-subtle)]">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5 text-[var(--brand-primary)]" />
          Recurring Work
        </CardTitle>
        <CardDescription>
          One daily cron creates normal, not-exported Work Entries for every active rule. Romanian legal holidays are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          id="recurring-work-editor"
          onSubmit={saveRule}
          className="space-y-4 rounded-2xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {editingId ? "Edit recurring rule" : "Add recurring rule"}
            </p>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetEditor}>
                <X /> Cancel
              </Button>
            ) : null}
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
        </form>

        <div className="space-y-2">
          {data.recurrences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">
              No recurring rules configured yet.
            </div>
          ) : data.recurrences.map((rule) => {
            const warning = rule.clientDetached || rule.taskInactive
            return (
              <article
                key={rule.id}
                className="grid gap-3 rounded-xl border border-[var(--line-subtle)] bg-[var(--bg-surface)] p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{rule.clientName}</p>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {warning ? (
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                        <AlertTriangle /> Needs attention
                      </Badge>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{rule.taskName}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {rule.durationMinutes} min · {formatRecurrenceSchedule(rule.weekdays)} · {formatLastRun(rule.lastRunAt)}
                  </p>
                  {warning ? (
                    <p className="text-xs text-amber-800">
                      {rule.clientDetached ? "Client was removed from LMS Projects. " : ""}
                      {rule.taskInactive ? "Task is inactive. " : ""}
                      This rule is skipped until corrected.
                    </p>
                  ) : null}
                </div>
                <label className="flex items-center justify-between gap-3 text-sm lg:justify-start">
                  <span className="lg:sr-only">Active</span>
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={(checked) => void changeStatus(rule, checked)}
                    disabled={busyId === rule.id}
                    aria-label={`${rule.isActive ? "Deactivate" : "Activate"} ${rule.taskName}`}
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl lg:w-auto"
                  onClick={() => editRule(rule)}
                  disabled={Boolean(busyId)}
                >
                  <Pencil /> Edit
                </Button>
              </article>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
