"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronDown, Filter, X, Briefcase, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface TasksToolbarProps {
    projects: { id: string; name: string }[]
    partners: { id: string; name: string }[]
    totalTasks: number
}

export function TasksToolbar({ projects, partners, totalTasks }: TasksToolbarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const updateFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString())

        if (value === "All") {
            params.set(key, "All")
        } else if (!value || value === "all") {
            params.delete(key)
        } else {
            params.set(key, value)
        }

        params.delete("page")
        router.push(`/tasks?${params.toString()}`)
    }

    const currentProject = searchParams.get("projectId") || "all"
    const currentPartner = searchParams.get("partnerId") || "all"
    const currentStatus = searchParams.get("status") || "Active"
    const currentPriority = searchParams.get("urgency") || "all"

    return (
        <div className="flex flex-col xl:flex-row items-center justify-between bg-card rounded-xl border border-border/60 shadow-sm p-2 w-full z-40 gap-4 mt-2 mb-6 transition-all">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 lg:gap-4 w-full xl:w-auto">
                {/* Status Pills */}
                <div className="flex bg-muted/30 p-1 rounded-xl items-center flex-wrap">
                    {[
                        { label: "ALL", value: "All" },
                        { label: "ACTIVE", value: "Active", dot: "bg-blue-500" },
                        { label: "PAUSED", value: "Paused", dot: "bg-amber-500" },
                        { label: "DONE", value: "Completed", dot: "bg-emerald-500" }
                    ].map((opt) => {
                        const isActive = (opt.value === "All" && (currentStatus === "All" || !currentStatus)) || currentStatus === opt.value
                        return (
                            <button
                                key={opt.value}
                                onClick={() => updateFilter("status", opt.value)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center gap-2",
                                    isActive
                                        ? "bg-white shadow-sm border border-border/40 text-foreground font-semibold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium border border-transparent"
                                )}
                            >
                                {opt.dot && <div className={cn("w-1.5 h-1.5 rounded-full", opt.dot, !isActive && "opacity-50")} />}
                                {opt.label}
                            </button>
                        )
                    })}
                </div>

                <div className="w-px h-8 bg-border/60 hidden md:block" />

                {/* Priority Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs items-center font-medium text-muted-foreground/60 mr-2 ml-1 hidden lg:flex">Priority</span>
                    {[
                        { label: "Urgent", value: "Urgent" },
                        { label: "Normal", value: "Normal" },
                        { label: "Idea", value: "Idea" }
                    ].map((opt) => {
                        const isActive = currentPriority === opt.value
                        return (
                            <button
                                key={opt.value}
                                onClick={() => updateFilter("urgency", isActive ? "all" : opt.value)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 border",
                                    isActive
                                        ? "bg-muted/50 text-foreground border-border/60"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-transparent"
                                )}
                            >
                                {opt.label}
                            </button>
                        )
                    })}
                </div>

                <div className="w-px h-8 bg-border/60 hidden lg:block" />

                {/* Dropdowns */}
                <div className="flex flex-wrap flex-1 items-center gap-2 justify-center">
                    <ProjectCombobox
                        projects={projects}
                        currentProject={currentProject}
                        onSelect={(val) => {
                            updateFilter("projectId", val)
                            if (val !== "all") updateFilter("partnerId", "all")
                        }}
                    />

                    <PartnerCombobox
                        partners={partners}
                        currentPartner={currentPartner}
                        onSelect={(val) => {
                            updateFilter("partnerId", val)
                            if (val !== "all") updateFilter("projectId", "all")
                        }}
                    />

                    <button className="flex items-center justify-between gap-2 h-9 px-3 rounded-lg hover:bg-muted/50 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent">
                        <div className="flex flex-row items-center gap-2">
                            <Calendar className="w-4 h-4 opacity-50" />
                            <span>Date Range</span>
                        </div>
                        <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
                    </button>
                </div>
            </div>

            {/* Tasks Found */}
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-xl shrink-0">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/50" />
                <span className="text-xs font-semibold text-muted-foreground">
                    {totalTasks} TASK{totalTasks !== 1 ? 'S' : ''} FOUND
                </span>
            </div>
        </div>
    )
}

function ProjectCombobox({
    projects,
    currentProject,
    onSelect
}: {
    projects: { id: string, name: string }[],
    currentProject: string | null,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentProject && currentProject !== "all"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 h-9 px-3 rounded-lg transition-colors text-xs font-medium border",
                        isActive ? "bg-primary/5 text-primary border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                    )}
                >
                    <Briefcase className="w-4 h-4 opacity-50" />
                    <span className="truncate max-w-[120px]">
                        {isActive
                            ? projects.find((project) => project.id === currentProject)?.name
                            : "Project"}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 rounded-xl border-border/60 shadow-md" align="start">
                <Command>
                    <CommandInput placeholder="Search project..." className="text-sm font-medium" />
                    <CommandList className="p-1">
                        <CommandEmpty>No project found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="all projects"
                                onSelect={() => {
                                    onSelect("all")
                                    setOpen(false)
                                }}
                                className="text-sm font-medium rounded-xl cursor-pointer py-2 px-3"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        !currentProject || currentProject === "all" ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                All Projects
                            </CommandItem>
                            {projects.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    value={project.name}
                                    onSelect={() => {
                                        onSelect(project.id)
                                        setOpen(false)
                                    }}
                                    className="text-sm font-medium rounded-xl cursor-pointer py-2 px-3"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentProject === project.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {project.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function PartnerCombobox({
    partners,
    currentPartner,
    onSelect
}: {
    partners: { id: string, name: string }[],
    currentPartner: string | null,
    onSelect: (val: string) => void
}) {
    const [open, setOpen] = React.useState(false)
    const isActive = currentPartner && currentPartner !== "all"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 h-9 px-3 rounded-lg transition-colors text-xs font-medium border",
                        isActive ? "bg-primary/5 text-primary border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent"
                    )}
                >
                    <Users className="w-4 h-4 opacity-50" />
                    <span className="truncate max-w-[120px]">
                        {isActive
                            ? partners.find((partner) => partner.id === currentPartner)?.name
                            : "Partner"}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 rounded-xl border-border/60 shadow-md" align="start">
                <Command>
                    <CommandInput placeholder="Search partner..." className="text-sm font-medium" />
                    <CommandList className="p-1">
                        <CommandEmpty>No partner found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="all partners"
                                onSelect={() => {
                                    onSelect("all")
                                    setOpen(false)
                                }}
                                className="text-sm font-medium rounded-xl cursor-pointer py-2 px-3"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        !currentPartner || currentPartner === "all" ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                All Partners
                            </CommandItem>
                            {partners.map((partner) => (
                                <CommandItem
                                    key={partner.id}
                                    value={partner.name}
                                    onSelect={() => {
                                        onSelect(partner.id)
                                        setOpen(false)
                                    }}
                                    className="text-sm font-medium rounded-xl cursor-pointer py-2 px-3"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentPartner === partner.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {partner.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
