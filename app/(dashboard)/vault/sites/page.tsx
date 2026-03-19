import prisma from "@/lib/prisma"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { requireTenantContext } from "@/lib/tenant"
import { DomainsFilters } from "@/components/vault/domains-filters"
import { cn } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

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
        <div className="flex flex-col gap-8 pb-8">
            <PageHeader title="Domains" actions={<CreateSiteDialog partners={partners} />} />

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
                <div className="flex items-center justify-between px-6 py-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                        Page {page} of {totalPages || 1} · {totalSites} Total Domains
                    </p>
                    
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild={page > 1}
                            disabled={page <= 1}
                            className={cn(
                                "h-9 px-4 rounded-xl border border-slate-200 bg-white shadow-sm transition-all active:scale-95 text-xs font-bold uppercase tracking-wider",
                                page <= 1 ? "opacity-40" : "hover:bg-slate-50 hover:text-blue-600"
                            )}
                        >
                            {page > 1 ? (
                                <Link href={buildPageHref(page - 1)} className="flex items-center gap-2">
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Link>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </span>
                            )}
                        </Button>
                        
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild={page < totalPages}
                            disabled={page >= totalPages}
                            className={cn(
                                "h-9 px-4 rounded-xl border border-slate-200 bg-white shadow-sm transition-all active:scale-95 text-xs font-bold uppercase tracking-wider",
                                page >= totalPages ? "opacity-40" : "hover:bg-slate-50 hover:text-blue-600"
                            )}
                        >
                            {page < totalPages ? (
                                <Link href={buildPageHref(page + 1)} className="flex items-center gap-2">
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            ) : (
                                <span className="flex items-center gap-2">
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
