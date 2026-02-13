"use client"

import { useState } from "react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface OneTimeProject {
    id: string
    siteName: string
    completedTasks: number
    totalTasks: number
}

interface OneTimeProjectsListProps {
    projects: OneTimeProject[]
}

const ITEMS_PER_PAGE = 5

export function OneTimeProjectsList({ projects }: OneTimeProjectsListProps) {
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE)

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const displayedProjects = projects.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-lg font-bold">One-Time Projects</CardTitle>
                    <p className="text-sm text-muted-foreground">Active project progress</p>
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
                        No active one-time projects.
                    </div>
                ) : (
                    displayedProjects.map((project) => {
                        const progress = project.totalTasks > 0
                            ? Math.round((project.completedTasks / project.totalTasks) * 100)
                            : 0

                        return (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-3"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-semibold">{project.siteName}</div>
                                    <div className="text-xs font-medium text-muted-foreground flex items-center">
                                        <CheckSquare className="mr-1 h-3 w-3" />
                                        {project.completedTasks}/{project.totalTasks}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Progress value={progress} className="h-2" />
                                    <div className="text-[10px] text-right text-muted-foreground">{progress}%</div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
