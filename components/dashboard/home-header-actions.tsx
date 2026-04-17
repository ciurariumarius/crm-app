"use client"

import * as React from "react"
import { ChevronDown, CirclePlus, FolderPlus, WalletCards } from "lucide-react"
import type { Service } from "@prisma/client"
import type { PartnerWithSites } from "@/types"
import type { TaskDialogProject } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { AddPartnerPaymentDialog } from "@/components/payments/add-partner-payment-dialog"
import { useResponsiveProfile } from "@/hooks/use-responsive-profile"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface HomeHeaderActionsProps {
    partners: PartnerWithSites[]
    services: Service[]
    projects: TaskDialogProject[]
    mobile?: boolean
    compact?: boolean
}

export function HomeHeaderActions({ partners, services, projects, mobile = false, compact = false }: HomeHeaderActionsProps) {
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createPaymentOpen, setCreatePaymentOpen] = React.useState(false)
    const responsiveProfile = useResponsiveProfile()
    const useCompact = compact || responsiveProfile === "tablet-portrait"

    const paymentPartners = React.useMemo(
        () => partners.map((partner) => ({ id: partner.id, name: partner.name })),
        [partners]
    )
    const paymentServices = React.useMemo(
        () =>
            services
                .filter((service) => !service.isRecurring)
                .map((service) => ({ id: service.id, name: service.serviceName })),
        [services]
    )

    return (
        <>
            {mobile ? (
                <div className="grid grid-cols-3 gap-2.5 md:hidden">
                    <button
                        type="button"
                        onClick={() => setCreateTaskOpen(true)}
                        className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[22px] bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-sm transition-colors hover:brightness-95"
                    >
                        <CirclePlus className="h-4 w-4" />
                        Task
                    </button>

                    <button
                        type="button"
                        onClick={() => setCreateProjectOpen(true)}
                        className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[22px] border border-slate-200 bg-white px-3 text-[11px] font-bold text-[var(--primary)] shadow-sm transition-colors hover:bg-slate-50"
                    >
                        <FolderPlus className="h-4 w-4 stroke-[2.5px]" />
                        Project
                    </button>

                    <button
                        type="button"
                        onClick={() => setCreatePaymentOpen(true)}
                        className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[22px] border border-slate-200 bg-white px-3 text-[11px] font-bold text-[var(--primary)] shadow-sm transition-colors hover:bg-slate-50"
                    >
                        <WalletCards className="h-4 w-4 stroke-[2.5px]" />
                        Payment
                    </button>
                </div>
            ) : useCompact ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex h-[36px] shrink-0 items-center gap-2 rounded-[13px] bg-primary px-3.5 text-[13px] font-bold text-primary-foreground shadow-sm transition-colors hover:brightness-95"
                        >
                            <CirclePlus className="h-4 w-4" />
                            Add
                            <ChevronDown className="h-3.5 w-3.5 opacity-90" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl">
                        <DropdownMenuItem onClick={() => setCreateTaskOpen(true)} className="cursor-pointer font-medium">
                            <CirclePlus className="mr-2 h-4 w-4" />
                            Add Task
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCreateProjectOpen(true)} className="cursor-pointer font-medium">
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Add Project
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCreatePaymentOpen(true)} className="cursor-pointer font-medium">
                            <WalletCards className="mr-2 h-4 w-4" />
                            Add Payment
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <div className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[18px] border border-slate-200/90 bg-white/95 p-1 shadow-[0_6px_18px_rgba(15,23,42,0.04)] xl:p-1.5">
                    <button
                        type="button"
                        onClick={() => setCreateTaskOpen(true)}
                        className="inline-flex h-[36px] items-center gap-2 rounded-[13px] bg-primary px-3.5 xl:px-4 text-[13px] font-bold text-primary-foreground shadow-sm transition-colors hover:brightness-95"
                    >
                        <CirclePlus className="h-4 w-4" />
                        Add Task
                    </button>

                    <div className="mx-1.5 h-4 w-px bg-slate-200 xl:mx-2" />

                    <button
                        type="button"
                        onClick={() => setCreateProjectOpen(true)}
                        className="inline-flex h-[36px] items-center gap-2 rounded-[13px] px-3 text-[13px] font-bold text-[var(--primary)] transition-colors hover:bg-slate-50 xl:px-3.5"
                    >
                        <FolderPlus className="h-4 w-4 stroke-[2.5px]" />
                        Add Project
                    </button>

                    <button
                        type="button"
                        onClick={() => setCreatePaymentOpen(true)}
                        className="inline-flex h-[36px] items-center gap-2 rounded-[13px] px-3 text-[13px] font-bold text-[var(--primary)] transition-colors hover:bg-slate-50 xl:px-3.5"
                    >
                        <WalletCards className="h-4 w-4 stroke-[2.5px]" />
                        Add Payment
                    </button>
                </div>
            )}

            <GlobalCreateTaskDialog
                open={createTaskOpen}
                onOpenChange={setCreateTaskOpen}
                projects={projects}
            />

            <GlobalCreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                partners={partners}
                services={services}
            />

            <AddPartnerPaymentDialog
                open={createPaymentOpen}
                onOpenChange={setCreatePaymentOpen}
                partners={paymentPartners}
                services={paymentServices}
                hideTrigger
            />
        </>
    )
}
