import prisma from "@/lib/prisma"
import { CreatePartnerDialog } from "@/components/vault/create-partner-dialog"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { PartnerCard } from "@/components/vault/partner-card"
import { Users, SortAsc, SortDesc, Type, BarChart3 } from "lucide-react"
import Link from "next/link"
import { requireAuth } from "@/lib/auth"
import { cn, formatProjectName } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export default async function VaultPage({
    searchParams
}: {
    searchParams: Promise<{ page?: string; tab?: string; sortBy?: string; order?: string; partnerId?: string }>
}) {
    await requireAuth()
    const params = await searchParams
    const sortBy = params.sortBy === "revenue" ? "revenue" : "name"
    const order: Prisma.SortOrder = params.order === "desc" ? "desc" : "asc"
    const partnerId = params.partnerId?.trim() || undefined

    type PartnerRow = Prisma.PartnerGetPayload<{
        include: {
            _count: { select: { sites: true } }
            sites: {
                include: {
                    projects: {
                        select: {
                            id: true
                            name: true
                            createdAt: true
                            status: true
                            paymentStatus: true
                            currentFee: true
                            _count: { select: { tasks: true } }
                            services: {
                                select: {
                                    serviceName: true
                                    isRecurring: true
                                }
                            }
                        }
                    }
                }
            }
        }
    }>

    // Fetch partners with site projects and billing data
    const partnersRaw = await prisma.partner.findMany({
        where: {
            ...(partnerId ? { id: partnerId } : {}),
        },
        include: {
            _count: {
                select: { sites: true },
            },
            sites: {
                include: {
                    projects: {
                        select: {
                            id: true,
                            name: true,
                            createdAt: true,
                            status: true,
                            paymentStatus: true,
                            currentFee: true,
                            _count: {
                                select: { tasks: true }
                            },
                            services: {
                                select: {
                                    serviceName: true,
                                    isRecurring: true,
                                },
                            },
                        }
                    }
                }
            }
        },
        orderBy: sortBy === "name" ? { name: order } : { createdAt: "desc" },
    })

    const buildPartnersHref = (nextSortBy: "name" | "revenue", nextOrder: Prisma.SortOrder) => {
        const next = new URLSearchParams()
        next.set("tab", "partners")
        next.set("sortBy", nextSortBy)
        next.set("order", nextOrder)
        if (partnerId) next.set("partnerId", partnerId)
        return `/partners?${next.toString()}`
    }

    const partnersWithUnpaidProjects = (partnersRaw as PartnerRow[]).map((partner) => {
        const normalizedSites = partner.sites.map((site) => ({
            ...site,
            projects: site.projects.map((project) => ({
                ...project,
                currentFee: Number(project.currentFee || 0),
            })),
        }))

        const allProjects = normalizedSites.flatMap((site) =>
            site.projects.map((project) => ({
                siteDomainName: site.domainName,
                ...project,
            }))
        )

        const totalTasks = normalizedSites.reduce(
            (siteSum, site) => siteSum + site.projects.reduce((projectSum, project) => projectSum + (project._count?.tasks || 0), 0),
            0
        )

        const unpaidProjects = allProjects
            .filter((project) => project.paymentStatus === "Unpaid" && Number(project.currentFee || 0) > 0)
            .map((project) => ({
                id: project.id,
                name: formatProjectName({
                    site: { domainName: project.siteDomainName },
                    services: project.services,
                    createdAt: project.createdAt,
                    name: project.name,
                }),
                amount: Number(project.currentFee || 0),
            }))

        return {
            ...partner,
            sites: normalizedSites,
            unpaidProjects,
            totalTasks,
        }
    })

    // Manual sorting for Revenue if requested
    if (sortBy === "revenue") {
        partnersWithUnpaidProjects.sort((a, b) => {
            const revA = a.sites.flatMap((site) => site.projects).reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)
            const revB = b.sites.flatMap((site) => site.projects).reduce((sum, project) => sum + (Number(project.currentFee) || 0), 0)
            return order === "asc" ? revA - revB : revB - revA
        })
    }

    return (
        <div className="flex flex-col gap-6 pb-20">
            <AppPageHeader
                title="Partners"
                subtitle="Review partner portfolios, revenue and outstanding project balances."
                primaryAction={<CreatePartnerDialog />}
                secondaryActions={
                    <>
                            <Link
                                href={buildPartnersHref(sortBy === "name" ? "revenue" : "name", order)}
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-[12px] border px-3 text-xs font-medium transition-colors",
                                    sortBy === "name"
                                        ? "border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)]"
                                        : "border-[color:color-mix(in_srgb,var(--primary)_28%,var(--line-subtle))] bg-[var(--sidebar-accent)] text-[var(--primary)]"
                                )}
                            >
                                {sortBy === "name" ? <Type className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
                                {sortBy === "name" ? "Name" : "Revenue"}
                            </Link>

                            <Link
                                href={buildPartnersHref(sortBy, order === "asc" ? "desc" : "asc")}
                                className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-low)]"
                            >
                                {order === "asc" ? <SortAsc className="h-3.5 w-3.5" /> : <SortDesc className="h-3.5 w-3.5" />}
                                {order === "asc" ? "Asc" : "Desc"}
                            </Link>
                    </>
                }
            />

            <div className="flex flex-col gap-6">

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {partnersWithUnpaidProjects.map((partner) => (
                        <PartnerCard
                            key={partner.id}
                            partner={partner}
                        />
                    ))}
                    {partnersWithUnpaidProjects.length === 0 && (
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
