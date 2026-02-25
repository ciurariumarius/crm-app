"use client"

import { useState, useContext } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ChevronLeft, ChevronRight, Plus, ArrowRight, CheckSquare, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { ProjectSheetContext } from "@/components/projects/project-sheet-wrapper"

interface RecurringProject {
    id: string
    siteName: string
    hoursLogged: number
    paymentStatus: string
    completedTasks: number
    totalTasks: number
}

interface RecurringProjectsListProps {
    projects: RecurringProject[]
    partners: any[]
    services: any[]
}

const ITEMS_PER_PAGE = 5

export function RecurringProjectsList({ projects, partners, services }: RecurringProjectsListProps) {
    const [currentPage, setCurrentPage] = useState(1)
    const [createProjectOpen, setCreateProjectOpen] = useState(false)
    const { openProject } = useContext(ProjectSheetContext)
    const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE)

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const displayedProjects = projects.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    return (
        <>
            <Card className="flex flex-col bento-card p-0 overflow-hidden shadow-sm">
                <CardHeader className="py-6 px-8 flex flex-row items-center justify-between bg-card/80">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>Monthly Projects</span>
                    </CardTitle>
                    <div className="flex items-center gap-3">
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
                        <div className="flex items-center gap-2">
                            <Link href="/projects">
                                <Button variant="secondary" size="sm" className="h-7 text-[10px] uppercase font-bold px-3 rounded-full">
                                    View All
                                    <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                            </Link>
                            <Button
                                size="icon"
                                className="h-7 w-7 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full shadow-sm transition-all"
                                onClick={() => setCreateProjectOpen(true)}
                                title="Add Project"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-4 flex-1">
                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-[12px] text-muted-foreground/50 text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border mx-4">
                            <FolderOpen className="h-8 w-8 opacity-20" />
                            <span>No active subscriptions.</span>
                        </div>
                    ) : (
                        displayedProjects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => openProject(project.id)}
                                className="group flex items-center justify-between px-6 py-3 min-h-[60px] rounded-2xl border border-transparent hover:border-primary/30 hover:bg-muted/50 hover:scale-[1.01] transition-all duration-300 cursor-pointer"
                            >
                                <div className="flex flex-col justify-center gap-1.5 min-w-0 flex-1 pr-4">
                                    <div className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors break-words leading-tight">{project.siteName}</div>
                                    <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground/60">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 opacity-40 group-hover:text-primary transition-colors" strokeWidth={1.5} />
                                            <span className="font-mono text-[10px] font-bold">
                                                {Math.floor(project.hoursLogged)}h {Math.round((project.hoursLogged % 1) * 60)}m
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <CheckSquare className="h-3 w-3 opacity-40 group-hover:text-primary transition-colors" strokeWidth={1.5} />
                                            {project.completedTasks}/{project.totalTasks} tasks
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <Badge className={cn(
                                        "border-none text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md",
                                        project.paymentStatus === "Paid"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-rose-100 text-rose-700"
                                    )}>
                                        {project.paymentStatus === "Paid" ? "PAID" : "UNPAID"}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-1" strokeWidth={1.5} />
                                </div>
                            </div>
                        ))
                    )}
                    {/* Shadow Project (Create New) */}
                    <div
                        onClick={() => setCreateProjectOpen(true)}
                        className="group flex items-center justify-center px-6 py-3 min-h-[60px] rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 cursor-pointer text-muted-foreground hover:text-primary"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                            <Plus className="h-4 w-4" strokeWidth={2} />
                            <span>Add New Project</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <GlobalCreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                partners={partners}
                services={services}
            />
        </>
    )
}
