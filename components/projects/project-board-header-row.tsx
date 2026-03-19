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
        <div className={cn("hidden md:grid items-center px-6 gap-x-2", gridColumnsClassName)}>
            <button
                type="button"
                onClick={() => onSort("name")}
                className={cn(
                    "ui-overline inline-flex items-center gap-1 text-left",
                    sortBy === "name" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
                title={`Sort by name (${sortBy === "name" ? (sortDirection === "desc" ? "Z-A" : "A-Z") : "A-Z"})`}
            >
                Project name
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <span className="ui-overline text-center text-slate-500">Status</span>
            <span className="ui-overline text-center text-slate-500">Payment</span>
            <span className="ui-overline text-center text-slate-500">Type</span>
            <button
                type="button"
                onClick={() => onSort("amount")}
                className={cn(
                    "ui-overline inline-flex items-center justify-end gap-1 text-right",
                    sortBy === "amount" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
                title={`Sort by amount (${sortBy === "amount" && sortDirection === "desc" ? "high to low" : "low to high"})`}
            >
                Amount
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <span className="ui-overline text-center text-slate-500">Tasks</span>
            <button
                type="button"
                onClick={() => onSort("time")}
                className={cn(
                    "ui-overline inline-flex items-center justify-center gap-1 text-center",
                    sortBy === "time" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
                title={`Sort by time (${sortBy === "time" && sortDirection === "desc" ? "most to least" : "least to most"})`}
            >
                Time
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <span className="ui-overline text-slate-500">Partner</span>
            <button
                type="button"
                onClick={() => onSort("updatedAt")}
                className={cn(
                    "ui-overline inline-flex items-center justify-end gap-1 text-right",
                    sortBy === "updatedAt" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
                title={`Sort by last edit (${sortBy === "updatedAt" && sortDirection === "desc" ? "newest first" : "oldest first"})`}
            >
                Last Edit
                <ArrowDownUp className="h-3 w-3" />
            </button>
            <button
                type="button"
                onClick={() => onSort("createdAt")}
                className={cn(
                    "ui-overline inline-flex items-center justify-end gap-1 text-right",
                    sortBy === "createdAt" ? "text-slate-700" : "text-slate-500 hover:text-slate-700"
                )}
                title={`Sort by created date (${sortBy === "createdAt" && sortDirection === "desc" ? "newest first" : "oldest first"})`}
            >
                Created
                <ArrowDownUp className="h-3 w-3" />
            </button>
        </div>
    )
}

