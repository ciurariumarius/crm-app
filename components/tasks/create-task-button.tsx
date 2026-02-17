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
                className="flex items-center gap-2 font-bold h-11 px-6 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
            >
                <Plus className="h-4 w-4" />
                Add new task
            </Button>
            <GlobalCreateTaskDialog
                open={open}
                onOpenChange={setOpen}
                projects={projects}
            />
        </>
    )
}
