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
                size="icon"
                className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20 text-white transition-all flex items-center justify-center flex-shrink-0"
                title="Add new task"
            >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>
            <GlobalCreateTaskDialog
                open={open}
                onOpenChange={setOpen}
                projects={projects}
            />
        </>
    )
}
