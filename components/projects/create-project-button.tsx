"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GlobalCreateProjectDialog } from "./global-create-project-dialog"
import { PartnerWithSites } from "@/types"
import { Service } from "@prisma/client"

interface CreateProjectButtonProps {
    partners: PartnerWithSites[]
    services: Service[]
}

export function CreateProjectButton({ partners, services }: CreateProjectButtonProps) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative z-50">
            <Button
                onClick={() => setOpen(true)}
                size="icon"
                className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 text-white transition-all flex items-center justify-center flex-shrink-0"
                title="Add new project"
            >
                <Plus className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2.5} />
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
