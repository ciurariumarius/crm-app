import prisma from "@/lib/prisma"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import Link from "next/link"
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header"
import { requireAuth } from "@/lib/auth"
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
    await requireAuth()
    const { q, partnerId, page: pageStr, sort = "domainName", order = "asc" } = await searchParams
    const page = parseInt(pageStr || "1")
    const skip = (page - 1) * PAGE_SIZE

    const where: Prisma.SiteWhereInput = {}
    
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
            <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-[var(--shadow-apple)] sm:p-5 lg:p-6">
                <DashboardPageHeader
                    title="Domains"
                    actions={<CreateSiteDialog partners={partners} label="Add" showLabelOnMobile className="!h-11 !w-auto !min-w-0 !rounded-[20px] !px-8 !gap-2 !text-white xl:!px-9" />}
                    mobileActions={
                        <CreateSiteDialog
                            partners={partners}
                            label="Add"
                            showLabelOnMobile
                            className="!h-11 !w-auto !min-w-0 !rounded-[20px] !px-8 !gap-2 !text-white xl:!px-9"
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
                <div className="flex items-center justify-between rounded-[14px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-3 py-2 shadow-[var(--shadow-apple)] sm:px-4">
                    <span className="inline-flex h-8 items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-2.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {page}/{totalPages || 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                        {page > 1 ? (
                            <Link
                                href={buildPageHref(page - 1)}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-[var(--surface-low)] hover:text-blue-600" })}
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)]/70 text-[var(--text-muted)]" aria-hidden="true">
                                <ChevronLeft className="h-4 w-4" />
                            </span>
                        )}

                        {page < totalPages ? (
                            <Link
                                href={buildPageHref(page + 1)}
                                className={buttonLinkClassName({ size: "md", variant: "subtle", emphasis: "strong", className: "h-8 w-8 p-0 hover:bg-[var(--surface-low)] hover:text-blue-600" })}
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)]/70 text-[var(--text-muted)]" aria-hidden="true">
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
