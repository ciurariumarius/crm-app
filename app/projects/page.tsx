import prisma from "@/lib/prisma"
import Link from "next/link"
import { Briefcase, Globe, Users, Search as SearchIcon, Filter, X, CreditCard, CheckCircle2, AlertCircle, Plus, LayoutGrid, List } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns"
import { CreateProjectButton } from "@/components/projects/create-project-button"
import { ProjectsTable } from "@/components/projects/projects-table"
import { ProjectsToolbar } from "@/components/projects/projects-toolbar"
import { MobileMenuTrigger } from "@/components/layout/mobile-menu-trigger"
import { cn } from "@/lib/utils"


export const dynamic = "force-dynamic"

export default async function MasterProjectsPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; status?: string; partnerId?: string; payment?: string; recurring?: string; period?: string; layout?: string }>
}) {
    const params = await searchParams
    const queryStatus = params.status || "Active"
    const q = params.q
    const partnerId = params.partnerId
    const payment = params.payment || "All"
    const recurring = params.recurring || "All"
    const period = params.period || "all_time"
    const layout = params.layout || "grid"

    let dateFilter: any = {}
    const now = new Date()

    if (period === "this_month") {
        dateFilter = {
            createdAt: {
                gte: startOfMonth(now),
                lte: endOfMonth(now)
            }
        }
    } else if (period === "last_month") {
        const lastMonth = subMonths(now, 1)
        dateFilter = {
            createdAt: {
                gte: startOfMonth(lastMonth),
                lte: endOfMonth(lastMonth)
            }
        }
    } else if (period === "this_year") {
        dateFilter = {
            createdAt: {
                gte: startOfYear(now),
                lte: endOfYear(now)
            }
        }
    } else if (period === "last_year") {
        const lastYear = subYears(now, 1)
        dateFilter = {
            createdAt: {
                gte: startOfYear(lastYear),
                lte: endOfYear(lastYear)
            }
        }
    }

    // Fetch partner details if we have a partnerId filter
    const filteredPartner = partnerId
        ? await prisma.partner.findUnique({ where: { id: partnerId } })
        : null

    // Fetch all projects with expanded details for the table view
    const projectsPromise = prisma.project.findMany({
        where: {
            AND: [
                queryStatus === "All" ? {} : { status: queryStatus },
                payment === "All" ? {} : { paymentStatus: payment },
                partnerId ? { site: { partnerId } } : {},
                recurring === "Recurring" ? { services: { some: { isRecurring: true } } } :
                    recurring === "OneTime" ? { services: { some: { isRecurring: false } } } : {},
                dateFilter,
                q ? {
                    OR: [
                        { name: { contains: q } },
                        { site: { domainName: { contains: q } } },
                        { services: { some: { serviceName: { contains: q } } } },
                        { site: { partner: { name: { contains: q } } } }
                    ]
                } : {}
            ]
        },
        include: {
            site: {
                include: {
                    partner: true
                }
            },
            services: true,
            tasks: {
                include: {
                    timeLogs: true
                }
            },
            _count: {
                select: { tasks: true }
            }
        },
        orderBy: { updatedAt: "desc" }
    })

    // Fetch data for context
    const partnersPromise = prisma.partner.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    })

    // Reuse partnersPromise for the dialog as well
    const partnersFullPromise = prisma.partner.findMany({
        include: {
            sites: {
                select: { id: true, domainName: true }
            }
        },
        orderBy: { name: "asc" }
    })

    const servicesPromise = prisma.service.findMany({
        orderBy: { serviceName: "asc" }
    })

    const [projectsRaw, partnersListRaw, partnersFullRaw, servicesRaw] = await Promise.all([
        projectsPromise,
        partnersPromise,
        partnersFullPromise,
        servicesPromise
    ])

    const projects = JSON.parse(JSON.stringify(projectsRaw))
    const partnersList = JSON.parse(JSON.stringify(partnersListRaw))
    const partnersFull = JSON.parse(JSON.stringify(partnersFullRaw))
    const services = JSON.parse(JSON.stringify(servicesRaw))

    const periodsLabel: Record<string, string> = {
        this_month: "This Month",
        last_month: "Last Month",
        this_year: "This Year",
        last_year: "Last Year",
        all_time: "All Time"
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        <MobileMenuTrigger />
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground md:pl-0 leading-none flex items-center h-full">
                            Projects
                        </h1>
                    </div>
                    {/* Mobile Only Header Actions */}
                    <div className="flex md:hidden items-center gap-2">
                        <CreateProjectButton
                            partners={partnersFull as any}
                            services={services as any}
                        />
                    </div>
                </div>

                {/* Subtitle Space (hidden on mobile, aligned on desktop) */}
                <div className="hidden md:flex flex-col gap-2">
                    <div className="hidden md:flex h-10 w-10"></div>
                </div>

                {/* Desktop Header Actions */}
                <div className="hidden md:flex items-center gap-3 self-end md:self-auto">
                    {/* Layout Toggle */}
                    <div className="hidden xl:flex items-center p-1 bg-white dark:bg-zinc-900 rounded-[14px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-border/60 h-10 px-1">
                        <Link prefetch={false} scroll={false} href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=${period}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}&layout=list`} className={cn("p-1.5 rounded-lg transition-colors group", layout === 'list' ? "bg-muted shadow-sm" : "hover:bg-muted/50")}>
                            <List className={cn("w-4 h-4", layout === 'list' ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                        </Link>
                        <Link prefetch={false} scroll={false} href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=${period}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}&layout=grid`} className={cn("p-1.5 rounded-lg transition-colors group", layout === 'grid' ? "bg-muted shadow-sm" : "hover:bg-muted/50")}>
                            <LayoutGrid className={cn("w-4 h-4", layout === 'grid' ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                        </Link>
                    </div>
                    <CreateProjectButton
                        partners={partnersFull as any}
                        services={services as any}
                    />
                </div>
            </div>

            {/* Unified Filter Toolbar */}
            <ProjectsToolbar partners={partnersList} />

            {/* Active Filter Chips */}
            {(partnerId || q || payment !== "All" || recurring !== "All" || period !== "all_time") && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mr-2">Filters Active:</span>
                    {partnerId && filteredPartner && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=${period}${q ? `&q=${q}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:bg-primary/10 transition-colors"
                        >
                            Partner: {filteredPartner.name}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {period !== "all_time" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=all_time${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:bg-blue-100 transition-colors"
                        >
                            Date: {periodsLabel[period]}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {recurring !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=All&period=${period}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-violet-50 text-violet-600 border border-violet-200 rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:bg-violet-100 transition-colors"
                        >
                            Type: {recurring === "Recurring" ? "Recurring" : "One-Time"}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {payment !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=All&recurring=${recurring}&period=${period}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1 border rounded-xl text-xs font-bold uppercase tracking-[0.15em] transition-colors",
                                payment === "Paid" ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                            )}
                        >
                            {payment === "Paid" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            Payment: {payment}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {q && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=${period}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-muted/50 text-muted-foreground border border-border rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:bg-muted transition-colors"
                        >
                            Search: {q}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                </div>
            )}

            <ProjectsTable projects={projects} allServices={services} layout={layout as "grid" | "list"} />
        </div>
    )
}
