import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { EditServiceDialog } from "@/components/services/edit-service-dialog"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
    const servicesRaw = await prisma.service.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { projects: true },
            },
        },
    })

    const services = JSON.parse(JSON.stringify(servicesRaw))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Service Library</h2>
                    <p className="text-muted-foreground">Manage templates for your services.</p>
                </div>
                <CreateServiceDialog />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service: any) => {
                    let tasks: string[] = []
                    try {
                        tasks = JSON.parse(service.standardTasks)
                    } catch { tasks = [] }

                    return (
                        <Card key={service.id} className="hover:bg-muted/5 transition-colors relative group cursor-pointer">
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
                                    <EditServiceDialog service={service} />
                                </div>
                                <CardDescription className="pt-2">
                                    {service._count.projects} Active Projects
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Standard Checklist</div>
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
                    )
                })}
                {services.length === 0 && (
                    <div className="col-span-full text-center py-20 text-muted-foreground border-dashed border-2 rounded-xl">
                        No services found. Create your first service template.
                    </div>
                )}
            </div>
        </div>
    )
}
