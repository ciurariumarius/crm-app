import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isYesterday } from "date-fns"

// ... existing code ...
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip non-serializable values (Date, Decimal, etc.) for server→client transfer */
export function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data
  return JSON.parse(JSON.stringify(data, (key, value) => {
    // If it's a Prisma Decimal, convert to number
    if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || value._isDecimal)) {
      return Number(value)
    }
    return value
  }))
}

/** Formats numbers with a consistent locale to prevent hydration mismatches */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (isNaN(num)) return "0"
  // Using ro-RO for consistent dot separators (1.500) across server and client
  return num.toLocaleString('ro-RO')
}

/** Formats currency with a consistent locale to prevent hydration mismatches */
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (isNaN(num)) return "0 RON"

  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

type ProjectServiceInput = {
  serviceName?: string | null
  isRecurring?: boolean | null
}

function addMonthlyQualifier(serviceName: string): string {
  if (/\bmonthly\b/i.test(serviceName)) return serviceName

  const parts = serviceName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return `${serviceName} Monthly`

  const lastWord = parts.pop()
  return `${parts.join(" ")} Monthly ${lastWord}`
}

export function formatProjectServiceName(service: ProjectServiceInput): string {
  const baseName = (service.serviceName || "").trim()
  if (!baseName) return ""

  if (!service.isRecurring) return baseName
  return addMonthlyQualifier(baseName)
}

export function formatProjectServiceList(
  services: ProjectServiceInput[] | null | undefined,
  fallback = "No Service"
): string {
  if (!services || services.length === 0) return fallback

  const seen = new Set<string>()
  const normalized = services
    .map((service) => formatProjectServiceName(service))
    .filter(Boolean)
    .filter((serviceName) => {
      const key = serviceName.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return normalized.length > 0 ? normalized.join(", ") : fallback
}

export function formatProjectName(project: {
  site?: { domainName?: string | null } | null,
  services?: ProjectServiceInput[] | null,
  createdAt?: Date | string | null,
  siteName?: string // fallback
  name?: string | null
}) {
  const domain = (project.site?.domainName || project.siteName || "").trim()
  const serviceNames = formatProjectServiceList(project.services, "")
  const hasServiceNames = serviceNames.length > 0
  const leftPart = domain || project.name || "Unknown Site"

  const isRecurring = project.services?.some((service) => Boolean(service.isRecurring)) ?? false
  const createdDate = project.createdAt ? new Date(project.createdAt) : null
  const monthYear = createdDate && !Number.isNaN(createdDate.getTime())
    ? format(createdDate, "MMMM yyyy")
    : null

  const baseLabel = hasServiceNames ? `${leftPart} - ${serviceNames}` : leftPart

  if (isRecurring && monthYear) {
    return `${baseLabel} - ${monthYear}`
  }

  return baseLabel
}

export function formatRelativeDate(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined || date === "") return "—"

  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"

  if (isToday(d)) {
    return `Today @ ${format(d, "HH:mm")}`
  }
  if (isYesterday(d)) {
    return `Yesterday @ ${format(d, "HH:mm")}`
  }
  return format(d, "dd MMM. yy, HH:mm")
}
