import prisma from "@/lib/prisma"
import Link from "next/link"
import { Briefcase, Globe, Users, Search as SearchIcon, Filter, X, CreditCard, CheckCircle2, AlertCircle, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns"
import { CreateProjectButton } from "@/components/projects/create-project-button"
import { ProjectsTable } from "@/components/projects/projects-table"
import { ProjectsToolbar } from "@/components/projects/projects-toolbar"
import { cn } from "@/lib/utils"


export const dynamic = "force-dynamic"

export default async function MasterProjectsPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; status?: string; partnerId?: string; payment?: string; recurring?: string; period?: string }>
}) {
    const params = await searchParams
    const queryStatus = params.status || "Active"
    const q = params.q
    const partnerId = params.partnerId
    const payment = params.payment || "All"
    const recurring = params.recurring || "All"
    const period = params.period || "all_time"

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
            <div className="flex h-10 items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground pl-14 md:pl-0">
                    Projects
                </h1>
                <CreateProjectButton
                    partners={partnersFull as any}
                    services={services as any}
                />
            </div>

            {/* Unified Filter Toolbar */}
            <ProjectsToolbar partners={partnersList} />

            {/* Active Filter Chips */}
            {(partnerId || q || payment !== "All" || recurring !== "All" || period !== "all_time") && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mr-2">Filters Active:</span>
                    {partnerId && filteredPartner && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=${period}${q ? `&q=${q}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary border border-primary/20 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-primary/10 transition-colors"
                        >
                            Partner: {filteredPartner.name}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {period !== "all_time" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=${recurring}&period=all_time${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-500/5 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-blue-500/10 transition-colors"
                        >
                            Date: {periodsLabel[period]}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {recurring !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=${payment}&recurring=All&period=${period}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className="flex items-center gap-2 px-3 py-1 bg-violet-500/5 text-violet-400 border border-violet-500/20 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-violet-500/10 transition-colors"
                        >
                            Type: {recurring === "Recurring" ? "Recurring" : "One-Time"}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                    {payment !== "All" && (
                        <Link
                            href={`/projects?status=${queryStatus}&payment=All&recurring=${recurring}&period=${period}${q ? `&q=${q}` : ""}${partnerId ? `&partnerId=${partnerId}` : ""}`}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1 border rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] transition-colors",
                                payment === "Paid" ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10" : "bg-rose-500/5 text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
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
                            className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] text-muted-foreground border border-white/[0.05] rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-white/[0.06] transition-colors"
                        >
                            Search: {q}
                            <X className="h-3 w-3" />
                        </Link>
                    )}
                </div>
            )}

            <ProjectsTable projects={projects} allServices={services} />
        </div>
    )
}
