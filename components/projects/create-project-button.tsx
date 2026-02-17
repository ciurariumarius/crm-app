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
                className="flex items-center gap-3 font-black uppercase tracking-widest h-12 px-8 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all text-xs"
            >
                <Plus className="h-4 w-4" />
                Add new project
            </Button>
            <GlobalCreateProjectDialog
                open={open}
                onOpenChange={setOpen}
                partners={partners}
                services={services}
            />
        </div>
    )
}
