import { getPaymentLogs } from "@/lib/actions/payment-actions"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { PaymentsTable } from "@/components/payments/payments-table"
import { UnpaidByPartnerChart } from "@/components/payments/unpaid-by-partner-chart"
import { PaymentsFiltersClient } from "@/components/payments/payments-filters-client"
import { PaymentsAddPaymentAction } from "@/components/payments/payments-add-payment-action"
import { ChevronLeft, ChevronRight, Banknote, Users, History } from "lucide-react"
import Link from "next/link"
import { buttonLinkClassName } from "@/components/ui/button-link"
import { formatCurrency, formatProjectName, serialize, cn } from "@/lib/utils"

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string; page?: string; timeRange?: string }>
}) {
    const session = await requireTenantContext()
    const { projectId, partnerId, q, timeRange, page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)

    const [projects, partners, logsResult] = await Promise.all([
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            include: { site: true, services: true }
        }),
        prisma.partner.findMany({
            where: { tenantId: session.tenantId },
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

    const totalUnpaidAmount = unpaidByPartner.reduce((sum, p) => sum + p.totalUnpaid, 0)
    const partnersWithDebt = unpaidByPartner.length

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
            <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                <DashboardPageHeader
                    title="Payments"
                    actions={<PaymentsAddPaymentAction partners={partners} />}
                    mobileActions={
                        <PaymentsAddPaymentAction
                            partners={partners}
                            mobile
                        />
                    }
                    showMobile
                />
            </div>

            {/* KPI Section */}
            <section className="grid gap-4 md:grid-cols-3">
                <article className="relative rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)] sm:p-5 lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <p className="ui-overline text-slate-400">Unpaid</p>
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50/80 text-rose-400 shadow-[0_4px_10px_rgba(244,63,94,0.06)]">
                            <Banknote className="h-4.5 w-4.5" />
                        </div>
                    </div>
                    <div className="mt-5">
                        <p className="text-[30px] font-bold leading-none tracking-tight text-rose-600 sm:text-[34px]">
                            {formatCurrency(totalUnpaidAmount)}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-500">Outstanding receivables that still need settlement.</p>
                    </div>
                </article>

                <article className="relative rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)] sm:p-5 lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <p className="ui-overline text-slate-400">Partners</p>
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 text-slate-400 shadow-[0_4px_10px_rgba(15,23,42,0.03)]">
                            <Users className="h-4.5 w-4.5" />
                        </div>
                    </div>
                    <div className="mt-5">
                        <p className="text-[30px] font-bold leading-none tracking-tight text-slate-900 sm:text-[34px]">{partnersWithDebt}</p>
                        <p className="mt-2 text-sm font-medium text-slate-500">Partners currently carrying unpaid project balances.</p>
                    </div>
                </article>

                <article className="relative rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_4px_14px_rgba(15,23,42,0.035)] sm:p-5 lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <p className="ui-overline text-slate-400">Events</p>
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/90 bg-white/90 text-slate-400 shadow-[0_4px_10px_rgba(15,23,42,0.03)]">
                            <History className="h-4.5 w-4.5" />
                        </div>
                    </div>
                    <div className="mt-5">
                        <p className="text-[30px] font-bold leading-none tracking-tight text-slate-900 sm:text-[34px]">{totalLogs}</p>
                        <p className="mt-2 text-sm font-medium text-slate-500">Recorded payment updates, manual entries, and settlements.</p>
                    </div>
                </article>
            </section>

            <div className="flex flex-col gap-8 sm:gap-10">
                <UnpaidByPartnerChart partners={unpaidByPartner} />

                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex flex-col">
                            <h2 className="ui-text-title-sm text-slate-900">Transaction History</h2>
                            <p className="text-[11px] font-medium text-slate-400">
                                Review payment changes, manual entries, and settlement events.
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
                    <div className="flex items-center justify-between rounded-[18px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 py-2 shadow-[0_4px_14px_rgba(15,23,42,0.03)] sm:px-4">
                        <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700">
                            {page}/{totalPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                            {prevPage ? (
                                <Link
                                    href={buildPageHref(prevPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-slate-50 hover:text-blue-600" })}
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
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-slate-50 hover:text-blue-600" })}
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
