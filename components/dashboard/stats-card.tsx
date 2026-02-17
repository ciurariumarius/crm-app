"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface StatsCardProps {
    title: string
    value: string
    className?: string
    breakdown?: {
        monthly: { paid: number, unpaid: number }
        oneTime: { paid: number, unpaid: number }
    }
    mom?: string
    yoy?: string
}

const ronFormatter = new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

export function StatsCard({
    title,
    value,
    className,
    breakdown,
    mom,
    yoy
}: StatsCardProps) {
    // Calculate totals directly from numeric breakdown
    const monthlyTotal = breakdown ? (breakdown.monthly.paid + breakdown.monthly.unpaid) : 0
    const oneTimeTotal = breakdown ? (breakdown.oneTime.paid + breakdown.oneTime.unpaid) : 0
    const totalUnpaid = breakdown ? (breakdown.monthly.unpaid + breakdown.oneTime.unpaid) : 0
    const totalRevenue = monthlyTotal + oneTimeTotal

    // Percentages for data and labels
    const monthlyPercent = totalRevenue > 0 ? (monthlyTotal / totalRevenue) * 100 : 0
    const oneTimePercent = totalRevenue > 0 ? (oneTimeTotal / totalRevenue) * 100 : 0

    const data = [
        {
            name: 'Monthly',
            value: monthlyTotal,
            color: '#3b82f6',
            percentage: monthlyPercent.toFixed(1)
        },
        {
            name: 'One-Time',
            value: oneTimeTotal,
            color: '#a855f7',
            percentage: oneTimePercent.toFixed(1)
        },
    ]

    // Handle empty data case
    if (monthlyTotal === 0 && oneTimeTotal === 0) {
        data[0].value = 1
        data[0].color = '#e5e7eb'
        data[0].percentage = "0.0"
    }

    return (
        <Card className={cn("flex flex-col h-full bento-card p-0 overflow-hidden shadow-sm", className)}>
            <CardHeader className="py-4 px-6 flex flex-row items-center justify-between bg-card/50 border-b border-border/40">
                <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                    <span>{title}</span>
                </CardTitle>
                <div className="flex gap-4 text-[11px] font-bold">
                    {mom && (
                        <span className={cn(mom.startsWith('+') ? "text-emerald-500" : "text-rose-500")}>
                            {mom} MoM
                        </span>
                    )}
                    {yoy && (
                        <span className="text-muted-foreground/50 pl-4 border-l border-border/50 font-medium">
                            {yoy} YoY
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-between gap-8 flex-1">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest pl-0.5">Total Revenue</div>
                        <div className="text-4xl font-bold tracking-tight text-foreground leading-none">
                            {value}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl w-fit">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-muted-foreground whitespace-nowrap">Amount to receive:</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                            {ronFormatter.format(totalUnpaid)}
                        </span>
                    </div>
                </div>

                {breakdown && (
                    <div className="flex items-center gap-10 pr-4">
                        <div className="h-[120px] w-[120px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                        animationDuration={1000}
                                        animationBegin={200}
                                    >
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number, name: string, props: any) => [
                                            `${ronFormatter.format(value)} (${props.payload.percentage}%)`,
                                            name
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
                                        itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                        labelStyle={{ display: 'none' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-5 min-w-[150px]">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <span>{Math.round(monthlyPercent)}% Monthly</span>
                                </div>
                                <div className="text-2xl font-bold text-foreground tabular-nums pl-3.5">
                                    {ronFormatter.format(monthlyTotal)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                    <span>{Math.round(oneTimePercent)}% One-Time</span>
                                </div>
                                <div className="text-2xl font-bold text-foreground tabular-nums pl-3.5">
                                    {ronFormatter.format(oneTimeTotal)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
