"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { useState } from "react"

interface TimeLogsFiltersProps {
    partners: { id: string; name: string }[]
    projects: { id: string; displayName: string; site: { partnerId: string } }[]
}

export function TimeLogsFilters({ partners, projects }: TimeLogsFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const partnerId = searchParams.get("partnerId") || "all"
    const projectId = searchParams.get("projectId") || "all"
    const [open, setOpen] = useState(false)

    const handlePartnerChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "all") {
            params.delete("partnerId")
        } else {
            params.set("partnerId", value)
            // Selecting a partner clears specific project selection to show broad partner logs
            params.delete("projectId")
        }
        router.push(`/time?${params.toString()}`)
    }

    const handleProjectChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "all") {
            params.delete("projectId")
        } else {
            params.set("projectId", value)
            // Selecting a specific project overrides/clears partner filter (as project implies partner)
            params.delete("partnerId")
        }
        setOpen(false)
        router.push(`/time?${params.toString()}`)
    }

    // Filter projects based on selected partner, IF a partner is selected
    const filteredProjects = partnerId !== "all"
        ? projects.filter(p => p.site.partnerId === partnerId)
        : projects

    return (
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-[250px]">
                <Select value={partnerId} onValueChange={handlePartnerChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by Partner" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Partners</SelectItem>
                        {partners.map((partner) => (
                            <SelectItem key={partner.id} value={partner.id}>
                                {partner.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="w-full sm:w-[350px]">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between font-normal"
                        >
                            {projectId !== "all"
                                ? projects.find((project) => project.id === projectId)?.displayName
                                : "Filter by Project..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0 !pointer-events-auto" align="start">
                        <Command>
                            <CommandInput placeholder="Search project..." />
                            <CommandList className="max-h-[300px] overflow-y-auto">
                                <CommandEmpty>No project found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        value="all"
                                        className="cursor-pointer"
                                        onSelect={() => {
                                            handleProjectChange("all")
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                projectId === "all" ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        All Projects
                                    </CommandItem>
                                    {filteredProjects.map((project) => (
                                        <CommandItem
                                            key={project.id}
                                            value={`${project.displayName} ${project.id}`} // Ensure uniqueness for cmdk
                                            className="cursor-pointer"
                                            onSelect={() => {
                                                handleProjectChange(project.id)
                                                setOpen(false)
                                            }}
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                            }}
                                            onClick={() => {
                                                // Backup for click if onSelect fails
                                                handleProjectChange(project.id)
                                                setOpen(false)
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    projectId === project.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {project.displayName}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
        </div >
    )
}
