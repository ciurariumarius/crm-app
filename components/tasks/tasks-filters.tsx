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
import { Search, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TasksFilters() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [search, setSearch] = React.useState(searchParams.get("q") || "")

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
        setSearch("")
        router.push(pathname)
    }

    return (
        <div className="flex flex-col md:flex-row items-center gap-4 bg-card/50 p-4 rounded-xl border border-dashed border-primary/20">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search tasks or partners..."
                    className="pl-9 h-10 bg-background/50 border-none shadow-none focus-visible:ring-primary/20"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") updateFilters("q", search)
                    }}
                />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <Select
                    defaultValue={searchParams.get("status") || "All"}
                    onValueChange={(val) => updateFilters("status", val)}
                >
                    <SelectTrigger className="w-full md:w-[180px] h-10 bg-background/50 border-none shadow-none text-xs font-bold">
                        <div className="flex items-center gap-2">
                            <Filter className="h-3 w-3" />
                            <SelectValue placeholder="Status" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All" className="text-xs font-bold">ALL TASKS</SelectItem>
                        <SelectItem value="Incomplete" className="text-xs font-bold text-orange-500">INCOMPLETE</SelectItem>
                        <SelectItem value="Completed" className="text-xs font-bold text-emerald-500">COMPLETED</SelectItem>
                        <SelectItem value="In Progress" className="text-xs font-bold text-blue-500">IN PROGRESS ONLY</SelectItem>
                    </SelectContent>
                </Select>

                {(search || searchParams.toString()) && (
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
