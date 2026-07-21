export type LmsWorkProjectOption = {
  id: string
  domainName: string
  displayName: string
}

export type LmsWorkTaskOption = {
  id: string
  name: string
  isActive: boolean
}

export type LmsWorkEntryRow = {
  id: string
  projectId: string | null
  taskTypeId: string
  workDate: string
  durationMinutes: number
  clientDomain: string
  taskName: string
  employeeName: string
  createdAt: string
  updatedAt: string
}

export type LmsWorkEntryInput = {
  workDate: string
  projectId: string
  taskTypeId: string
  durationMinutes: number
}

export type LmsWorkLogPageData = {
  projects: LmsWorkProjectOption[]
  tasks: LmsWorkTaskOption[]
  entries: LmsWorkEntryRow[]
  totalEntries: number
  totalMinutes: number
  page: number
  pageSize: number
  totalPages: number
  from: string | null
  to: string | null
}

export type LmsWorkExportEntry = {
  workDate: string
  clientDomainSnapshot: string
  taskNameSnapshot: string
  employeeNameSnapshot: string
  durationMinutes: number
}

