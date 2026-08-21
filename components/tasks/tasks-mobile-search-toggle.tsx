"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTasksSearchContext } from "./tasks-search-context"

export function TasksMobileSearchTrigger() {
    const searchContext = useTasksSearchContext()
    
    return (
        <Button 
            variant="outline" 
            size="icon"
            onClick={() => searchContext?.setMobileSearchExpanded(!searchContext.mobileSearchExpanded)}
            className="h-11 w-11 shrink-0 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] shadow-[var(--shadow-apple)] hover:bg-[var(--surface-low)] hover:text-[var(--text-primary)] md:hidden"
            aria-label="Toggle search"
            aria-expanded={searchContext?.mobileSearchExpanded}
        >
            <Search className="h-4.5 w-4.5" />
        </Button>
    )
}
