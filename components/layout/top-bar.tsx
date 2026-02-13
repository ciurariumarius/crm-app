"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Bell, Plus, Timer, Briefcase, CheckSquare, ChevronRight, Slash, Menu, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GlobalHeaderSearch } from "@/components/layout/global-header-search"
import { useHeader } from "@/components/layout/header-context"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { useTimer } from "@/components/providers/timer-provider"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"

interface TopBarProps {
    partners: any[]
    services: any[]
    activeTasksCount: number
    activeProjects?: any[]
}

export function TopBar({ partners, services, activeTasksCount, activeProjects = [] }: TopBarProps) {
    const { breadcrumbs } = useHeader()
    const { startTimer, timerState } = useTimer()
    const [timerDialogOpen, setTimerDialogOpen] = React.useState(false)
    const [timerDescription, setTimerDescription] = React.useState("")
    const [timerProjectId, setTimerProjectId] = React.useState("")
    const [openCombobox, setOpenCombobox] = React.useState(false)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)

    const handleStartTimer = (e: React.FormEvent) => {
        e.preventDefault()
        if (!timerDescription || !timerProjectId) return
        startTimer(timerProjectId, undefined, timerDescription)
        setTimerDialogOpen(false)
        setTimerDescription("")
        setTimerProjectId("")
        toast.success("Timer started")
    }

    return (
        <header className="h-16 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-8 gap-4 sticky top-0 z-30">
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
                {/* Active Tasks Link */}
                <Link
                    href="/tasks"
                    className="hidden md:flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-full bg-muted/50 hover:bg-primary/5"
                >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>{activeTasksCount} active tasks</span>
                </Link>

                <div className="h-6 w-px bg-border hidden md:block" />

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                    <GlobalCreateProjectDialog
                        partners={partners}
                        services={services}
                        open={createProjectOpen}
                        onOpenChange={setCreateProjectOpen}
                        trigger={
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Add Project">
                                <Briefcase className="h-4 w-4" />
                            </Button>
                        }
                    />

                    {/* Add Task */}
                    <GlobalCreateTaskDialog
                        open={createTaskOpen}
                        onOpenChange={setCreateTaskOpen}
                        projects={activeProjects}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        title="Add Task"
                        onClick={() => setCreateTaskOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>

                    <Dialog open={timerDialogOpen} onOpenChange={setTimerDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-9 w-9 ${timerState.isRunning ? 'text-primary animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Start Timer"
                            >
                                <Timer className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <form onSubmit={handleStartTimer}>
                                <DialogHeader>
                                    <DialogTitle>Start Time Tracking</DialogTitle>
                                    <DialogDescription>
                                        Select a project and describe your activity.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Project</Label>
                                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openCombobox}
                                                    className="w-full justify-between font-normal"
                                                >
                                                    {timerProjectId
                                                        ? (() => {
                                                            const p = activeProjects.find((p: any) => p.id === timerProjectId)
                                                            return p ? `${p.siteName} - ${p.services.map((s: any) => s.serviceName).join(", ")}` : "Select project..."
                                                        })()
                                                        : "Select project..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search projects..." />
                                                    <CommandList>
                                                        <CommandEmpty>No project found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {activeProjects.map((p: any) => {
                                                                const label = `${p.siteName} - ${p.services.map((s: any) => s.serviceName).join(", ")}`
                                                                return (
                                                                    <CommandItem
                                                                        key={p.id}
                                                                        value={label}
                                                                        onSelect={() => {
                                                                            setTimerProjectId(p.id)
                                                                            setOpenCombobox(false)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                timerProjectId === p.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {label}
                                                                    </CommandItem>
                                                                )
                                                            })}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="task">Description</Label>
                                        <Input
                                            id="task"
                                            placeholder="What are you working on?"
                                            value={timerDescription}
                                            onChange={(e) => setTimerDescription(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={!timerDescription || !timerProjectId}>Start Timer</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
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
