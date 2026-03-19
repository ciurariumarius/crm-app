import { LayoutGrid, AlertCircle, TrendingUp, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FinancialStatusBarProps {
    totalRevenue: number
    formattedRevenue: string
    allTimeUnpaidRevenue: number
    activeMonthlyProjectsCount: number
    activeOneTimeProjectsCount: number
    totalActiveTasks: number
    className?: string
}

export function FinancialStatusBar({
    formattedRevenue,
    allTimeUnpaidRevenue,
    activeMonthlyProjectsCount,
    activeOneTimeProjectsCount,
    totalActiveTasks,
    className
}: FinancialStatusBarProps) {
    const formatCurrency = (val: number) => new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        maximumFractionDigits: 0
    }).format(val)

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4", className)}>
            {/* 1. This Month Revenue */}
            <Card className="p-6 border-none shadow-sm bg-white dark:bg-zinc-900 group hover:shadow-md transition-all duration-300">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground/60">This month</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black tracking-tight text-foreground">{formattedRevenue}</div>
                        <div className="text-xs font-bold text-muted-foreground mt-1">Total Revenue</div>
                    </div>
                </div>
            </Card>

            {/* 2. All Time Unpaid */}
            <Card className="p-6 border-none shadow-sm bg-white dark:bg-zinc-900 group hover:shadow-md transition-all duration-300 border-l-4 border-l-rose-500/20">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground/60">Total unpaid</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black tracking-tight text-rose-600">{formatCurrency(allTimeUnpaidRevenue)}</div>
                        <div className="text-xs font-bold text-muted-foreground mt-1">Pending Arrears</div>
                    </div>
                </div>
            </Card>

            {/* 3. Active Projects */}
            <Card className="p-6 border-none shadow-sm bg-white dark:bg-zinc-900 group hover:shadow-md transition-all duration-300">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                            <LayoutGrid className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground/60">Project status</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black tracking-tight text-foreground">
                            {activeMonthlyProjectsCount + activeOneTimeProjectsCount} <span className="text-sm font-medium text-muted-foreground tracking-normal">Projects</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                <span className="text-[11px] font-medium text-muted-foreground">{activeMonthlyProjectsCount} Monthly</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                <span className="text-[11px] font-medium text-muted-foreground">{activeOneTimeProjectsCount} One-time</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 4. Active Tasks */}
            <Card className="p-6 border-none shadow-sm bg-white dark:bg-zinc-900 group hover:shadow-md transition-all duration-300">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <span className="text-[11px] font-semibold tracking-[0.03em] text-muted-foreground/60">Queue status</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black tracking-tight text-foreground">
                            {totalActiveTasks} <span className="text-sm font-medium text-muted-foreground tracking-normal">Active Tasks</span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold tracking-[0.03em] text-amber-600/80">Requires attention</div>
                    </div>
                </div>
            </Card>
        </div>
    )
}
