"use client"

import * as React from "react"
import {
    Globe,
    Briefcase,
    ExternalLink,
    Tag,
    BarChart3,
    ArrowDownUp
} from "lucide-react"
import { formatRelativeDate, cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import type { Site, Project } from "@prisma/client"
import { sidePanelClass } from "@/lib/ui/side-panels"

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
}

export function SitesTable({ sites }: SitesTableProps) {
    const [selectedSite, setSelectedSite] = React.useState<SiteTableItem | null>(null)

    const renderHeader = () => (
        <div className="hidden md:grid h-10 items-center px-6 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 w-full md:min-w-[1240px] grid-cols-[minmax(400px,3fr)_250px_120px_140px_120px] gap-x-4">
            <div className="flex items-center gap-1">
                Domain name
                <ArrowDownUp className="h-3 w-3" />
            </div>
            <div>Partner</div>
            <div className="text-center">Projects</div>
            <div className="text-center">Assets</div>
            <div className="text-right">Created</div>
        </div>
    )

    const renderSiteRow = (site: SiteTableItem, index: number) => {
        const projectCount = site._count?.projects ?? site.projects?.length ?? 0
        const hasGtm = !!site.gtmId
        const hasAds = !!site.googleAdsId
        const hasDrive = !!site.driveLink

        return (
            <div
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className="group stagger-row-enter premium-card relative grid min-h-[56px] items-center bg-white rounded-xl py-2.5 px-6 border border-border/60 w-full cursor-pointer hover:bg-[#F1F5F9] transition-all duration-300 md:min-w-[1240px] grid-cols-[minmax(400px,3fr)_250px_120px_140px_120px] gap-x-4"
                style={{ animationDelay: `${index * 0.05}s` }}
            >
                {/* 1. Domain Branding */}
                <div className="min-w-0 pr-4">
                    <div className="flex flex-col">
                        <span className="font-bold tracking-tight text-slate-900 group-hover:text-primary transition-colors whitespace-nowrap overflow-x-auto hidescrollbar">
                            {site.domainName}
                        </span>
                        {site.name && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
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
                    <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] border shadow-sm transition-colors",
                        projectCount > 0 
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100" 
                            : "bg-slate-50 text-slate-400 border-slate-100"
                    )}>
                        <Briefcase className="h-3 w-3" />
                        <span>{projectCount} Projects</span>
                    </div>
                </div>

                {/* 4. Asset Indicators */}
                <div className="flex items-center justify-center gap-2">
                    {hasGtm && (
                        <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/50 shadow-sm" title="GTM Installed">
                            <Tag className="h-3.5 w-3.5" />
                        </div>
                    )}
                    {hasAds && (
                        <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100/50 shadow-sm" title="Ads Linked">
                            <BarChart3 className="h-3.5 w-3.5" />
                        </div>
                    )}
                    {hasDrive && (
                        <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100/50 shadow-sm" title="Drive Folder">
                            <ExternalLink className="h-3.5 w-3.5" />
                        </div>
                    )}
                    {!hasGtm && !hasAds && !hasDrive && (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Clean</span>
                    )}
                </div>

                {/* 5. Date */}
                <div className="flex items-center justify-end">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 font-mono tracking-tight text-right shrink-0 tabular-nums">
                        {formatRelativeDate(site.createdAt).toUpperCase()}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto pb-6 hidescrollbar">
                <div className="flex flex-col gap-2 md:min-w-[1240px]">
                    {sites.length > 0 && renderHeader()}
                    {sites.map((site, index) => renderSiteRow(site, index))}
                    
                    {sites.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-4 py-24 bg-slate-50/30 rounded-3xl border border-dashed border-slate-200/60">
                            <div className="h-20 w-20 rounded-3xl bg-white flex items-center justify-center border border-slate-100 shadow-xl shadow-slate-200/50 rotate-3">
                                <Globe className="h-10 w-10 text-slate-200" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-black text-slate-900 leading-none">No Assets Detected</h3>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Domain list is currently empty for this filter.</p>
                            </div>
                        </div>
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
