"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, TrendingUp, TrendingDown, LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AdsAccount {
    id: string
    name: string
    currency: string
    status: string
    yesterday: AdMetrics
    last3Days: AdMetrics
    last7Days: AdMetrics
    last14Days: AdMetrics
    last30Days: AdMetrics
    last90Days: AdMetrics
    link: string
    dailyBudget: string
    tRoas: string
    tCpa: string
}

export interface AdMetrics {
    cost: string
    costDelta: string
    revenue: string
    roas: string
    roasDelta: string
    conversions: string
}

interface GoogleAdsProps {
    accounts: AdsAccount[]
}

export function GoogleAdsDashboard({ accounts }: GoogleAdsProps) {
    const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">
                        Google Ads Overview
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        Monitoring {accounts.length} active campaigns from Google Sheets
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-card p-1 rounded-lg border border-border">
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="h-8 w-8 p-0"
                    >
                        <List className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="h-8 w-8 p-0"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {viewMode === "list" ? (
                <div className="space-y-4">
                    {accounts.map((account) => (
                        <AccountListCard key={account.id} account={account} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {accounts.map((account) => (
                        <AccountGridCard key={account.id} account={account} />
                    ))}
                </div>
            )}
        </div>
    )
}

function AccountListCard({ account }: { account: AdsAccount }) {
    return (
        <Card className="hover:shadow-md transition-all duration-300 group border-l-4 border-l-emerald-500">
            <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Header Info */}
                    <div className="flex flex-col gap-2 min-w-[250px]">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                                {account.name}
                            </h3>
                            {account.status === "Active" && (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                                    Active
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <span className="uppercase tracking-wider">Budget:</span>
                                <span className="text-foreground font-bold">{account.dailyBudget} {account.currency}</span>
                            </div>
                            <div className="h-3 w-[1px] bg-border" />
                            <div className="flex items-center gap-1">
                                <span className="uppercase tracking-wider">tROAS:</span>
                                <span className="text-foreground font-bold">{account.tRoas || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 flex-1 border-l border-border/50 pl-0 lg:pl-8">
                        <MetricBlock label="Yesterday Cost" value={account.yesterday.cost} delta={account.yesterday.costDelta} currency={account.currency} />
                        <MetricBlock label="Yesterday ROAS" value={account.yesterday.roas} delta={account.yesterday.roasDelta} isRoas />
                        <MetricBlock label="30D Revenue" value={account.last30Days.revenue} currency={account.currency} highlight />
                        <MetricBlock label="30D ROAS" value={account.last30Days.roas} delta={account.last30Days.roasDelta} isRoas />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end pl-0 lg:pl-4">
                        <Button variant="outline" size="icon" asChild className="h-10 w-10 rounded-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
                            <a href={account.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function AccountGridCard({ account }: { account: AdsAccount }) {
    return (
        <Card className="flex flex-col h-full hover:shadow-lg transition-all duration-300 group border-t-4 border-t-emerald-500">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-primary transition-colors">
                            {account.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                                {account.currency}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">
                                Budget: {account.dailyBudget}
                            </span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 -mr-2 -mt-2 text-muted-foreground hover:text-foreground">
                        <a href={account.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pb-6 space-y-6">
                {/* Yesterday */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Yesterday Performance</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <MetricBlock label="Cost" value={account.yesterday.cost} delta={account.yesterday.costDelta} compact />
                        <MetricBlock label="ROAS" value={account.yesterday.roas} delta={account.yesterday.roasDelta} isRoas compact />
                        <MetricBlock label="Revenue" value={account.yesterday.revenue} compact />
                        <MetricBlock label="Conv." value={account.yesterday.conversions} compact />
                    </div>
                </div>

                {/* 30 Days */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Last 30 Days</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <MetricBlock label="Cost" value={account.last30Days.cost} delta={account.last30Days.costDelta} compact />
                        <MetricBlock label="ROAS" value={account.last30Days.roas} delta={account.last30Days.roasDelta} isRoas compact highlight />
                        <MetricBlock label="Revenue" value={account.last30Days.revenue} compact />
                        <MetricBlock label="Conv." value={account.last30Days.conversions} compact />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function MetricBlock({
    label,
    value,
    delta,
    currency,
    isRoas,
    highlight,
    compact
}: {
    label: string
    value: string
    delta?: string
    currency?: string
    isRoas?: boolean
    highlight?: boolean
    compact?: boolean
}) {
    const isNegative = delta?.startsWith("-")
    const isPositive = delta && !delta.startsWith("-")

    return (
        <div className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
            <span className="text-[10px] font-bold uppercase text-muted-foreground/70">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className={cn(
                    "font-bold text-foreground",
                    compact ? "text-sm" : "text-base",
                    highlight && "text-emerald-600 dark:text-emerald-400"
                )}>
                    {currency && value ? `${value} ${currency}` : value || "-"}
                    {isRoas && value ? "x" : ""}
                </span>
                {delta && (
                    <span className={cn(
                        "flex items-center text-[10px] font-bold",
                        isNegative ? "text-rose-500" : "text-emerald-500"
                    )}>
                        {isNegative ? <TrendingDown className="h-3 w-3 mr-0.5" /> : <TrendingUp className="h-3 w-3 mr-0.5" />}
                        {delta}
                    </span>
                )}
            </div>
        </div>
    )
}
