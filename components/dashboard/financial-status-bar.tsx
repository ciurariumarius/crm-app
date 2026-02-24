import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
// Removed unused imports: ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, PieChart, Users, CreditCard

interface FinancialStatusBarProps {
    totalRevenue: number
    formattedRevenue: string
    revenueBreakdown: {
        monthly: { paid: number, unpaid: number }
        oneTime: { paid: number, unpaid: number }
    }
    revenueByPartner: { name: string, value: number, fill: string }[]
    mom?: string
    className?: string
}

export function FinancialStatusBar({
    totalRevenue,
    formattedRevenue,
    revenueBreakdown,
    revenueByPartner,
    mom = "+12%",
    className
}: FinancialStatusBarProps) {
    // Calculations for Zone 1: Cash Flow
    const totalCollected = revenueBreakdown.monthly.paid + revenueBreakdown.oneTime.paid
    const totalPending = revenueBreakdown.monthly.unpaid + revenueBreakdown.oneTime.unpaid
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0

    // Calculations for Zone 2: Revenue Quality
    const totalRecurring = revenueBreakdown.monthly.paid + revenueBreakdown.monthly.unpaid
    const totalOneTime = revenueBreakdown.oneTime.paid + revenueBreakdown.oneTime.unpaid
    const recurringPercent = totalRevenue > 0 ? (totalRecurring / totalRevenue) * 100 : 0
    const oneTimePercent = totalRevenue > 0 ? (totalOneTime / totalRevenue) * 100 : 0

    // Calculations for Zone 3: Partner Distribution
    // Filter out 0% partners and sort by value desc
    const activePartners = revenueByPartner.filter(p => p.value > 0).sort((a, b) => b.value - a.value)

    // Currency formatter for tooltips
    const formatCurrency = (val: number) => new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'RON',
        maximumFractionDigits: 0
    }).format(val)

    return (
        <Card className={cn("p-6 flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch lg:items-center shadow-sm hover:shadow-md transition-shadow bg-card/50", className)}>

            {/* ZONE 1: Total Revenue & Cash Flow */}
            <div className="flex-1 min-w-0 md:min-w-[300px] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl font-black tracking-tighter text-foreground">
                        {formattedRevenue}
                    </span>
                    <div className="flex gap-1.5">
                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                            {mom} MOM
                        </div>
                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-sky-600 bg-sky-50/50 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                            +34% YOY
                        </div>
                    </div>
                </div>

                {/* Collection Progress Bar */}
                <div className="flex flex-col gap-2">
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${collectionRate}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        <span>
                            COLLECTED
                        </span>
                        <span className="text-muted-foreground/80">
                            {formatCurrency(totalPending)} PENDING
                        </span>
                    </div>
                </div>
            </div>

            {/* Spacer/Divider (Desktop) - Invisible spacer instead of line to match clean look */}
            <div className="hidden lg:block w-8" />

            {/* ZONE 2: Revenue Quality (Stability Indicator) */}
            <div className="flex-1 min-w-0 md:min-w-[300px] flex flex-col gap-2 justify-center">
                {/* Top Labels */}
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">{recurringPercent.toFixed(0)}% Monthly</span>
                    <span className="text-muted-foreground font-medium">{oneTimePercent.toFixed(0)}% One-time</span>
                </div>

                {/* Bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${recurringPercent}%` }}
                    />
                    {/* Gap between bars if needed, or just adjacent */}
                    <div className="w-1 h-full bg-transparent" />
                    <div
                        className="h-full bg-slate-200 dark:bg-slate-700 rounded-full transition-all duration-500"
                        style={{ width: `${oneTimePercent}%` }}
                    />
                </div>

                {/* Bottom Label */}
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 italic mt-1">
                    Revenue Type
                </span>
            </div>

            {/* Spacer/Divider (Desktop) */}
            <div className="hidden lg:block w-px h-16 bg-border/40" />

            {/* ZONE 3: Partner Distribution */}
            <div className="flex-1 min-w-0 md:min-w-[300px] flex flex-col gap-4 justify-center">
                <span className="text-xs font-bold text-foreground">Partner Distribution</span>

                <div className="flex flex-col gap-3">
                    {/* Sparkline Segmented Bar - Very Thin */}
                    <div className="h-1 w-full rounded-full overflow-hidden flex">
                        {activePartners.map((partner) => {
                            const percent = totalRevenue > 0 ? (partner.value / totalRevenue) * 100 : 0
                            if (percent < 1) return null
                            return (
                                <div
                                    key={partner.name}
                                    className="h-full first:rounded-l-full last:rounded-r-full"
                                    style={{ width: `${percent}%`, backgroundColor: partner.fill }}
                                />
                            )
                        })}
                    </div>

                    {/* Legend: Dot Name % */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {activePartners.slice(0, 3).map((partner) => {
                            const percent = totalRevenue > 0 ? (partner.value / totalRevenue) * 100 : 0
                            return (
                                <div key={partner.name} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: partner.fill }} />
                                    <span>{partner.name}</span>
                                    <span className="text-muted-foreground/60">{percent.toFixed(0)}%</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </Card>
    )
}
