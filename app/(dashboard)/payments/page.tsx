import { getPaymentLogs } from "@/lib/actions/payment-actions"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { PaymentsTable } from "@/components/payments/payments-table"
import { PaymentsFilters } from "@/components/payments/payments-filters"
import { AddPartnerPaymentDialog } from "@/components/payments/add-partner-payment-dialog"
import { UnpaidByPartnerChart } from "@/components/payments/unpaid-by-partner-chart"
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
        <div className="flex flex-col gap-10 pb-10">
            <DashboardPageHeader
                title="Payments"
                actions={<AddPartnerPaymentDialog partners={partners} />}
                showMobile
            />

            {/* KPI Section */}
            <section>
                <div className="flex flex-col lg:flex-row overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                    <div className="flex-1 relative p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Total Unpaid Balance</p>
                            <Banknote className="h-8 w-8 text-rose-50 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6 flex items-end">
                            <div className="flex flex-col">
                                <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Immediate Action</p>
                                <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-rose-600">
                                    {formatCurrency(totalUnpaidAmount)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 relative p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-100">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Partner Debtors</p>
                            <Users className="h-8 w-8 text-slate-50 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6 flex items-end">
                            <div>
                                <p className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{partnersWithDebt}</p>
                                <p className="mt-1 text-[10px] italic text-slate-400">Unique partners with unpaid projects</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 relative p-6 lg:p-8">
                        <div className="flex items-start justify-between">
                            <p className="ui-overline text-slate-400">Transaction Events</p>
                            <History className="h-8 w-8 text-slate-50 absolute top-4 right-4" />
                        </div>
                        <div className="mt-6">
                            <p className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{totalLogs}</p>
                            <p className="mt-1 text-[10px] italic text-slate-400">Total recorded status changes</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="flex flex-col gap-10">
                <UnpaidByPartnerChart partners={unpaidByPartner} />

                <div className="flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="ui-text-title-sm text-slate-900">Transaction History</h2>
                    </div>

                <PaymentsFilters
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
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="ui-overline flex items-center gap-2">
                            <span className="text-slate-400">Showing</span>
                            <span className="font-bold text-slate-900">Page {page} of {totalPages}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="font-bold text-slate-900">{totalLogs} events</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {prevPage ? (
                                <Link
                                    href={buildPageHref(prevPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption hover:bg-slate-50 hover:text-blue-600" })}
                                >
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Previous
                                </Link>
                            ) : (
                                <span className={cn(buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption" }), "opacity-40 cursor-not-allowed")}>
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Previous
                                </span>
                            )}
                            {nextPage ? (
                                <Link
                                    href={buildPageHref(nextPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption hover:bg-slate-50 hover:text-blue-600" })}
                                >
                                    Next
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            ) : (
                                <span className={cn(buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption" }), "opacity-40 cursor-not-allowed")}>
                                    Next
                                    <ChevronRight className="ml-2 h-4 w-4" />
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
