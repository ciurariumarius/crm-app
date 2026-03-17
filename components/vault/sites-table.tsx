"use client"

import * as React from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    Globe,
    Users,
} from "lucide-react"
import { formatRelativeDate } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SiteSheetContent } from "@/components/vault/site-sheet-content"
import type { Site } from "@prisma/client"

type SiteTableItem = Site & {
    partner: {
        id: string
        name: string
    }
}

interface SitesTableProps {
    sites: SiteTableItem[]
}

export function SitesTable({ sites }: SitesTableProps) {
    const [selectedSite, setSelectedSite] = React.useState<SiteTableItem | null>(null)

    return (
        <div className="overflow-x-auto">
            <Table className="table-cockpit">
                <TableHeader>
                    <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="w-[400px] px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Domain</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Partner</TableHead>
                        <TableHead className="px-6 py-4 text-right text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sites.map((site) => (
                        <TableRow
                            key={site.id}
                            className="group transition-colors cursor-pointer border-slate-100 hover:bg-slate-50/30"
                            onClick={() => setSelectedSite(site)}
                        >
                            <TableCell className="py-4 px-6">
                                <div className="flex items-center gap-3 group/link">
                                    <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 shadow-sm">
                                        <Globe className="h-4 w-4" />
                                    </div>
                                    <span className="font-bold text-sm tracking-tight text-slate-800 transition-colors group-hover:text-blue-600">
                                        {site.domainName}
                                    </span>
                                </div>
                            </TableCell>

                            <TableCell className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shadow-sm">
                                        <Users className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-[13px] font-bold text-slate-600 tracking-tight">
                                        {site.partner.name}
                                    </span>
                                </div>
                            </TableCell>

                            <TableCell className="text-right py-4 px-6">
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[13px] font-bold text-slate-700 tracking-tight">
                                        {formatRelativeDate(site.createdAt).toUpperCase()}
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {sites.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} className="h-64 text-center">
                                <div className="flex flex-col items-center gap-3 opacity-40">
                                    <div className="h-16 w-16 rounded-3xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-inner">
                                        <Globe className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">No assets detected</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
                <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col gap-0 border-l border-slate-200 bg-white shadow-2xl">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Site Asset Details</SheetTitle>
                    </SheetHeader>
                    {selectedSite && (
                        <SiteSheetContent
                            site={selectedSite}
                            onUpdate={(updated) => {
                                setSelectedSite((prev) => (prev ? { ...prev, ...updated } : prev))
                            }}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
