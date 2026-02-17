"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { cn } from "@/lib/utils"

interface RevenueByPartnerChartProps {
    data: { name: string, value: number, fill: string }[]
    className?: string
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border px-3 py-2 rounded-lg shadow-xl outline-none">
                <p className="text-sm font-bold mb-1">{payload[0].name}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
                    <span className="text-sm font-mono text-muted-foreground">
                        {new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(payload[0].value)}
                    </span>
                </div>
            </div>
        )
    }
    return null
}

export function RevenueByPartnerChart({ data, className }: RevenueByPartnerChartProps) {
    if (!data || data.length === 0) {
        return (
            <Card className={cn("flex flex-col h-full", className)}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Revenue by Partner
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center min-h-[300px] text-muted-foreground text-sm">
                    No revenue data available
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn("flex flex-col h-full", className)}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Revenue by Partner
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px] relative">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={false}
                            label={renderCustomizedLabel}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                        <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            iconSize={8}
                            formatter={(value) => <span className="text-xs font-medium text-muted-foreground ml-1">{value}</span>}
                            layout="horizontal"
                            wrapperStyle={{ paddingTop: "20px" }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
