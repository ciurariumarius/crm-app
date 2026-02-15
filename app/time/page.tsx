import { TimeLogsFilters } from "@/components/time/time-logs-filters"
import { formatProjectName } from "@/lib/utils"
import { TimeLogsTable } from "@/components/time/time-logs-table"
import { getTimeLogs } from "@/lib/actions"
import prisma from "@/lib/prisma"
import { Archive, Plus, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateTimeLogDialog } from "@/components/time/create-time-log-dialog"

export const dynamic = 'force-dynamic'

export default async function TimePage({
    searchParams,
}: {
    searchParams: Promise<{ projectId?: string; partnerId?: string }>
}) {
    const { projectId, partnerId } = await searchParams

    const [projects, partners, tasks, logsResult] = await Promise.all([
        prisma.project.findMany({
            where: { status: "Active" },
            include: {
                site: { select: { domainName: true, partnerId: true } },
                services: true
            }
        }),
        prisma.partner.findMany({
            select: { id: true, name: true }
        }),
        prisma.task.findMany({
            where: { status: { not: "Completed" } },
            select: { id: true, name: true, projectId: true }
        }),
        getTimeLogs({ projectId, partnerId })
    ])

    const formattedProjects = projects.map(p => {
        return {
            id: p.id,
            siteName: formatProjectName(p),
            displayName: formatProjectName(p),
            site: p.site,
            services: p.services
        }
    })

    const logs = logsResult.success ? logsResult.data : []

    // Ensure logs match the expected type or cast appropriately if strict match is complex
    const formattedLogs = logs?.map(log => ({
        ...log,
    }))

    // Serialization for client component
    const serializedLogs = JSON.parse(JSON.stringify(logs))

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Time Logger</h1>
                <p className="text-muted-foreground">Track and manage time spent on projects.</p>
            </div>


            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-end">
                    <TimeLogsFilters
                        partners={partners}
                        projects={formattedProjects}
                    />
                    <CreateTimeLogDialog
                        projects={formattedProjects}
                        tasks={tasks}
                    />
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm p-1">
                    <TimeLogsTable
                        logs={serializedLogs}
                        projects={formattedProjects}
                        tasks={tasks}
                    />
                </div>
            </div>
        </div>
    )
}
