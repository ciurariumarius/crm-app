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
                className={cn("header-action-button shrink-0", className)}
            >
                <Plus className="h-4 w-4 md:mr-1.5" strokeWidth={2.5} />
                <span className={showLabelOnMobile ? "inline text-sm font-semibold" : "header-action-label"}>
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
