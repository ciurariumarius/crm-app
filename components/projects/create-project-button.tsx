"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GlobalCreateProjectDialog } from "./global-create-project-dialog"
import { PartnerWithSites } from "@/types"
import { Service } from "@prisma/client"
import { cn } from "@/lib/utils"

interface CreateProjectButtonProps {
    partners: PartnerWithSites[]
    services: Service[]
    variant?: "icon" | "full"
    className?: string
    label?: string
}

export function CreateProjectButton({
    partners,
    services,
    variant = "icon",
    className,
    label = "Add Project",
}: CreateProjectButtonProps) {
    const [open, setOpen] = useState(false)

    const isFull = variant === "full"

    return (
        <div className="relative z-50">
            <Button
                onClick={() => setOpen(true)}
                size={isFull ? "default" : "icon"}
                className={
                    isFull
                        ? cn("header-action-button shadow-lg shadow-primary/20 active:scale-[0.98]", className)
                        : `h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-white transition-all active:scale-[0.98] flex items-center justify-center flex-shrink-0 ${className ?? ""}`
                }
                title="Add new project"
            >
                <Plus className={isFull ? "h-5 w-5 md:h-4 md:w-4" : "h-5 w-5 md:h-6 md:w-6"} strokeWidth={2.5} />
                {isFull && <span className="header-action-label">{label}</span>}
            </Button>
            <GlobalCreateProjectDialog
                open={open}
                onOpenChange={setOpen}
                partners={partners}
                services={services}
            />
        </div >
    )
}
