"use client"

import { useState } from "react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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
        <Card className="flex flex-col h-full bento-card p-0 overflow-hidden shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-8 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Projects</CardTitle>
                    <p className="text-xl font-bold text-foreground tracking-tight">Active Ventures</p>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border border-border">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-muted"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60 px-1">
                            {currentPage} / {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-muted"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 flex-1">
                {projects.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground/50 text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border mx-4">
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
                                className="group block px-6 py-5 min-h-[72px] rounded-2xl border border-transparent hover:border-primary/30 hover:bg-muted/50 hover:scale-[1.01] transition-all duration-300"
                            >
                                <div className="flex justify-between items-start gap-4 mb-4">
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <Avatar className="h-9 w-9 border border-border bg-muted/50">
                                            <AvatarFallback className="text-[10px] uppercase font-bold text-muted-foreground/60">
                                                {project.siteName.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors truncate">{project.siteName}</div>
                                    </div>
                                    <div className="text-[10px] font-bold text-primary flex items-center bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                        <CheckSquare className="mr-1.5 h-3 w-3" strokeWidth={1.5} />
                                        {project.completedTasks}/{project.totalTasks}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.1em]">
                                        <span className="text-muted-foreground/50">Velocity</span>
                                        <span className="text-primary">{progress}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-500 ease-out"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
