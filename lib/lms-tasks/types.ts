export type ServiceStatus = "Active" | "Inactive" | "Stopped" | "-"

export type TaskLog = {
  id: string
  date: string | null
  client: string
  taskName: string
  executant: string
  durationMinutes: number
  status: string
}

export type ClientAllocation = {
  client: string
  specialist: string
  seo: ServiceStatus
  gads: ServiceStatus
  fads: ServiceStatus
  tads: ServiceStatus
}

export type LmsModuleData = {
  tasks: TaskLog[]
  allocations: ClientAllocation[]
  lastUpdatedAt: string | null
  tasksSourceFile: string | null
  allocationsSourceFile: string | null
}

export type LmsDataAggregates = {
  totalMinutes: number
  datedTasks: number
  undatedTasks: number
  uniqueClients: number
  uniqueExecutants: number
  minDate: string | null
  maxDate: string | null
}

export type LmsPagedData = {
  rows: TaskLog[]
  allocations: ClientAllocation[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  aggregates: LmsDataAggregates
  lastUpdatedAt: string | null
  tasksSourceFile: string | null
  allocationsSourceFile: string | null
}

export type LmsSyncMode = "replace" | "merge"

export type LmsSyncSummary = {
  created: number
  updated: number
  unchanged: number
  deleted: number
  totalIncoming: number
  totalStored: number
}

export type LmsDateRange = {
  from: string | null
  to: string | null
}

export type ParseIssueLevel = "warning" | "error"

export type ParseIssue = {
  level: ParseIssueLevel
  message: string
}

export type ParseResult<T> = {
  records: T[]
  issues: ParseIssue[]
}

export type WorkVolumeStatus = "No Work" | "Low" | "Medium" | "Optimal" | "High" | "Extra"

export type MonthlyUtilizationRow = {
  monthKey: string
  monthLabel: string
  loggedMinutes: number
  capacityMinutes: number
  utilizationPercent: number
}

export type TeamWorkloadRow = {
  executant: string
  totalMinutes: number
  capacityMinutes: number
  capacityPercent: number
  internalPercent: number
}

export type MyProjectRow = {
  client: string
  totalMinutes: number
  lastTaskDate: string | null
  workVolumeStatus: WorkVolumeStatus
  services: {
    seo: ServiceStatus
    gads: ServiceStatus
    fads: ServiceStatus
    tads: ServiceStatus
  }
}

export type ClientExplorerRow = {
  client: string
  totalTasks: number
  totalMinutes: number
  executants: string[]
  latestTaskDate: string | null
}
