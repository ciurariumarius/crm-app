"use client"

import * as React from "react"
import type { Prisma } from "@prisma/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ServiceSheetContent } from "@/components/services/service-sheet-content"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutGrid, ListFilter, RefreshCcw, Zap, Check } from "lucide-react"
import { sidePanelClass } from "@/lib/ui/side-panels"
import { StatusChip } from "@/components/ui/status-chip"
import { ListEmptyState } from "@/components/ui/list-state"
import { FilterBarRow, FilterBarShell } from "@/components/ui/filter-bar"

type ServiceProjectStatus = {
    status: string
}

type ServiceListItem = {
    id: string
    serviceName: string
    isRecurring: boolean
    standardTasks: string
    baseFee: string | number | Prisma.Decimal | null
    createdAt: Date | string
    updatedAt?: Date | string | null
    sopLink?: string | null
    projects: ServiceProjectStatus[]
    [key: string]: unknown
}

interface ServicesListViewProps {
    services: ServiceListItem[]
}

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc" | "fee-high" | "fee-low" | "active-projects"

export function ServicesListView({ services }: ServicesListViewProps) {
    const [selectedService, setSelectedService] = React.useState<ServiceListItem | null>(null)
    const [sortBy, setSortBy] = React.useState<SortOption>("newest")

    const sortedServices = React.useMemo(() => {
        return [...services].sort((a, b) => {
            switch (sortBy) {
                case "name-asc":
                    return a.serviceName.localeCompare(b.serviceName)
                case "name-desc":
                    return b.serviceName.localeCompare(a.serviceName)
                case "fee-high":
                    return Number(b.baseFee || 0) - Number(a.baseFee || 0)
                case "fee-low":
                    return Number(a.baseFee || 0) - Number(b.baseFee || 0)
                case "newest":
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                case "oldest":
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                case "active-projects":
                    const aActive = a.projects.filter((project) => project.status === "Active").length
                    const bActive = b.projects.filter((project) => project.status === "Active").length
                    return bActive - aActive
                default:
                    return 0
            }
        })
    }, [services, sortBy])

    return (
        <div className="space-y-6">
            <FilterBarShell className="rounded-[24px] border-[var(--line-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-3 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)] sm:px-5 sm:py-4">
                <FilterBarRow className="w-full min-w-0 justify-between">
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-slate-500" />
                        <span className="ui-text-label">{services.length} Templates</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-1.5 shadow-sm backdrop-blur-md">
                        <div className="flex items-center gap-2 text-slate-400">
                            <ListFilter className="h-4 w-4" />
                            <span className="text-[11px] font-medium">Sort by</span>
                        </div>
                        <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                            <SelectTrigger className="h-7 w-[160px] border-none bg-transparent text-xs font-bold shadow-none focus:ring-0 p-0 text-slate-700">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                <SelectItem value="newest" className="text-xs font-semibold">Newest First</SelectItem>
                                <SelectItem value="oldest" className="text-xs font-semibold">Oldest First</SelectItem>
                                <SelectItem value="name-asc" className="text-xs font-semibold">Name (A-Z)</SelectItem>
                                <SelectItem value="name-desc" className="text-xs font-semibold">Name (Z-A)</SelectItem>
                                <SelectItem value="fee-high" className="text-xs font-semibold">Fee (High to Low)</SelectItem>
                                <SelectItem value="fee-low" className="text-xs font-semibold">Fee (Low to High)</SelectItem>
                                <SelectItem value="active-projects" className="text-xs font-semibold">Most Active</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                </FilterBarRow>
            </FilterBarShell>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedServices.map((service) => {
                    let tasks: string[] = []
                    try {
                        const parsed = JSON.parse(service.standardTasks)
                        tasks = Array.isArray(parsed) ? parsed.map((task) => String(task)) : []
                    } catch { tasks = [] }
                    const activeCount = service.projects.filter((project) => project.status === "Active").length
                    const completedCount = service.projects.filter((project) => project.status === "Completed").length

                    return (
                        <div
                            key={service.id}
                            onClick={() => setSelectedService(service)}
                            className="cursor-pointer h-full transition-all hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 rounded-2xl"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault()
                                    setSelectedService(service)
                                }
                            }}
                        >
                            <Card className="premium-card relative h-full overflow-hidden rounded-[24px] border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] transition-all shadow-[0_6px_18px_rgba(15,23,42,0.03)] hover:bg-white hover:shadow-md">
                                <CardHeader className="border-b border-slate-100/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(241,245,249,0.42))] pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            {service.isRecurring ? (
                                                <StatusChip tone="recurring" size="xs" icon={<RefreshCcw className="h-3 w-3" />}>
                                                    Recurring
                                                </StatusChip>
                                            ) : (
                                                <StatusChip tone="oneTime" size="xs" icon={<Zap className="h-3 w-3" />}>
                                                    One-time
                                                </StatusChip>
                                            )}
                                            <CardTitle className="text-[18px] font-bold tracking-tight text-slate-900">{service.serviceName}</CardTitle>
                                        </div>
                                    </div>
                                    <CardDescription className="pt-2 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                            <span className="font-bold text-slate-700">{activeCount}</span> Active
                                            <span className="text-slate-300">•</span>
                                            <span className="font-bold text-slate-700">{completedCount}</span> Done
                                            {service.baseFee && (
                                                <>
                                                    <span className="text-slate-300 ml-auto">•</span>
                                                    <span className="font-bold text-slate-900">{service.baseFee.toString()} RON</span>
                                                </>
                                            )}
                                        </div>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-5">
                                    <div className="space-y-3">
                                        <div className="text-[11px] font-semibold tracking-[0.03em] text-slate-500 flex items-center gap-2">
                                            <ListFilter className="h-3 w-3" /> Standard Checklist
                                        </div>
                                        <ul className="text-[13px] space-y-2 list-none font-medium text-slate-600">
                                            {tasks.slice(0, 4).map((task, i) => (
                                                <li key={i} className="flex items-start gap-2 line-clamp-2">
                                                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span>{task}</span>
                                                </li>
                                            ))}
                                            {tasks.length > 4 && <li className="text-blue-600/70 text-[11px] font-medium pl-3.5">+{tasks.length - 4} more steps</li>}
                                            {tasks.length === 0 && <li className="italic text-slate-400 pl-3.5 font-normal">No standard tasks defined</li>}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )
                })}
                {services.length === 0 && (
                    <ListEmptyState
                        title="No services found"
                        description="Create your first service template."
                        icon={<LayoutGrid className="h-5 w-5" />}
                        className="col-span-full py-16"
                    />
                )}
            </div>

            <Sheet open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
                <SheetContent side="right" showCloseButton={false} className={sidePanelClass("default")}>
                    <SheetHeader className="sr-only">
                        <SheetTitle>Service Template Details</SheetTitle>
                    </SheetHeader>
                    {selectedService && (
                        <ServiceSheetContent
                            service={selectedService}
                            onUpdate={(updated) => {
                                setSelectedService({ ...selectedService, ...updated })
                            }}
                            onClose={() => setSelectedService(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
