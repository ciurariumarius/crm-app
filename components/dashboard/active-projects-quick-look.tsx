"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Briefcase, CheckCircle2, Clock } from "lucide-react"

interface ActiveProjectsQuickLookProps {
    projects: any[]
}

export function ActiveProjectsQuickLook({ projects }: ActiveProjectsQuickLookProps) {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Active Projects
                </CardTitle>
            </CardHeader>
            <CardContent>
                {projects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No active projects
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                href={`/projects?status=Active&partnerId=${project.site.partner.id}`}
                                className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm truncate uppercase tracking-tight italic">
                                            {project.name || (project.services?.[0]?.serviceName || "Unnamed Project")}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {project.site.partner.name}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {project.paymentStatus === "Paid" ? (
                                            <Badge variant="outline" className="text-[9px] h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                PAID
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[9px] h-5 bg-rose-500/10 text-rose-600 border-rose-500/20">
                                                UNPAID
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {project._count?.tasks > 0 && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {project._count.tasks} tasks
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
                {projects.length > 0 && (
                    <Link
                        href="/projects?status=Active"
                        className="block mt-4 text-center text-xs font-medium text-primary hover:underline"
                    >
                        View all active projects →
                    </Link>
                )}
            </CardContent>
        </Card>
    )
}
