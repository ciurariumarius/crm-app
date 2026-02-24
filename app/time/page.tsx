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
    searchParams: Promise<{ projectId?: string; partnerId?: string; q?: string }>
}) {
    const { projectId, partnerId, q } = await searchParams

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
        getTimeLogs({ projectId, partnerId, q })
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
        <div className="flex flex-col gap-6">
            <div className="flex h-10 items-center justify-between gap-4">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground pl-14 md:pl-0 leading-none flex items-center h-full">
                    Time Logs
                </h1>
                <CreateTimeLogDialog
                    projects={formattedProjects}
                    tasks={tasks}
                />
            </div>

            <div className="flex flex-col gap-6">
                <TimeLogsFilters
                    partners={partners}
                    projects={formattedProjects}
                />

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
