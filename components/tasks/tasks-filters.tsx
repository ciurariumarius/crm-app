"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, Filter, X, Briefcase, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TasksFiltersProps {
    partners?: { id: string; name: string }[]
    projects?: { id: string; name: string; siteName?: string }[]
}

export function TasksFilters({ partners = [], projects = [] }: TasksFiltersProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [selectedPartner, setSelectedPartner] = React.useState(searchParams.get("partnerId") || "All")
    const [selectedProject, setSelectedProject] = React.useState(searchParams.get("projectId") || "All")

    const updateFilters = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== "All") {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        router.push(`${pathname}?${params.toString()}`)
    }

    const clearFilters = () => {
        setSelectedPartner("All")
        setSelectedProject("All")
        router.push(pathname)
    }

    return (
        <div className="flex flex-col md:flex-row items-center gap-4 bg-card/50 p-4 rounded-xl border border-dashed border-primary/20 w-full">
            <div className="flex flex-1 items-center gap-4 w-full">
                <div className="flex-1">
                    <Select
                        value={selectedPartner}
                        onValueChange={(val) => {
                            setSelectedPartner(val)
                            updateFilters("partnerId", val)
                        }}
                    >
                        <SelectTrigger className="w-full h-10 bg-background/50 border-none shadow-none text-xs font-bold">
                            <div className="flex items-center gap-2">
                                <Users className="h-3 w-3" />
                                <SelectValue placeholder="Partner" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All" className="text-xs font-bold">ALL PARTNERS</SelectItem>
                            {partners.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs font-bold">{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex-1">
                    <Select
                        value={selectedProject}
                        onValueChange={(val) => {
                            setSelectedProject(val)
                            updateFilters("projectId", val)
                        }}
                    >
                        <SelectTrigger className="w-full h-10 bg-background/50 border-none shadow-none text-xs font-bold">
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-3 w-3" />
                                <SelectValue placeholder="Project" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All" className="text-xs font-bold">ALL PROJECTS</SelectItem>
                            {projects.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs font-bold">{p.name || p.siteName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <Select
                    defaultValue={searchParams.get("status") || "All"}
                    onValueChange={(val) => updateFilters("status", val)}
                >
                    <SelectTrigger className="w-full md:w-[150px] h-10 bg-background/50 border-none shadow-none text-xs font-bold">
                        <div className="flex items-center gap-2">
                            <Filter className="h-3 w-3" />
                            <SelectValue placeholder="Status" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All" className="text-xs font-bold">ALL TASKS</SelectItem>
                        <SelectItem value="Active" className="text-xs font-bold text-blue-500">ACTIVE</SelectItem>
                        <SelectItem value="Paused" className="text-xs font-bold text-orange-500">PAUSED</SelectItem>
                        <SelectItem value="Completed" className="text-xs font-bold text-emerald-500">COMPLETED</SelectItem>
                    </SelectContent>
                </Select>

                {(selectedPartner !== "All" || selectedProject !== "All" || searchParams.get("status")) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 px-3 hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground transition-colors"
                        onClick={clearFilters}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}
