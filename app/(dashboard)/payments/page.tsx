import { getPaymentLogs } from "@/lib/actions/payment-actions"
import prisma from "@/lib/prisma"
import { requireTenantContext } from "@/lib/tenant"
import { PageHeader } from "@/components/layout/page-header"
import { PaymentsTable } from "@/components/payments/payments-table"
import { PaymentsFilters } from "@/components/payments/payments-filters"
import Link from "next/link"

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 50

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string; page?: string }>
}) {
    const session = await requireTenantContext()
    const { projectId, partnerId, page: pageParam } = await searchParams
    const page = Math.max(1, Number(pageParam) || 1)

    const [projects, partners, logsResult] = await Promise.all([
        prisma.project.findMany({
            where: { tenantId: session.tenantId },
            include: { site: true }
        }),
        prisma.partner.findMany({
            where: { tenantId: session.tenantId },
            select: { id: true, name: true }
        }),
        getPaymentLogs({
            projectId,
            partnerId,
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
        next.set("page", String(targetPage))
        return `/payments?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Payment Log"
                description="Comprehensive history of all project payment status changes and settlements."
            />

            <div className="flex flex-col gap-6">
                <PaymentsFilters
                    partners={partners}
                    projects={projects}
                />

                <div className="bg-card rounded-xl border border-border shadow-sm p-4 md:p-6">
                    <PaymentsTable
                        logs={logs}
                        projects={projects}
                    />

                    <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Page {page} of {totalPages} · {totalLogs} events</span>
                        <div className="flex items-center gap-2">
                            {prevPage ? (
                                <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildPageHref(prevPage)}>
                                    Previous
                                </Link>
                            ) : (
                                <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Previous</span>
                            )}
                            {nextPage ? (
                                <Link className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors" href={buildPageHref(nextPage)}>
                                    Next
                                </Link>
                            ) : (
                                <span className="px-3 py-1.5 rounded-md border border-border text-muted-foreground/50">Next</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
