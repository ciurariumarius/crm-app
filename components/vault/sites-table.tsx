"use client"

import * as React from "react"
import {
    Globe,
    Briefcase,
    ExternalLink,
    ArrowDownUp
} from "lucide-react"
import { formatRelativeDate, cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import type { Site, Project } from "@prisma/client"
import { sidePanelClass } from "@/lib/ui/side-panels"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { StatusChip } from "@/components/ui/status-chip"
import { ListEmptyState } from "@/components/ui/list-state"

type SiteTableItem = Site & {
    partner: {
        id: string
        name: string
    }
    projects?: Project[]
    _count?: {
        projects: number
    }
}

interface SitesTableProps {
    sites: SiteTableItem[]
    currentSort?: string
    currentOrder?: "asc" | "desc"
}

export function SitesTable({ sites, currentSort, currentOrder }: SitesTableProps) {
    const [selectedSite, setSelectedSite] = React.useState<SiteTableItem | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()

    const toggleSort = (field: string) => {
        const nextOrder = currentSort === field && currentOrder === "asc" ? "desc" : "asc"
        const params = new URLSearchParams(searchParams.toString())
        params.set("sort", field)
        params.set("order", nextOrder)
        router.push(`/domains?${params.toString()}`)
    }

    const renderHeader = () => (
        <div className="mb-3 hidden h-12 w-full items-center rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-5 text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.03)] md:grid md:min-w-[980px] lg:min-w-[1240px] grid-cols-[minmax(260px,2fr)_190px_90px_110px_90px] lg:grid-cols-[minmax(400px,3fr)_250px_120px_140px_120px] gap-x-4">
            <button 
                onClick={() => toggleSort("domainName")}
                className="ui-overline flex items-center gap-1 text-left hover:text-primary transition-colors"
            >
                Domain name
                <ArrowDownUp className={cn("h-3 w-3", currentSort === "domainName" && "text-primary")} />
            </button>
            <div className="ui-overline">Partner</div>
            <div className="ui-overline text-center">Projects</div>
            <div className="ui-overline text-center">Website</div>
            <div className="ui-overline text-right">Created</div>
        </div>
    )

    const renderSiteRow = (site: SiteTableItem, index: number) => {
        const projectCount = site._count?.projects ?? site.projects?.length ?? 0
        
        const openWebsite = (e: React.MouseEvent) => {
            e.stopPropagation()
            const url = site.domainName.startsWith("http") ? site.domainName : `https://${site.domainName}`
            window.open(url, "_blank")
        }

        return (
            <div
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className="group stagger-row-enter premium-card relative grid min-h-[60px] items-center rounded-[20px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] px-5 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.03)] w-full cursor-pointer transition-all duration-300 hover:border-slate-300/80 hover:bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] md:min-w-[980px] lg:min-w-[1240px] grid-cols-[minmax(260px,2fr)_190px_90px_110px_90px] lg:grid-cols-[minmax(400px,3fr)_250px_120px_140px_120px] gap-x-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                style={{ animationDelay: `${index * 0.05}s` }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setSelectedSite(site)
                    }
                }}
            >
                {/* 1. Domain Branding */}
                <div className="min-w-0 pr-4">
                    <div className="flex flex-col">
                        <span className="font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors whitespace-nowrap overflow-x-auto hidescrollbar">
                            {site.domainName}
                        </span>
                        {site.name && (
                            <span className="ui-overline mt-1 leading-none text-slate-400">
                                {site.name}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Partner Column */}
                <div className="min-w-0 pr-4">
                    <span className="text-sm font-medium text-slate-500 truncate leading-snug">
                        {site.partner.name}
                    </span>
                </div>

                {/* 3. Project Count */}
                <div className="flex justify-center">
                    <StatusChip tone={projectCount > 0 ? "active" : "neutral"} size="sm" icon={<Briefcase className="h-3 w-3" />}>
                        {projectCount} Projects
                    </StatusChip>
                </div>

                {/* 4. Website Button */}
                <div className="flex items-center justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={openWebsite}
                        className="h-8 px-3 text-xs font-semibold tracking-[0.02em] gap-2 bg-white/50 hover:bg-white border-slate-200 transition-all shadow-sm"
                    >
                        Visit
                        <ExternalLink className="h-3 w-3" />
                    </Button>
                </div>

                {/* 5. Date */}
                <div className="flex items-center justify-end">
                    <span className="text-xs font-medium text-slate-500 font-mono tracking-tight text-right shrink-0 tabular-nums">
                        {formatRelativeDate(site.createdAt)}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto pb-6 hidescrollbar">
                <div className="flex flex-col gap-2 md:min-w-[980px] lg:min-w-[1240px]">
                    {sites.length > 0 && renderHeader()}
                    {sites.map((site, index) => renderSiteRow(site, index))}
                    
                    {sites.length === 0 && (
                        <ListEmptyState
                            title="No domains found"
                            description="Domain list is currently empty for this filter."
                            icon={<Globe className="h-5 w-5" />}
                            className="py-16"
                        />
                    )}
                </div>
            </div>

            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("narrow")}>
                    <SheetHeader className="sr-only">
                        <SheetTitle>Domain Details</SheetTitle>
                    </SheetHeader>
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => {
                                setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))
                            }}
                            onClose={() => setSelectedSite(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
