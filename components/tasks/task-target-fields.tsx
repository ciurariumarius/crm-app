"use client"

import * as React from "react"
import { BriefcaseBusiness, Check, ChevronsUpDown, GraduationCap, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useTaskCompletion } from "@/components/tasks/task-completion-provider"
import { AddLmsClientDialog } from "@/components/lms-work-entries/add-lms-client-dialog"

export const TASK_SCOPE_VALUES = ["GENERAL", "FREELANCE", "LMS"] as const
export type TaskScopeValue = (typeof TASK_SCOPE_VALUES)[number]

const TARGET_OPTIONS: Array<{
  value: TaskScopeValue
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    value: "FREELANCE",
    label: "Freelance project",
    description: "Client work",
    icon: BriefcaseBusiness,
  },
  {
    value: "LMS",
    label: "LMS",
    description: "My job",
    icon: GraduationCap,
  },
]

export function TaskTargetSelector({
  value,
  onValueChange,
  disabled,
  freelanceAvailable = true,
}: {
  value: TaskScopeValue
  onValueChange: (value: TaskScopeValue) => void
  disabled?: boolean
  freelanceAvailable?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Task target">
      {TARGET_OPTIONS.map((option) => {
        const Icon = option.icon
        const selected = value === option.value
        const unavailable = option.value === "FREELANCE" && !freelanceAvailable
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || unavailable}
            title={unavailable ? "This task is not linked to a freelance project" : undefined}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex min-h-[76px] flex-col items-start justify-center rounded-xl border px-3 py-2.5 text-left transition",
              selected
                ? "border-[color:color-mix(in_srgb,var(--primary)_54%,var(--line-subtle))] bg-[color:color-mix(in_srgb,var(--primary-container)_14%,var(--surface-lowest))] text-[var(--text-primary)] shadow-sm"
                : "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)]",
              (disabled || unavailable) && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="flex items-start gap-2 text-sm font-semibold leading-tight">
              <Icon className={cn("h-4 w-4 shrink-0", selected && "text-[var(--primary)]")} />
              {option.label}
            </span>
            <span className="mt-0.5 pl-6 text-xs text-[var(--text-muted)]">{option.description}</span>
          </button>
        )
      })}
    </div>
  )
}

function LmsOptionCombobox({
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  options,
  value,
  onValueChange,
  onCreateRequest,
  createLabel,
  disabled,
}: {
  label: string
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  options: Array<{ id: string; label: string }>
  value: string
  onValueChange: (value: string) => void
  onCreateRequest?: (suggestedName: string) => void
  createLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const selected = options.find((option) => option.id === value)

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-12 w-full justify-between rounded-xl border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-left font-normal",
            selected && "border-[color:color-mix(in_srgb,var(--primary)_44%,var(--line-subtle))]"
          )}
        >
          <span className={cn("truncate", !selected && "text-[var(--text-muted)]")}>{selected?.label || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="not linked"
                onSelect={() => {
                  onValueChange("")
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                Not linked yet
              </CommandItem>
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
              {onCreateRequest ? (
                <CommandItem
                  value={`create ${createLabel || "option"} ${search}`}
                  onSelect={() => {
                    const suggestedName = search.trim()
                    changeOpen(false)
                    onCreateRequest(suggestedName)
                  }}
                  className="border-t border-[var(--line-subtle)] text-[var(--primary)]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="truncate">
                    {search.trim() ? `Create ${createLabel || "option"} “${search.trim()}”` : `Create ${createLabel || "option"}`}
                  </span>
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function TaskLmsFields({
  lmsAllocationId,
  lmsTaskTypeId,
  onAllocationChange,
  onWorkTaskChange,
  disabled,
  required = false,
  compact = false,
}: {
  lmsAllocationId: string
  lmsTaskTypeId: string
  onAllocationChange: (value: string) => void
  onWorkTaskChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  compact?: boolean
}) {
  const { lmsOptions, lmsOptionsLoading, lmsOptionsError, loadLmsOptions } = useTaskCompletion()
  const [addProjectOpen, setAddProjectOpen] = React.useState(false)
  const [addProjectInitialName, setAddProjectInitialName] = React.useState("")

  React.useEffect(() => {
    void loadLmsOptions()
  }, [loadLmsOptions])

  return (
    <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-semibold text-[var(--text-secondary)]">
            LMS project{required ? " *" : " (optional)"}
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-semibold text-[var(--primary)]"
            disabled={disabled}
            onClick={() => {
              setAddProjectInitialName("")
              setAddProjectOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        </div>
        <LmsOptionCombobox
          label="Select LMS project"
          placeholder={lmsOptionsLoading ? "Loading LMS projects…" : "Not linked yet"}
          searchPlaceholder="Search LMS project…"
          emptyLabel="No LMS project found."
          options={lmsOptions.allocations.map((option) => ({ id: option.id, label: option.client }))}
          value={lmsAllocationId}
          onValueChange={onAllocationChange}
          onCreateRequest={(suggestedName) => {
            setAddProjectInitialName(suggestedName)
            setAddProjectOpen(true)
          }}
          createLabel="LMS project"
          disabled={disabled || lmsOptionsLoading}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-[var(--text-secondary)]">
          Work category{required ? " *" : " (optional)"}
        </Label>
        <LmsOptionCombobox
          label="Select LMS work category"
          placeholder={lmsOptionsLoading ? "Loading categories…" : "Not linked yet"}
          searchPlaceholder="Search work category…"
          emptyLabel="No active work category found."
          options={lmsOptions.workTasks.map((option) => ({ id: option.id, label: option.name }))}
          value={lmsTaskTypeId}
          onValueChange={onWorkTaskChange}
          disabled={disabled || lmsOptionsLoading}
        />
      </div>
      {lmsOptionsError ? (
        <p className="text-xs font-medium text-[var(--state-urgent)] sm:col-span-2">
          {lmsOptionsError}{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => void loadLmsOptions(true)}>
            Retry
          </button>
        </p>
      ) : null}
      <AddLmsClientDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        initialName={addProjectInitialName}
        wording="project"
        onCreated={(client) => {
          onAllocationChange(client.id)
          void loadLmsOptions(true)
        }}
      />
    </div>
  )
}

export function TaskFreelanceProjectField({
  projectId,
  onProjectChange,
  disabled,
}: {
  projectId: string
  onProjectChange: (value: string) => void
  disabled?: boolean
}) {
  const { lmsOptions, lmsOptionsLoading, lmsOptionsError, loadLmsOptions } = useTaskCompletion()

  React.useEffect(() => {
    void loadLmsOptions()
  }, [loadLmsOptions])

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-[var(--text-secondary)]">Freelance project *</Label>
      <LmsOptionCombobox
        label="Select freelance project"
        placeholder={lmsOptionsLoading ? "Loading freelance projects…" : "Select a freelance project"}
        searchPlaceholder="Search freelance project…"
        emptyLabel="No freelance project found."
        options={lmsOptions.projects.map((option) => ({ id: option.id, label: option.label }))}
        value={projectId}
        onValueChange={onProjectChange}
        disabled={disabled || lmsOptionsLoading}
      />
      {!projectId ? (
        <p className="text-xs leading-5 text-[var(--text-muted)]">Choose the CRM project this freelance task belongs to.</p>
      ) : null}
      {lmsOptionsError ? (
        <p className="text-xs font-medium text-[var(--state-urgent)]">
          {lmsOptionsError}{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => void loadLmsOptions(true)}>
            Retry
          </button>
        </p>
      ) : null}
    </div>
  )
}
