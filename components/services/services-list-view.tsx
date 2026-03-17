"use client"

import * as React from "react"
import type { Prisma } from "@prisma/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ServiceSheetContent } from "@/components/services/service-sheet-content"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutGrid, ListFilter } from "lucide-react"

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
            <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{services.length} Templates</span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-slate-400">
                        <ListFilter className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sort by</span>
                    </div>
                    <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                        <SelectTrigger className="h-9 w-[180px] rounded-xl border-slate-200 bg-white text-xs font-bold shadow-none focus:ring-blue-500/10 transition-all">
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
                            className="cursor-pointer h-full transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                            <Card className="hover:bg-white transition-all relative group h-full border-slate-200 shadow-sm hover:shadow-md rounded-2xl overflow-hidden premium-card">
                                <CardHeader className="pb-3 bg-slate-50/50">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <Badge variant={service.isRecurring ? "default" : "secondary"} className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                                                {service.isRecurring ? "Recurring" : "One-time"}
                                            </Badge>
                                            <CardTitle className="text-xl font-black italic tracking-tighter text-slate-800">{service.serviceName}</CardTitle>
                                        </div>
                                    </div>
                                    <CardDescription className="pt-2 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            <span className="font-black text-blue-600">{activeCount}</span> Active
                                            <span className="text-slate-300">•</span>
                                            <span className="font-black text-emerald-600">{completedCount}</span> Done
                                            {service.baseFee && (
                                                <>
                                                    <span className="text-slate-300 ml-auto">•</span>
                                                    <span className="font-black text-slate-900">{service.baseFee.toString()} RON</span>
                                                </>
                                            )}
                                        </div>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-5">
                                    <div className="space-y-3">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                            <ListFilter className="h-3 w-3" /> Standard Checklist
                                        </div>
                                        <ul className="text-xs space-y-2 list-none font-medium text-slate-600">
                                            {tasks.slice(0, 4).map((task, i) => (
                                                <li key={i} className="flex items-center gap-2 truncate">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500/30 shrink-0" />
                                                    {task}
                                                </li>
                                            ))}
                                            {tasks.length > 4 && <li className="text-blue-600/60 font-bold text-[10px] uppercase tracking-widest pl-3.5">+{tasks.length - 4} more steps</li>}
                                            {tasks.length === 0 && <li className="italic text-slate-400 pl-3.5 font-normal">No standard tasks defined</li>}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )
                })}
                {services.length === 0 && (
                    <div className="col-span-full text-center py-24 text-slate-400 bg-white/50 border-2 border-dashed border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-xs">
                        No services found. Create your first service template.
                    </div>
                )}
            </div>

            <Sheet open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
                <SheetContent className="w-screen max-w-none p-0 overflow-hidden flex flex-col border-none shadow-xl bg-[#f8fafc] focus-visible:outline-none sm:w-full sm:max-w-[900px]">
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
