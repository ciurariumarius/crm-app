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
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 transition-all flex items-center justify-center font-bold tracking-widest text-[10px] xl:text-xs px-5 h-10 border border-transparent shadow-sm"
            >
                <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} /> NEW TASK
            </Button>
            <GlobalCreateTaskDialog
                open={open}
                onOpenChange={setOpen}
                projects={projects}
            />
        </>
    )
}
