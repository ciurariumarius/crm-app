"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Bell, Plus, Briefcase, CheckSquare, ChevronRight, Slash, Menu, Square, Play, Pause } from "lucide-react"
import { formatProjectName, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GlobalHeaderSearch } from "@/components/layout/global-header-search"
import { useHeader } from "@/components/layout/header-context"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { stopTimer, getActiveTimer, pauseTimer, resumeTimer } from "@/lib/actions"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"

interface TopBarProps {
    partners: any[]
    services: any[]
    activeTasksCount: number
    activeProjects?: any[]
    initialActiveTimer?: any
}

export function TopBar({ partners, services, activeTasksCount, activeProjects = [], initialActiveTimer }: TopBarProps) {
    const { breadcrumbs } = useHeader()
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    // Active Timer State
    const [activeTimer, setActiveTimer] = React.useState<any>(initialActiveTimer)
    const [timerDuration, setTimerDuration] = React.useState(0)

    React.useEffect(() => {
        if (initialActiveTimer) {
            setActiveTimer(initialActiveTimer)
        } else {
            // If server says no timer, but we have one locally, we might want to keep it 
            // if it's "optimistic" (id='temp'). 
            // But TopBar doesn't create optimistic temp timers easily yet (except maybe through dialog).
            // For now, let's just sync.
            if (activeTimer?.id !== 'temp') {
                setActiveTimer(null)
            }
        }
    }, [initialActiveTimer])

    React.useEffect(() => {
        if (!activeTimer) {
            setTimerDuration(0)
            return
        }

        const calculateDuration = () => {
            const start = new Date(activeTimer.startTime).getTime()
            const now = new Date().getTime()
            return Math.floor((now - start) / 1000)
        }

        setTimerDuration(calculateDuration())

        const interval = setInterval(() => {
            setTimerDuration(calculateDuration())
        }, 1000)

        return () => clearInterval(interval)
    }, [activeTimer])

    const formatTimer = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }


    const handleStopTimer = async () => {
        const prevTimer = activeTimer
        setActiveTimer(null)
        try {
            const result = await stopTimer()
            if (result.success) {
                toast.success("Timer stopped")
            } else {
                toast.error(result.error || "Failed to stop")
                setActiveTimer(prevTimer)
            }
        } catch (error) {
            toast.error("Failed to stop timer")
            setActiveTimer(prevTimer)
        }
    }

    const handlePauseTimer = async () => {
        const prevTimer = activeTimer
        if (activeTimer) {
            setActiveTimer({ ...activeTimer, status: 'paused' })
        }
        try {
            const result = await pauseTimer()
            if (result.success) {
                toast.success("Timer paused")
            } else {
                toast.error(result.error || "Failed to pause")
                setActiveTimer(prevTimer)
            }
        } catch (error) {
            toast.error("Failed to pause timer")
            setActiveTimer(prevTimer)
        }
    }

    const handleResumeTimer = async () => {
        const prevTimer = activeTimer
        if (activeTimer) {
            setActiveTimer({ ...activeTimer, status: 'running', startTime: new Date() })
        }
        try {
            const result = await resumeTimer()
            if (result.success) {
                toast.success("Timer resumed")
                setActiveTimer({ ...result.data, status: 'running' })
            } else {
                toast.error(result.error || "Failed to resume")
                setActiveTimer(prevTimer)
            }
        } catch (error) {
            toast.error("Failed to resume timer")
            setActiveTimer(prevTimer)
        }
    }

    return (
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 gap-4 sticky top-0 z-30">
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
                {/* Active Tasks Info */}
                <Link
                    href="/tasks"
                    className="hidden lg:flex items-center gap-2 group"
                >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors">
                        <CheckSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/60 leading-none">Focus</span>
                        <span className="text-xs font-semibold leading-tight">{activeTasksCount} Tasks</span>
                    </div>
                </Link>

                <div className="h-6 w-px bg-border hidden lg:block" />

                <div className="flex items-center gap-2">
                    {activeTimer && (
                        <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border rounded-full pr-1.5 group/timer transition-colors hover:border-primary/20">
                            {activeTimer.status === 'paused' ? (
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
                                        <div className="flex flex-col items-start min-w-[60px]">
                                            <span className="text-[9px] uppercase font-bold tracking-tighter opacity-60 leading-none">Running</span>
                                            <span className="font-mono font-bold text-xs leading-none">
                                                {formatTimer(timerDuration)}
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

                            {activeTimer.status === 'paused' && (
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

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-4 rounded-full font-bold text-[10px] uppercase tracking-wider gap-2 border-primary/20 text-primary hover:bg-primary/5"
                            onClick={() => setCreateProjectOpen(true)}
                        >
                            <Briefcase className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Add Project</span>
                            <span className="sm:hidden">Project</span>
                        </Button>

                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 px-4 rounded-full font-bold text-[10px] uppercase tracking-wider gap-2 shadow-lg shadow-primary/20"
                            onClick={() => setCreateTaskOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                            <span className="hidden sm:inline">Add Task</span>
                            <span className="sm:hidden">Task</span>
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

                <div className="h-6 w-px bg-border hidden md:block" />

                {/* Profile */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src="/avatar.png" alt="@marius" />
                                <AvatarFallback>ML</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">Marius Limitless</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    marius@example.com
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            Billing
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-500">
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
