import prisma from "@/lib/prisma"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import Link from "next/link"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { requireTenantContext } from "@/lib/tenant"
import { DomainsFilters } from "@/components/vault/domains-filters"
import type { Prisma } from "@prisma/client"
import { buttonLinkClassName } from "@/components/ui/button-link"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export default async function SitesPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; partnerId?: string; page?: string; sort?: string; order?: "asc" | "desc" }>
}) {
    const session = await requireTenantContext()
    const { q, partnerId, page: pageStr, sort = "domainName", order = "asc" } = await searchParams
    const page = parseInt(pageStr || "1")
    const skip = (page - 1) * PAGE_SIZE

    const where: Prisma.SiteWhereInput = { tenantId: session.tenantId }
    
    if (q) {
        where.OR = [
            { domainName: { contains: q } },
            { partner: { name: { contains: q } } }
        ]
    }
    
    if (partnerId && partnerId !== "all") {
        where.partnerId = partnerId
    }

    // Fetch sites with pagination
    const sitesPromise = prisma.site.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        include: {
            partner: true,
            _count: {
                select: { projects: true }
            }
        },
        orderBy: { [sort]: order }
    })

    const totalSitesPromise = prisma.site.count({ where })

    // Fetch partners for filters and dialog
    const partnersPromise = prisma.partner.findMany({
        where: { tenantId: session.tenantId },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })

    const [sitesRaw, totalSites, partners] = await Promise.all([
        sitesPromise,
        totalSitesPromise,
        partnersPromise
    ])

    const totalPages = Math.ceil(totalSites / PAGE_SIZE)

    const buildPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (q) next.set("q", q)
        if (partnerId && partnerId !== "all") next.set("partnerId", partnerId)
        if (sort !== "domainName") next.set("sort", sort)
        if (order !== "asc") next.set("order", order)
        next.set("page", String(targetPage))
        return `/domains?${next.toString()}`
    }

    return (
        <div className="flex flex-col gap-8 pb-8 sm:gap-10">
            <div className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:p-6">
                <DashboardPageHeader
                    title="Domains"
                    actions={<CreateSiteDialog partners={partners} label="Add" className="!h-10 !w-auto !min-w-0 !rounded-[16px] !px-2.5 !gap-1 !text-white md:!px-3" />}
                    mobileActions={
                        <CreateSiteDialog
                            partners={partners}
                            label="Add"
                            showLabelOnMobile
                            className="!h-10 !w-auto !min-w-0 !rounded-[16px] !px-2.5 !gap-1 !text-white md:!px-3"
                        />
                    }
                    showMobile
                />
            </div>

            <DomainsFilters 
                partners={partners} 
                totalLogs={totalSites} 
            />

            <div className="space-y-6">
                <SitesTable 
                    sites={sitesRaw} 
                    currentSort={sort}
                    currentOrder={order}
                />
                
                {/* Pagination Footer */}
                <div className="flex items-center justify-between rounded-[18px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 py-2 shadow-[0_4px_14px_rgba(15,23,42,0.03)] sm:px-4">
                    <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700">
                        {page}/{totalPages || 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {page > 1 ? (
                            <Link
                                href={buildPageHref(page - 1)}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-slate-50 hover:text-blue-600" })}
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100/70 text-slate-400" aria-hidden="true">
                                <ChevronLeft className="h-4 w-4" />
                            </span>
                        )}

                        {page < totalPages ? (
                            <Link
                                href={buildPageHref(page + 1)}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-slate-50 hover:text-blue-600" })}
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100/70 text-slate-400" aria-hidden="true">
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
