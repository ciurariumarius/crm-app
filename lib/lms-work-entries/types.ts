import type { LmsWorkExportStatus } from "@/lib/lms-work-entries/filters"

export type LmsWorkClientOption = {
  id: string
  client: string
}

export type LmsWorkTaskOption = {
  id: string
  name: string
  isActive: boolean
  defaultDurationMinutes: number | null
}

export type LmsWorkEntryFilterOption = {
  id: string
  label: string
}

export type LmsWorkEntryRow = {
  id: string
  lmsAllocationId: string | null
  taskTypeId: string
  workDate: string
  durationMinutes: number
  clientDomain: string
  taskName: string
  employeeName: string
  exportedAt: string | null
  createdAt: string
  updatedAt: string
}

export type LmsWorkEntryInput = {
  workDate: string
  lmsAllocationId: string
  taskTypeId: string
  durationMinutes: number
}

export type LmsWorkEntryUpdateInput = Omit<LmsWorkEntryInput, "lmsAllocationId"> & {
  lmsAllocationId: string | null
}

export type LmsWorkLogPageData = {
  clients: LmsWorkClientOption[]
  tasks: LmsWorkTaskOption[]
  frequentClients: LmsWorkClientOption[]
  frequentTasks: LmsWorkTaskOption[]
  frequentDurations: number[]
  dateFilterOptions: string[]
  clientFilterOptions: LmsWorkEntryFilterOption[]
  taskFilterOptions: LmsWorkEntryFilterOption[]
  entries: LmsWorkEntryRow[]
  totalEntries: number
  allMatchingEntries: number
  unexportedEntries: number
  totalMinutes: number
  workedDays: number
  firstWorkDate: string | null
  lastWorkDate: string | null
  page: number
  pageSize: number
  totalPages: number
  from: string | null
  to: string | null
  workDate: string | null
  clientId: string | null
  taskId: string | null
  exportStatus: LmsWorkExportStatus
}

export type LmsWorkExportEntry = {
  workDate: string
  clientDomainSnapshot: string
  taskNameSnapshot: string
  employeeNameSnapshot: string
  durationMinutes: number
}

export type LmsWorkRecurrenceInput = {
  lmsAllocationId: string
  taskTypeId: string
  durationMinutes: number
  weekdays: number[]
}

export type LmsWorkRecurrenceRow = {
  id: string
  lmsAllocationId: string | null
  taskTypeId: string
  clientName: string
  taskName: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  startsOn: string | null
  processedThrough: string | null
  lastRunAt: string | null
  clientDetached: boolean
  taskInactive: boolean
}

export type LmsWorkRecurrencePageData = {
  clients: LmsWorkClientOption[]
  tasks: LmsWorkTaskOption[]
  recurrences: LmsWorkRecurrenceRow[]
}
