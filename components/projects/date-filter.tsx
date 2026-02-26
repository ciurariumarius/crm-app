"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function DateFilter() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const period = searchParams.get("period") || "all_time"

    const periods = [
        { label: "All Time", value: "all_time" },
        { label: "This Month", value: "this_month" },
        { label: "Last Month", value: "last_month" },
        { label: "This Year", value: "this_year" },
        { label: "Last Year", value: "last_year" },
    ]

    const updatePeriod = (val: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (val && val !== "all_time") {
            params.set("period", val)
        } else {
            params.delete("period")
        }
        params.delete("page")
        router.push(`/projects?${params.toString()}`)
    }

    const currentLabel = periods.find(p => p.value === period)?.label || "All Time"

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 h-10 px-4 bg-white dark:bg-zinc-900 border border-border/60 shadow-sm rounded-xl transition-colors hover:bg-muted/50 text-[10px] font-bold tracking-widest uppercase outline-none shrink-0 snap-start">
                <Calendar className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <span className={cn(period !== "all_time" ? "text-foreground" : "text-muted-foreground")}>
                    {period !== "all_time" ? currentLabel : "TIMELINE"}
                </span>
                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px] bg-popover/95 backdrop-blur-sm z-50 p-1">
                {periods.map((p) => (
                    <DropdownMenuItem
                        key={p.value}
                        onSelect={() => updatePeriod(p.value)}
                        className="text-[10px] font-bold uppercase tracking-wider py-2 cursor-pointer"
                    >
                        {p.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
