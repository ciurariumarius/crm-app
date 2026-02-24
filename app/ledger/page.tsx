import { format } from "date-fns"
import { CheckCircle2, Circle } from "lucide-react"
import prisma from "@/lib/prisma"
import { togglePaymentStatus } from "@/lib/actions/projects"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function LedgerPage() {
    // Fetch unpaid projects
    const unpaidProjects = await prisma.project.findMany({
        where: {
            status: "Active",
            // We list all active projects here, highlighting unpaid ones 
            // OR specifically just unpaid. Let's list all active to manage payments.
        },
        include: {
            site: { include: { partner: true } },
            services: true,
        },
        orderBy: { updatedAt: "desc" },
    })

    // Fetch all time logs for reports (this month)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const timeLogs = await prisma.timeLog.findMany({
        where: {
            startTime: { gte: startOfMonth }
        },
        include: {
            project: {
                include: {
                    site: { include: { partner: true } }
                }
            }
        }
    })

    // Aggregate time by Partner
    const partnerStats: Record<string, number> = {}
    timeLogs.forEach((log: any) => {
        const pName = log.project.site.partner.name
        partnerStats[pName] = (partnerStats[pName] || 0) + (log.durationSeconds || 0)
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-foreground">The Ledger</h1>
            </div>

            <Tabs defaultValue="payments" className="w-full">
                <TabsList>
                    <TabsTrigger value="payments">Payment Tracker</TabsTrigger>
                    <TabsTrigger value="reports">Time Reports (This Month)</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {unpaidProjects.map((project: any) => (
                            <Card key={project.id} className={project.paymentStatus === "Unpaid" ? "border-red-500/50" : ""}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">
                                            {project.services.length > 0
                                                ? project.services.map((s: any) => s.serviceName).join(", ")
                                                : "No Service"}
                                        </CardTitle>
                                        <CardDescription>{project.site.domainName}</CardDescription>
                                    </div>
                                    <Badge variant={project.paymentStatus === "Paid" ? "secondary" : "destructive"}>
                                        {project.paymentStatus}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="text-sm text-muted-foreground">{project.site.partner.name}</span>
                                        <form action={async () => {
                                            "use server"
                                            await togglePaymentStatus(project.id, project.paymentStatus)
                                        }}>
                                            <Button size="sm" variant={project.paymentStatus === "Paid" ? "outline" : "default"}>
                                                {project.paymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}
                                            </Button>
                                        </form>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {unpaidProjects.length === 0 && (
                            <div className="col-span-full text-center py-10 text-muted-foreground">
                                No active projects found.
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="reports">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Overview ({format(new Date(), "MMMM yyyy")})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {Object.entries(partnerStats).map(([partner, seconds]) => {
                                    const hours = (seconds / 3600).toFixed(1)
                                    return (
                                        <div key={partner} className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-muted/50 p-2 rounded">
                                            <span className="font-medium">{partner}</span>
                                            <span className="font-mono">{hours} hrs</span>
                                        </div>
                                    )
                                })}
                                {Object.keys(partnerStats).length === 0 && (
                                    <div className="text-muted-foreground text-center py-4">No time logged this month.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
