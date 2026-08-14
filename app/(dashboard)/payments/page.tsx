import { getPaymentLogs } from "@/lib/actions/payment-actions"
import prisma from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { PaymentsTable } from "@/components/payments/payments-table"
import { UnpaidByPartnerChart } from "@/components/payments/unpaid-by-partner-chart"
import { PaymentsFiltersClient } from "@/components/payments/payments-filters-client"
import { PaymentsAddPaymentAction } from "@/components/payments/payments-add-payment-action"
import { PaymentsSearchInput } from "@/components/payments/payments-search-input"
import { ChevronLeft, ChevronRight, Banknote, Users, History } from "lucide-react"
import Link from "next/link"
import { buttonLinkClassName } from "@/components/ui/button-link"
import { formatCurrency, formatProjectName, serialize, cn } from "@/lib/utils"
import { StatCard } from "@/components/ui/app-surface"

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50

type UnpaidBalanceSplit = {
    total: number
    recurring: number
    oneTime: number
}

function createUnpaidBalanceSplit(): UnpaidBalanceSplit {
    return {
        total: 0,
        recurring: 0,
        oneTime: 0,
    }
}

function addUnpaidAmount(bucket: UnpaidBalanceSplit, amount: number, isRecurring: boolean) {
    bucket.total += amount
    if (isRecurring) {
        bucket.recurring += amount
        return
    }
    bucket.oneTime += amount
}

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string; page?: string; timeRange?: string }>
}) {
    await requireAuth()
    const { projectId, partnerId, q, timeRange, page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)

    const [projects, partners, logsResult] = await Promise.all([
        prisma.project.findMany({
            include: { site: true, services: true }
        }),
        prisma.partner.findMany({
            select: { id: true, name: true }
        }),
        getPaymentLogs({
            projectId,
            partnerId,
            q,
            timeRange,
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
        })
    ])
    const oneTimeServices = await prisma.service.findMany({
        where: { isRecurring: false },
        select: { id: true, serviceName: true },
        orderBy: { serviceName: "asc" },
    })
    const paymentServiceOptions = oneTimeServices.map((service) => ({ id: service.id, name: service.serviceName }))

    const logs = logsResult.success && logsResult.data ? logsResult.data : []
    const partnerNameById = new Map(partners.map((partner) => [partner.id, partner.name]))
    const unpaidByPartnerMap = new Map<
        string,
        { id: string; name: string; totalUnpaid: number; unpaidProjects: { id: string; name: string; amount: number }[] }
    >()

    for (const project of projects) {
        if (project.paymentStatus !== "Unpaid") continue
        const partnerIdForProject = project.site?.partnerId
        if (!partnerIdForProject) continue

        const existing = unpaidByPartnerMap.get(partnerIdForProject) ?? {
            id: partnerIdForProject,
            name: partnerNameById.get(partnerIdForProject) || "Unknown partner",
            totalUnpaid: 0,
            unpaidProjects: [],
        }

        const amount = Number(project.currentFee || 0)
        existing.totalUnpaid += amount
        existing.unpaidProjects.push({
            id: project.id,
            name: formatProjectName(project),
            amount,
        })
        unpaidByPartnerMap.set(partnerIdForProject, existing)
    }

    const unpaidByPartner = Array.from(unpaidByPartnerMap.values())
        .map((entry) => ({
            ...entry,
            unpaidProjects: entry.unpaidProjects.sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.totalUnpaid - a.totalUnpaid)

    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthUnpaid = createUnpaidBalanceSplit()
    const previousMonthsUnpaid = createUnpaidBalanceSplit()

    for (const project of projects) {
        if (project.paymentStatus !== "Unpaid") continue
        const amount = Number(project.currentFee || 0)
        const isRecurring = project.services.some((service) => service.isRecurring)
        const targetBucket = project.createdAt >= currentMonthStart ? currentMonthUnpaid : previousMonthsUnpaid
        addUnpaidAmount(targetBucket, amount, isRecurring)
    }

    const partnersWithDebt = unpaidByPartner.length
    const totalOutstanding = currentMonthUnpaid.total + previousMonthsUnpaid.total

    const serializedProjects = serialize(projects)
    const serializedLogs = serialize(logs)
    const totalLogs = logsResult.success ? logsResult.total ?? logs.length : 0
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (projectId) next.set("projectId", projectId)
        if (partnerId) next.set("partnerId", partnerId)
        if (q) next.set("q", q)
        if (timeRange) next.set("timeRange", timeRange)
        next.set("page", String(targetPage))
        return `/payments?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-8 pb-10 sm:gap-10">
                <AppPageHeader
                    title="Payments"
                    search={<PaymentsSearchInput />}
                    mobileSearch={<PaymentsSearchInput />}
                    primaryAction={<PaymentsAddPaymentAction partners={partners} services={paymentServiceOptions} />}
                    mobilePrimaryAction={
                        <PaymentsAddPaymentAction
                            partners={partners}
                            services={paymentServiceOptions}
                            mobile
                        />
                    }
                />

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
                <StatCard className="md:col-span-2 xl:col-span-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="ui-overline">Total outstanding</p>
                            <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-[var(--state-urgent)] sm:text-[38px]">
                                {formatCurrency(totalOutstanding)}
                            </p>
                        </div>
                        <div className="ui-state-danger flex h-11 w-11 items-center justify-center rounded-[12px] border">
                            <Banknote className="h-4.5 w-4.5" />
                        </div>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Open balances across current and previous months.</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-[var(--text-secondary)]">Current month</p>
                                <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{formatCurrency(currentMonthUnpaid.total)}</p>
                            </div>
                            <p className="mt-2 text-xs text-[var(--text-muted)]">Recurring {formatCurrency(currentMonthUnpaid.recurring)} · One-time {formatCurrency(currentMonthUnpaid.oneTime)}</p>
                        </div>
                        <div className="rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-[var(--text-secondary)]">Previous months</p>
                                <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{formatCurrency(previousMonthsUnpaid.total)}</p>
                            </div>
                            <p className="mt-2 text-xs text-[var(--text-muted)]">Recurring {formatCurrency(previousMonthsUnpaid.recurring)} · One-time {formatCurrency(previousMonthsUnpaid.oneTime)}</p>
                        </div>
                    </div>
                </StatCard>

                <StatCard className="xl:col-span-3">
                    <div className="flex items-start justify-between gap-3">
                        <p className="ui-overline">Partners</p>
                        <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]">
                            <Users className="h-4.5 w-4.5" />
                        </div>
                    </div>
                    <div className="mt-5">
                        <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">{partnersWithDebt}</p>
                        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Partners carrying unpaid project balances.</p>
                    </div>
                </StatCard>

                <StatCard className="xl:col-span-3">
                    <div className="flex items-start justify-between gap-3">
                        <p className="ui-overline">Events</p>
                        <div className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)]">
                            <History className="h-4.5 w-4.5" />
                        </div>
                    </div>
                    <div className="mt-5">
                        <p className="text-[32px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">{totalLogs}</p>
                        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Payment updates, manual entries and settlements.</p>
                    </div>
                </StatCard>
            </section>

            <div className="flex flex-col gap-8 sm:gap-10">
                <UnpaidByPartnerChart partners={unpaidByPartner} />

                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex flex-col">
                            <h2 className="ui-text-title-sm text-[var(--text-primary)]">Transaction History</h2>
                            <p className="ui-text-caption">
                                Review payment changes and use Revert to unpaid on a partner settlement whenever you need to undo Mark all paid.
                            </p>
                        </div>
                    </div>

                <PaymentsFiltersClient
                    partners={partners}
                    projects={serializedProjects}
                    totalLogs={totalLogs}
                />

                <div className="space-y-6">
                    <PaymentsTable
                        logs={serializedLogs}
                        projects={serializedProjects}
                    />

                    {/* Pagination Footer */}
                    <div className="flex items-center justify-between rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 py-2 shadow-[var(--shadow-apple)] sm:px-4">
                        <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--text-primary)]">
                            {page}/{totalPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                            {prevPage ? (
                                <Link
                                    href={buildPageHref(prevPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] hover:text-blue-500" })}
                                    aria-label="Previous page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className={cn(buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0" }), "opacity-40 cursor-not-allowed")} aria-hidden="true">
                                    <ChevronLeft className="h-4 w-4" />
                                </span>
                            )}
                            {nextPage ? (
                                <Link
                                    href={buildPageHref(nextPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-[color:color-mix(in_srgb,var(--surface-low)_84%,transparent)] hover:text-blue-500" })}
                                    aria-label="Next page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className={cn(buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0" }), "opacity-40 cursor-not-allowed")} aria-hidden="true">
                                    <ChevronRight className="h-4 w-4" />
                                </span>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
