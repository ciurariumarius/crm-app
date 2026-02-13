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
            {/* Header section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">
                    The Vault
                </h1>

            </div>

            <Tabs defaultValue={activeTab} className="space-y-8">
                <div className="flex items-center justify-between border-b pb-1">
                    <TabsList className="bg-transparent h-auto p-0 gap-8">
                        <TabsTrigger
                            value="partners"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-4 text-xs font-bold uppercase tracking-[0.15em] transition-all"
                            asChild
                        >
                            <Link href="/vault?tab=partners">
                                <Users className="h-3 w-3 mr-2" /> Partners
                            </Link>
                        </TabsTrigger>
                        <TabsTrigger
                            value="sites"
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-4 text-xs font-bold uppercase tracking-[0.15em] transition-all"
                            asChild
                        >
                            <Link href="/vault?tab=sites">
                                <Globe className="h-3 w-3 mr-2" /> Sites
                            </Link>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="partners" className="mt-0 space-y-16 outline-none animate-in fade-in-50 duration-500">

                    {/* PARTNER LIST SECTION */}
                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">Partner Entities</h2>
                                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Directory of clients and billing profiles</p>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Sorting UI */}
                                <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-muted/50">
                                    <Link
                                        href={getSortLink("name")}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] rounded-xl transition-all",
                                            sortBy === "name" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        <Type className="h-3 w-3" />
                                        Alpha
                                        {sortBy === "name" && (order === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                                    </Link>
                                    <Link
                                        href={getSortLink("revenue")}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] rounded-xl transition-all",
                                            sortBy === "revenue" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        <DollarSign className="h-3 w-3" />
                                        Revenue
                                        {sortBy === "revenue" && (order === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                                    </Link>
                                </div>
                                <CreatePartnerDialog />
                            </div>
                        </div>

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

                    {/* PORTFOLIO COMPOSITION MOVED TO ANALYTICS */}
                </TabsContent>

                <TabsContent value="sites" className="mt-0 space-y-8 outline-none animate-in fade-in-50 duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">Active Sites</h2>
                            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Deployed domains and tracking IDs</p>
                        </div>
                        <CreateSiteDialog partners={allPartners as any} />
                    </div>

                    <SitesTable sites={sites} />

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                            <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild={page > 1}
                                    disabled={page <= 1}
                                    className="h-9 px-4 font-bold"
                                >
                                    {page > 1 ? (
                                        <Link href={`/vault?tab=sites&page=${page - 1}`}>
                                            <ChevronLeft className="h-4 w-4 mr-1" /> PREV
                                        </Link>
                                    ) : (
                                        <span className="flex items-center">
                                            <ChevronLeft className="h-4 w-4 mr-1" /> PREV
                                        </span>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild={page < totalPages}
                                    disabled={page >= totalPages}
                                    className="h-9 px-4 font-bold"
                                >
                                    {page < totalPages ? (
                                        <Link href={`/vault?tab=sites&page=${page + 1}`}>
                                            NEXT <ChevronRight className="h-4 w-4 ml-1" />
                                        </Link>
                                    ) : (
                                        <span className="flex items-center">
                                            NEXT <ChevronRight className="h-4 w-4 ml-1" />
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ")
}
