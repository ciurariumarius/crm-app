import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// ... existing code ...
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip non-serializable values (Date, Decimal, etc.) for server→client transfer */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
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
