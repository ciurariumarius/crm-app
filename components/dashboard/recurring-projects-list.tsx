"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

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
        <Card className="flex flex-col h-full bento-card p-0 overflow-hidden shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-8 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Subscriptions</CardTitle>
                    <p className="text-xl font-bold text-foreground tracking-tight">Active Retainers</p>
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
                        No active subscriptions.
                    </div>
                ) : (
                    displayedProjects.map((project) => (
                        <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="group flex items-center justify-between px-6 py-4 min-h-[72px] rounded-2xl border border-transparent hover:border-primary/30 hover:bg-muted/50 hover:scale-[1.01] transition-all duration-300"
                        >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <Avatar className="h-9 w-9 border border-border bg-muted/50">
                                    <AvatarFallback className="text-[10px] uppercase font-bold text-muted-foreground/60">
                                        {project.siteName.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-1 min-w-0">
                                    <div className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors truncate">{project.siteName}</div>
                                    <div className="flex items-center text-[11px] font-medium text-muted-foreground/60">
                                        <Clock className="mr-2 h-3 w-3 opacity-40 group-hover:text-primary transition-colors" strokeWidth={1.5} />
                                        {project.hoursLogged.toFixed(1)}h logged
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge className={cn(
                                    "border-none text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md",
                                    project.paymentStatus === "Paid"
                                        ? "bg-primary/10 text-primary"
                                        : "bg-amber-500/10 text-amber-500"
                                )}>
                                    {project.paymentStatus}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-1" strokeWidth={1.5} />
                            </div>
                        </Link>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
