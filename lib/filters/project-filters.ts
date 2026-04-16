import { Prisma } from "@prisma/client"
import { normalizePeriodPreset, resolveUtcDateRange, type PeriodPreset } from "./date-range"

const PROJECT_STATUS_FILTER_VALUES = ["All", "Active", "Paused", "Completed", "Closed"] as const
const PROJECT_PAYMENT_FILTER_VALUES = ["All", "Paid", "Unpaid"] as const
const PROJECT_RECURRING_FILTER_VALUES = ["All", "Recurring", "OneTime"] as const

export type ProjectStatusFilter = (typeof PROJECT_STATUS_FILTER_VALUES)[number]
export type ProjectPaymentFilter = (typeof PROJECT_PAYMENT_FILTER_VALUES)[number]
export type ProjectRecurringFilter = (typeof PROJECT_RECURRING_FILTER_VALUES)[number]

export type ProjectFiltersInput = {
    q?: string | null
    projectId?: string | null
    status?: string | null
    payment?: string | null
    recurring?: string | null
    partnerId?: string | null
    period?: string | null
    from?: string | null
    to?: string | null
}

export type NormalizedProjectFilters = {
    q?: string
    projectId?: string
    status: ProjectStatusFilter
    payment: ProjectPaymentFilter
    recurring: ProjectRecurringFilter
    partnerId?: string
    period: PeriodPreset
    from?: string
    to?: string
}

function normalizeEnumValue<T extends readonly string[]>(
    rawValue: string | null | undefined,
    values: T,
    fallback: T[number]
): T[number] {
    if (!rawValue) return fallback
    return (values as readonly string[]).includes(rawValue) ? (rawValue as T[number]) : fallback
}

function normalizeOptionalText(value: string | null | undefined) {
    const normalized = value?.trim()
    return normalized ? normalized : undefined
}

export function normalizeProjectFilters(input: ProjectFiltersInput): NormalizedProjectFilters {
    const q = normalizeOptionalText(input.q)
    const projectId = normalizeOptionalText(input.projectId)
    const partnerId = normalizeOptionalText(input.partnerId)
    const from = normalizeOptionalText(input.from)
    const to = normalizeOptionalText(input.to)

    return {
        q,
        projectId: projectId && projectId !== "all" ? projectId : undefined,
        status: normalizeEnumValue(input.status, PROJECT_STATUS_FILTER_VALUES, "Active"),
        payment: normalizeEnumValue(input.payment, PROJECT_PAYMENT_FILTER_VALUES, "All"),
        recurring: normalizeEnumValue(input.recurring, PROJECT_RECURRING_FILTER_VALUES, "All"),
        partnerId: partnerId && partnerId !== "all" ? partnerId : undefined,
        period: normalizePeriodPreset(input.period),
        from,
        to,
    }
}

export function buildProjectWhereInput(input: {
    tenantId: string
    filters: NormalizedProjectFilters
    now?: Date
}): Prisma.ProjectWhereInput {
    const { tenantId, filters, now } = input
    const createdAtRange = resolveUtcDateRange({
        period: filters.period,
        from: filters.from,
        to: filters.to,
        now,
    })

    const createdAtFilter: Prisma.ProjectWhereInput =
        createdAtRange.gte || createdAtRange.lt
            ? {
                  createdAt: {
                      ...(createdAtRange.gte ? { gte: createdAtRange.gte } : {}),
                      ...(createdAtRange.lt ? { lt: createdAtRange.lt } : {}),
                  },
              }
            : {}

    return {
        AND: [
            { tenantId },
            filters.projectId ? { id: filters.projectId } : {},
            filters.status === "All" ? {} : { status: filters.status },
            filters.payment === "All" ? {} : { paymentStatus: filters.payment },
            filters.partnerId ? { site: { partnerId: filters.partnerId } } : {},
            filters.recurring === "Recurring"
                ? { services: { some: { isRecurring: true } } }
                : filters.recurring === "OneTime"
                  ? { services: { some: { isRecurring: false } } }
                  : {},
            createdAtFilter,
            filters.q
                ? {
                      OR: [
                          { name: { contains: filters.q } },
                          { site: { domainName: { contains: filters.q } } },
                          { services: { some: { serviceName: { contains: filters.q } } } },
                          { site: { partner: { name: { contains: filters.q } } } },
                      ],
                  }
                : {},
        ],
    }
}
