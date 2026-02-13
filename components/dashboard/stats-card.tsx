import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
    title: string
    value: string
    description?: string
    trend?: string
    icon: LucideIcon
    className?: string
    iconClassName?: string
}

export function StatsCard({
    title,
    value,
    description,
    trend,
    icon: Icon,
    className,
    iconClassName
}: StatsCardProps) {
    return (
        <Card className={cn("bento-card group h-full", className)}>
            <div className="flex flex-col h-full justify-between gap-8">
                <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                        <Icon className={cn("h-5 w-5", iconClassName)} strokeWidth={1.5} />
                    </div>
                    {trend && (
                        <div className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary animate-in fade-in slide-in-from-right-2 duration-500">
                            {trend}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
                        {title}
                    </div>
                    <div className="text-4xl font-bold tracking-[-0.03em] text-foreground">
                        {value}
                    </div>
                    {description && (
                        <div className="text-[12px] font-medium text-muted-foreground/60 leading-tight">
                            {description}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
}
