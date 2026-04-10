"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FolderPlus } from "lucide-react"
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
    showLabelOnMobile?: boolean
}

export function CreateProjectButton({
    partners,
    services,
    variant = "icon",
    className,
    label = "Add Project",
    showLabelOnMobile = false,
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
                        ? cn("header-action-button", className)
                        : cn("header-action-button md:min-w-0 md:px-0", className)
                }
                title="Add new project"
            >
                <FolderPlus className={isFull ? "h-5 w-5 md:h-4 md:w-4" : "h-5 w-5"} strokeWidth={2.3} />
                {isFull && (
                    <span className={showLabelOnMobile ? "inline text-sm font-semibold" : "header-action-label"}>
                        {label}
                    </span>
                )}
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
