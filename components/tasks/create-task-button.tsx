"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"
import { cn } from "@/lib/utils"

interface CreateTaskButtonProps {
    projects: {
        id: string
        status: string
        siteName?: string
        site?: { domainName?: string }
        services?: { serviceName: string; isRecurring?: boolean }[]
        createdAt?: Date | string
    }[]
    className?: string
    label?: string
    showLabelOnMobile?: boolean
}

export function CreateTaskButton({
    projects,
    className,
    label = "Add Task",
    showLabelOnMobile = false,
}: CreateTaskButtonProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                className={cn(
                    "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 sm:px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]",
                    className
                )}
            >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className={showLabelOnMobile ? "inline" : "hidden sm:inline"}>
                    {label}
                </span>
            </Button>
            <GlobalCreateTaskDialog
                open={open}
                onOpenChange={setOpen}
                projects={projects}
            />
        </>
    )
}
