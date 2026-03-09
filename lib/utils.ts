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

export function formatProjectName(project: {
  site?: { domainName?: string },
  services?: { serviceName: string, isRecurring?: boolean }[],
  createdAt?: Date | string,
  siteName?: string // fallback
}) {
  const domain = project.site?.domainName || project.siteName || "Unknown Site"

  // Get unique service names
  const serviceNames = project.services && project.services.length > 0
    ? Array.from(new Set(project.services.map(s => s.serviceName))).join(" + ")
    : "No Service"

  // Check if any service is recurring
  const isRecurring = project.services?.some(s => s.isRecurring) ?? false

  if (isRecurring && project.createdAt) {
    const date = new Date(project.createdAt)
    const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' })
    return `${domain} - ${serviceNames} - ${monthYear}`
  }

  return `${domain} - ${serviceNames}`
}

export function formatRelativeDate(date: Date | string | number): string {
  const d = new Date(date)
  if (isToday(d)) {
    return `Today @ ${format(d, "HH:mm")}`
  }
  if (isYesterday(d)) {
    return `Yesterday @ ${format(d, "HH:mm")}`
  }
  return format(d, "dd MMM. yy, HH:mm")
}
