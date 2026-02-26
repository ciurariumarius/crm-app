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
                className="rounded-xl md:rounded-full bg-blue-600 hover:bg-blue-700 md:bg-zinc-900 md:hover:bg-zinc-800 dark:md:bg-zinc-100 dark:md:hover:bg-zinc-200 text-white md:dark:text-zinc-900 transition-all flex items-center justify-center font-bold tracking-widest text-[10px] xl:text-xs px-0 md:px-5 w-10 md:w-auto h-10 border border-transparent shadow-sm shrink-0"
            >
                <Plus className="h-5 w-5 md:h-4 md:w-4 md:mr-1.5" strokeWidth={2.5} /> <span className="hidden md:inline">NEW TASK</span>
            </Button>
            <GlobalCreateTaskDialog
                open={open}
                onOpenChange={setOpen}
                projects={projects}
            />
        </>
    )
}
