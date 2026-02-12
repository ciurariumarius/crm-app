"use client"

import * as React from "react"
import { Pie, PieChart, Cell, ResponsiveContainer, Sector } from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--chart-1, 221.2 83.2% 53.3%))",
    "hsl(var(--chart-2, 142.1 76.2% 36.3%))",
    "hsl(var(--chart-3, 47.9 95.8% 51.8%))",
    "hsl(var(--chart-4, 24.3 91.1% 65.1%))",
    "hsl(var(--chart-5, 346.8 77.2% 49.8%))",
]

interface RevenueChartProps {
    data: {
        name: string
        revenue: number
    }[]
}

export function PartnerRevenueChart({ data }: RevenueChartProps) {
    const chartData = React.useMemo(() => {
        return data
            .filter(item => item.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue)
    }, [data])

    const chartConfig = React.useMemo(() => {
        const config: ChartConfig = {
            revenue: {
                label: "Revenue (RON)",
            },
        }
        chartData.forEach((item, index) => {
            config[item.name] = {
                label: item.name,
                color: COLORS[index % COLORS.length],
            }
        })
        return config
    }, [chartData])

    const totalRevenue = React.useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.revenue, 0)
    }, [chartData])

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] opacity-20 italic bg-muted/5 rounded-3xl border-2 border-dashed">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Status:</span>
                Aggregate more projects to see analysis.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Chart Side */}
            <div className="relative">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[400px] w-full"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="revenue"
                            nameKey="name"
                            innerRadius={80}
                            outerRadius={120}
                            strokeWidth={12}
                            paddingAngle={5}
                            stroke="transparent"
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                                />
                            ))}
                        </Pie>
                        <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-foreground"
                        >
                            <tspan
                                x="50%"
                                dy="-0.5em"
                                className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30"
                            >
                                GLOBAL RON
                            </tspan>
                            <tspan
                                x="50%"
                                dy="1.2em"
                                className="text-4xl font-black italic tabular-nums tracking-tighter"
                            >
                                {totalRevenue.toLocaleString()}
                            </tspan>
                        </text>
                    </PieChart>
                </ChartContainer>
            </div>

            {/* Detailed Legend Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chartData.map((item, index) => (
                    <div
                        key={item.name}
                        className="flex items-center justify-between p-4 bg-background/50 rounded-2xl border border-muted-foreground/5 group hover:border-primary/20 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="h-2.5 w-2.5 rounded-full shadow-sm"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase italic tracking-tight truncate max-w-[120px]">
                                    {item.name}
                                </span>
                                <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                    Partner Entity
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-black italic tabular-nums leading-none">
                                {item.revenue.toLocaleString()} <span className="text-[9px] font-bold opacity-30 not-italic">RON</span>
                            </div>
                            <div className="text-[9px] font-bold text-primary italic uppercase tracking-widest mt-1">
                                {((item.revenue / totalRevenue) * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
