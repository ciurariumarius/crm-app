"use client"

import * as React from "react"
import { ArrowDownUp } from "lucide-react"
import { cn } from "@/lib/utils"

type BoardSortBy = "createdAt" | "updatedAt" | "amount" | "name" | "time"
type BoardSortDirection = "asc" | "desc"

type ProjectBoardHeaderRowProps = {
    gridColumnsClassName: string
    sortBy: BoardSortBy
    sortDirection: BoardSortDirection
    onSort: (key: BoardSortBy) => void
}

export function ProjectBoardHeaderRow({
    gridColumnsClassName,
    sortBy,
    sortDirection,
    onSort,
}: ProjectBoardHeaderRowProps) {
    return (
        <div className={cn("hidden md:grid md:min-w-[1240px] xl:min-w-[1320px] items-center px-6 pb-2 gap-x-4", gridColumnsClassName)}>
            <button
                type="button"
                onClick={() => onSort("name")}
                className={cn(
                    "ui-overline inline-flex items-center gap-1.5 text-left text-xs",
                    sortBy === "name" ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
                title={`Sort by name (${sortBy === "name" ? (sortDirection === "desc" ? "Z-A" : "A-Z") : "A-Z"})`}
            >
                Project name
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <span className="ui-overline text-center text-xs text-[var(--text-muted)]">Status</span>
            <span className="ui-overline text-center text-xs text-[var(--text-muted)]">Payment</span>
            <span className="ui-overline text-center text-xs text-[var(--text-muted)]">Type</span>
            <button
                type="button"
                onClick={() => onSort("amount")}
                className={cn(
                    "ui-overline inline-flex items-center justify-end gap-1.5 text-right text-xs",
                    sortBy === "amount" ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
                title={`Sort by amount (${sortBy === "amount" && sortDirection === "desc" ? "high to low" : "low to high"})`}
            >
                Amount
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <span className="ui-overline text-center text-xs text-[var(--text-muted)]">Tasks</span>
            <button
                type="button"
                onClick={() => onSort("time")}
                className={cn(
                    "ui-overline inline-flex items-center justify-center gap-1.5 text-center text-xs",
                    sortBy === "time" ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
                title={`Sort by time (${sortBy === "time" && sortDirection === "desc" ? "most to least" : "least to most"})`}
            >
                Time
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <span className="ui-overline text-xs text-[var(--text-muted)]">Partner</span>
            <button
                type="button"
                onClick={() => onSort("createdAt")}
                className={cn(
                    "ui-overline inline-flex items-center justify-end gap-1.5 text-right text-xs",
                    sortBy === "createdAt" ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
                title={`Sort by created date (${sortBy === "createdAt" && sortDirection === "desc" ? "newest first" : "oldest first"})`}
            >
                Created
                <ArrowDownUp className="h-3 w-3" />
            </button>
        </div>
    )
}
