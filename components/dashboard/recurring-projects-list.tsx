"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RecurringProject {
    id: string
    siteName: string
    hoursLogged: number
    paymentStatus: string
}

interface RecurringProjectsListProps {
    projects: RecurringProject[]
}

const ITEMS_PER_PAGE = 5

export function RecurringProjectsList({ projects }: RecurringProjectsListProps) {
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE)

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const displayedProjects = projects.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-lg font-bold">Subscriptions</CardTitle>
                    <p className="text-sm text-muted-foreground">Active recurring projects</p>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-[10px] font-bold tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
                {projects.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                        No active subscriptions.
                    </div>
                ) : (
                    displayedProjects.map((project) => (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                            <div className="space-y-1">
                                <div className="font-semibold">{project.siteName}</div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    <Clock className="mr-1 h-3 w-3" />
                                    {project.hoursLogged.toFixed(1)}h this month
                                </div>
                            </div>
                            <Badge variant={project.paymentStatus === "Paid" ? "secondary" : "destructive"}>
                                {project.paymentStatus}
                            </Badge>
                        </Link>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
