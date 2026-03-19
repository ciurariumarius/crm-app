import { getPaymentLogs } from "@/lib/actions/payment-actions"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { PaymentsTable } from "@/components/payments/payments-table"
import { PaymentsFilters } from "@/components/payments/payments-filters"
import { AddPartnerPaymentDialog } from "@/components/payments/add-partner-payment-dialog"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { buttonLinkClassName } from "@/components/ui/button-link"

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string; page?: string }>
}) {
    const session = await requireTenantContext()
    const { projectId, partnerId, q, page: pageParam } = await searchParams
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
            take: PAGE_SIZE,
            skip: (page - 1) * PAGE_SIZE,
        })
    ])

    const logs = logsResult.success && logsResult.data ? logsResult.data : []
    const totalLogs = logsResult.success ? logsResult.total ?? logs.length : 0
    const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE))
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (projectId) next.set("projectId", projectId)
        if (partnerId) next.set("partnerId", partnerId)
        if (q) next.set("q", q)
        next.set("page", String(targetPage))
        return `/payments?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <DashboardPageHeader
                title="Payment Log"
                actions={<AddPartnerPaymentDialog partners={partners} />}
                showMobile
            />

            <div className="flex flex-col gap-6">
                <PaymentsFilters
                    partners={partners}
                    projects={projects}
                    totalLogs={totalLogs}
                />

            <div className="flex flex-col">
                    <PaymentsTable
                        logs={logs}
                        projects={projects}
                    />

                    <div className="flex items-center justify-between px-6 py-8">
                        <div className="ui-overline flex items-center gap-2">
                            <span>Page {page} of {totalPages}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>{totalLogs} events</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {prevPage ? (
                                <Link
                                    href={buildPageHref(prevPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption" })}
                                >
                                    <ChevronLeft className="mr-1.5 h-4 w-4" />
                                    Previous
                                </Link>
                            ) : (
                                <span className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption opacity-40" })}>
                                    <ChevronLeft className="mr-1.5 h-4 w-4" />
                                    Previous
                                </span>
                            )}
                            {nextPage ? (
                                <Link
                                    href={buildPageHref(nextPage)}
                                    className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption" })}
                                >
                                    Next
                                    <ChevronRight className="ml-1.5 h-4 w-4" />
                                </Link>
                            ) : (
                                <span className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-9 px-4 ui-text-caption opacity-40" })}>
                                    Next
                                    <ChevronRight className="ml-1.5 h-4 w-4" />
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
