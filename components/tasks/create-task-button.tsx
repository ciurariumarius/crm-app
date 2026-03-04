"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GlobalCreateTaskDialog } from "./global-create-task-dialog"

interface CreateTaskButtonProps {
    projects: any[]
}

export function CreateTaskButton({ projects }: CreateTaskButtonProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                className="header-action-button shrink-0"
            >
                <Plus className="h-4 w-4 md:mr-1.5" strokeWidth={2.5} />
                <span className="header-action-label">NEW TASK</span>
            </Button>
            <GlobalCreateTaskDialog
                open={open}
                onOpenChange={setOpen}
                projects={projects}
            />
        </>
    )
}
