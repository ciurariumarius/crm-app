"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Bell, Plus, Briefcase, CheckSquare, ChevronRight, Slash, Menu, Square, Play, Pause, FolderPlus } from "lucide-react"
import { formatProjectName, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { GlobalHeaderSearch } from "@/components/layout/global-header-search"
import { useHeader } from "@/components/layout/header-context"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { stopTimer, getActiveTimer, pauseTimer, resumeTimer } from "@/lib/actions"
import { toast } from "sonner"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import { useTimer } from "@/components/providers/timer-provider"

interface TopBarProps {
    partners: any[]
    services: any[]
    activeTasksCount: number
    activeProjects?: any[]
    initialActiveTimer?: any
    pendingTasks?: any[]
}

export function TopBar({ partners, services, activeTasksCount, activeProjects = [], initialActiveTimer, pendingTasks = [] }: TopBarProps) {
    const { breadcrumbs } = useHeader()
    const { timerState, stopTimer, pauseTimer, resumeTimer } = useTimer()
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    const formatTimer = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const handleStopTimer = async () => {
        await stopTimer()
    }

    const handlePauseTimer = async () => {
        await pauseTimer()
    }

    const handleResumeTimer = async () => {
        await resumeTimer()
    }

    return (
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between pl-14 md:pl-8 pr-4 md:pr-8 gap-4 z-30 shrink-0">
            {/* Left: Breadcrumbs */}
            <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-none md:w-1/3">
                <div className="flex items-center text-sm font-medium text-muted-foreground/60 w-full overflow-hidden whitespace-nowrap mask-linear-fade">
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/">Pixelist</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator>
                                <Slash />
                            </BreadcrumbSeparator>
                            {breadcrumbs.length > 0 ? (
                                breadcrumbs.map((item, index) => {
                                    const isLast = index === breadcrumbs.length - 1
                                    return (
                                        <React.Fragment key={index}>
                                            <BreadcrumbItem>
                                                {isLast ? (
                                                    <BreadcrumbPage className="font-semibold text-foreground">{item.label}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                            {!isLast && (
                                                <BreadcrumbSeparator>
                                                    <Slash />
                                                </BreadcrumbSeparator>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            ) : (
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                                </BreadcrumbItem>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </div>

            {/* Center: Search */}
            <div className="hidden md:flex flex-1 justify-center max-w-md">
                <GlobalHeaderSearch />
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end md:w-1/3">


                <div className="flex items-center gap-2">
                    {(timerState.isRunning || timerState.elapsedSeconds > 0) && (
                        <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-full pr-1.5 group/timer transition-colors hover:border-primary/20">
                            {!timerState.isRunning ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-2 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 px-3 pl-4 rounded-full"
                                    onClick={handleResumeTimer}
                                    title="Resume Timer"
                                >
                                    <span className="text-xs font-medium max-w-[100px] truncate opacity-80">
                                        Paused
                                    </span>
                                    <div className="h-3 w-px bg-amber-500/20" />
                                    <Play className="h-3 w-3 fill-current" />
                                </Button>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 animate-pulse px-3 pl-4 rounded-full"
                                        onClick={handlePauseTimer}
                                        title="Pause Timer"
                                    >
                                        <div className="flex flex-col items-start min-w-[40px] md:min-w-[60px]">
                                            <span className="hidden md:inline text-[9px] uppercase font-bold tracking-tighter opacity-60 leading-none">Running</span>
                                            <span className="font-mono font-bold text-xs md:text-sm leading-none" suppressHydrationWarning>
                                                {formatTimer(timerState.elapsedSeconds)}
                                            </span>
                                        </div>
                                        <Pause className="h-3 w-3 fill-current opacity-80" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-rose-500/60 hover:text-rose-600 hover:bg-rose-500/10 rounded-full"
                                        onClick={handleStopTimer}
                                        title="Stop Timer"
                                    >
                                        <Square className="h-3 w-3 fill-current" />
                                    </Button>
                                </div>
                            )}

                            {!timerState.isRunning && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-rose-500/60 hover:text-rose-600 hover:bg-rose-500/10 rounded-full"
                                    onClick={handleStopTimer}
                                    title="Stop Timer"
                                >
                                    <Square className="h-3 w-3 fill-current" />
                                </Button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-1 pl-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full transition-colors"
                            onClick={() => setCreateProjectOpen(true)}
                            title="New Project"
                        >
                            <FolderPlus className="h-5 w-5" strokeWidth={1.5} />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full transition-colors"
                            onClick={() => setCreateTaskOpen(true)}
                            title="New Task"
                        >
                            <Plus className="h-5 w-5" strokeWidth={1.5} />
                        </Button>
                    </div>

                    <GlobalCreateProjectDialog
                        partners={partners}
                        services={services}
                        open={createProjectOpen}
                        onOpenChange={setCreateProjectOpen}
                    />
                    <GlobalCreateTaskDialog
                        open={createTaskOpen}
                        onOpenChange={setCreateTaskOpen}
                        projects={activeProjects}
                    />
                </div>
            </div>
        </header>
    )
}
