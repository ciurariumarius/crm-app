"use client"

import * as React from "react"
import Link from "next/link"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    Globe,
    Users,
    ExternalLink,
    Calendar,
    FolderOpen,
    Search as SearchIcon,
    ArrowUpRight,
    Fingerprint,
    Target
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface SitesTableProps {
    sites: any[]
}

export function SitesTable({ sites }: SitesTableProps) {
    return (
        <div className="rounded-xl border bg-card/50 overflow-hidden backdrop-blur-sm shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                        <TableHead className="w-[300px] text-[10px] font-black uppercase tracking-widest py-4">Domain Asset</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Partner Entity</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Active Projects</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Analytics / Ads</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4">Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sites.map((site) => (
                        <TableRow
                            key={site.id}
                            className="group transition-colors cursor-pointer border-muted/20"
                        >
                            <TableCell className="py-4">
                                <Link
                                    href={`/vault/${site.partnerId}/${site.id}`}
                                    className="flex items-center gap-3 group/link"
                                >
                                    <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                                        <Globe className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm tracking-tight group-hover/link:text-primary transition-colors">
                                            {site.domainName}
                                        </span>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 font-medium">
                                            <ArrowUpRight className="h-2.5 w-2.5" />
                                            CLICK TO OPEN VAULT
                                        </div>
                                    </div>
                                </Link>
                            </TableCell>

                            <TableCell className="py-4">
                                <Link
                                    href={`/vault/${site.partnerId}`}
                                    className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                                        <Users className="h-3 w-3" />
                                    </div>
                                    {site.partner.name}
                                </Link>
                            </TableCell>

                            <TableCell className="py-4">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold px-2 py-0">
                                        {site._count.projects}
                                    </Badge>
                                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">Engagements</span>
                                </div>
                            </TableCell>

                            <TableCell className="py-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 opacity-80">
                                            <Fingerprint className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-mono font-bold">
                                                {site.gtmId || "NO-GTM"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 opacity-80">
                                            <Target className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-mono font-bold">
                                                {site.googleAdsId || "NO-ADS"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </TableCell>

                            <TableCell className="text-right py-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-muted-foreground/80">
                                        {format(new Date(site.createdAt), "dd MMM yyyy")}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground/30">
                                        System Entry
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {sites.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-64 text-center">
                                <div className="flex flex-col items-center gap-2 opacity-30">
                                    <Globe className="h-10 w-10 text-muted-foreground" />
                                    <p className="text-sm font-black uppercase tracking-[0.2em]">No assets detected</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
