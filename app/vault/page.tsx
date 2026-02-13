import prisma from "@/lib/prisma"
import { CreatePartnerDialog } from "@/components/vault/create-partner-dialog"
import { PartnerCard } from "@/components/vault/partner-card"
import { CreateSiteDialog } from "@/components/vault/create-site-dialog"
import { SitesTable } from "@/components/vault/sites-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Database, Users, Globe, LayoutGrid, Layers, SortAsc, SortDesc, DollarSign, Type, TrendingUp, BarChart3, PieChartIcon } from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PartnerRevenueChart } from "@/components/vault/partner-revenue-chart"
import { Card } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function VaultPage({
    searchParams
}: {
    searchParams: Promise<{ page?: string; tab?: string; sortBy?: string; order?: string }>
}) {
    const params = await searchParams
    const activeTab = params.tab || "partners"
    const sortBy = params.sortBy || "name"
    const order = params.order || "asc"

    const page = parseInt(params.page || "1")
    const pageSize = 10
    const skip = (page - 1) * pageSize

    // Fetch partners with site projects and billing data
    const partnersRaw = await prisma.partner.findMany({
        include: {
            _count: {
                select: { sites: true },
            },
            sites: {
                include: {
                    projects: {
                        select: {
                            status: true,
                            paymentStatus: true,
                            currentFee: true
                        }
                    }
                }
            }
        },
        orderBy: sortBy === "name" ? { name: order as any } : { createdAt: "desc" },
    })

    let partnersSerialized = JSON.parse(JSON.stringify(partnersRaw))

    // Calculate revenue for analysis
    const analysisData = partnersSerialized.map((p: any) => {
        const revenue = p.sites?.flatMap((s: any) => s.projects).reduce((sum: number, pr: any) => sum + (Number(pr.currentFee) || 0), 0) || 0
        return {
            name: p.name,
            revenue
        }
    })

    // Manual sorting for Revenue if requested
    if (sortBy === "revenue") {
        partnersSerialized.sort((a: any, b: any) => {
            const revA = a.sites?.flatMap((s: any) => s.projects).reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0) || 0
            const revB = b.sites?.flatMap((s: any) => s.projects).reduce((sum: number, p: any) => sum + (Number(p.currentFee) || 0), 0) || 0
            return order === "asc" ? revA - revB : revB - revA
        })
    }

    // Fetch sites with pagination
    const sitesPromise = prisma.site.findMany({
        skip,
        take: pageSize,
        include: {
            partner: true,
            _count: {
                select: { projects: true }
            }
        },
        orderBy: { createdAt: "desc" }
    })

    const totalSitesPromise = prisma.site.count()

    const [sitesRaw, totalSites] = await Promise.all([
        sitesPromise,
        totalSitesPromise
    ])

    const sites = JSON.parse(JSON.stringify(sitesRaw))
    const totalPages = Math.ceil(totalSites / pageSize)

    // Fetch all partners for CreateSiteDialog
    const allPartners = partnersSerialized.map((p: any) => ({ id: p.id, name: p.name }))

    const getSortLink = (newSortBy: string) => {
        const newOrder = sortBy === newSortBy && order === "asc" ? "desc" : "asc"
        return `/vault?tab=partners&sortBy=${newSortBy}&order=${newOrder}`
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header & Controls Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">
                    Partners
                </h1>

                <div className="flex items-center gap-4">
                    {/* Sorting UI */}
                    {/* Sorting UI */}
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/vault?tab=partners&sortBy=${sortBy === 'name' ? 'revenue' : 'name'}&order=${order}`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-[0.1em]",
                                sortBy === "name"
                                    ? "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:bg-muted/50"
                                    : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                            )}
                        >
                            {sortBy === "name" ? <Type className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
                            {sortBy === "name" ? "Name" : "Revenue"}
                        </Link>

                        <Link
                            href={`/vault?tab=partners&sortBy=${sortBy}&order=${order === 'asc' ? 'desc' : 'asc'}`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:bg-muted/50 transition-all text-[10px] font-bold uppercase tracking-[0.1em]"
                            )}
                        >
                            {order === "asc" ? <SortAsc className="h-3.5 w-3.5" /> : <SortDesc className="h-3.5 w-3.5" />}
                            {order === "asc" ? "Asc" : "Desc"}
                        </Link>
                    </div>
                    <CreatePartnerDialog />
                </div>
            </div>

            <div className="flex flex-col gap-6">

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {partnersSerialized.map((partner: any) => (
                        <PartnerCard
                            key={partner.id}
                            partner={partner}
                        />
                    ))}
                    {partnersSerialized.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-muted/20 border-2 border-dashed rounded-2xl">
                            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm font-bold text-muted-foreground">No partners found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ")
}
