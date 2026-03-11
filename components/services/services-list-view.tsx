"use client"

import * as React from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ServiceSheetContent } from "@/components/services/service-sheet-content"

interface ServicesListViewProps {
    services: any[]
}

export function ServicesListView({ services }: ServicesListViewProps) {
    const [selectedService, setSelectedService] = React.useState<any>(null)

    return (
        <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => {
                    let tasks: string[] = []
                    try {
                        tasks = JSON.parse(service.standardTasks)
                    } catch { tasks = [] }
                    const activeCount = service.projects.filter((p: any) => p.status === "Active").length
                    const completedCount = service.projects.filter((p: any) => p.status === "Completed").length
                    const closedCount = service.projects.filter((p: any) => p.status === "Closed" || p.status === "Paused").length

                    return (
                        <div
                            key={service.id}
                            onClick={() => setSelectedService(service)}
                            className="cursor-pointer h-full transition-transform hover:scale-[1.02]"
                        >
                            <Card className="hover:bg-muted/5 transition-colors relative group h-full">
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl font-bold">{service.serviceName}</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={service.isRecurring ? "default" : "secondary"}>
                                                    {service.isRecurring ? "Recurring" : "One-time"}
                                                </Badge>
                                                {service.baseFee && (
                                                    <span className="text-sm font-medium text-emerald-600">
                                                        {service.baseFee.toString()} RON
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <CardDescription className="pt-2 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <span className="font-bold text-foreground">{activeCount}</span> Active
                                            <span className="text-muted-foreground/40">•</span>
                                            <span className="font-bold text-foreground">{completedCount}</span> Completed
                                            <span className="text-muted-foreground/40">•</span>
                                            <span className="font-bold text-foreground">{closedCount}</span> Closed
                                        </div>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="text-xs font-semibold text-muted-foreground/80">Standard Checklist</div>
                                        <ul className="text-xs space-y-1.5 list-none">
                                            {tasks.slice(0, 5).map((task, i) => (
                                                <li key={i} className="flex items-center gap-2">
                                                    <div className="h-1 w-1 rounded-full bg-primary/40" />
                                                    {task}
                                                </li>
                                            ))}
                                            {tasks.length > 5 && <li className="text-primary/60 font-medium">+{tasks.length - 5} more...</li>}
                                            {tasks.length === 0 && <li className="italic text-muted-foreground/60">No standard tasks defined</li>}
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )
                })}
                {services.length === 0 && (
                    <div className="col-span-full text-center py-20 text-muted-foreground border-dashed border-2 rounded-xl">
                        No services found. Create your first service template.
                    </div>
                )}
            </div>

            <Sheet open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
                <SheetContent className="w-screen max-w-none p-0 overflow-hidden flex flex-col border-none shadow-xl bg-[#f8fafc] focus-visible:outline-none sm:w-full sm:max-w-[900px]">
                    {selectedService && (
                        <ServiceSheetContent
                            service={selectedService}
                            onUpdate={(updated) => {
                                setSelectedService({ ...selectedService, ...updated })
                                // Ideally trigger refresh here
                            }}
                            onClose={() => setSelectedService(null)}
                        />
                    )}
                </SheetContent>
            </Sheet>
        </>
    )
}
