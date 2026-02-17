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
            <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors outline-none whitespace-nowrap min-w-[120px] justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 opacity-50" />
                    <span className={cn(period !== "all_time" && "text-primary")}>{currentLabel}</span>
                </div>
                <ChevronDown className="h-3 w-3 opacity-30" />
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
