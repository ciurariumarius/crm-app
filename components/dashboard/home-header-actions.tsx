"use client"

import * as React from "react"
import { CirclePlus, FolderPlus, WalletCards } from "lucide-react"
import type { Service } from "@prisma/client"
import type { PartnerWithSites } from "@/types"
import type { TaskDialogProject } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { AddPartnerPaymentDialog } from "@/components/payments/add-partner-payment-dialog"

interface HomeHeaderActionsProps {
    partners: PartnerWithSites[]
    services: Service[]
    projects: TaskDialogProject[]
    mobile?: boolean
}

export function HomeHeaderActions({ partners, services, projects, mobile = false }: HomeHeaderActionsProps) {
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createPaymentOpen, setCreatePaymentOpen] = React.useState(false)

    const paymentPartners = React.useMemo(
        () => partners.map((partner) => ({ id: partner.id, name: partner.name })),
        [partners]
    )

    return (
        <>
            {mobile ? (
                <div className="grid grid-cols-3 gap-2 md:hidden">
                    <button
                        type="button"
                        onClick={() => setCreateTaskOpen(true)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-[12px] font-bold text-primary-foreground shadow-sm transition-colors hover:brightness-95"
                    >
                        <CirclePlus className="h-4 w-4" />
                        Task
                    </button>

                    <button
                        type="button"
                        onClick={() => setCreateProjectOpen(true)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[var(--primary)] shadow-sm transition-colors hover:bg-slate-50"
                    >
                        <FolderPlus className="h-4 w-4 stroke-[2.5px]" />
                        Project
                    </button>

                    <button
                        type="button"
                        onClick={() => setCreatePaymentOpen(true)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-[var(--primary)] shadow-sm transition-colors hover:bg-slate-50"
                    >
                        <WalletCards className="h-4 w-4 stroke-[2.5px]" />
                        Payment
                    </button>
                </div>
            ) : (
                <div className="flex items-center rounded-[16px] border border-slate-100 bg-white p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setCreateTaskOpen(true)}
                        className="inline-flex h-[34px] items-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground shadow-sm transition-colors hover:brightness-95"
                    >
                        <CirclePlus className="h-4 w-4" />
                        Add Task
                    </button>

                    <div className="mx-2 h-4 w-px bg-slate-200" />

                    <button
                        type="button"
                        onClick={() => setCreateProjectOpen(true)}
                        className="inline-flex h-[34px] items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-[var(--primary)] transition-colors hover:bg-slate-50"
                    >
                        <FolderPlus className="h-4 w-4 stroke-[2.5px]" />
                        Add Project
                    </button>

                    <button
                        type="button"
                        onClick={() => setCreatePaymentOpen(true)}
                        className="inline-flex h-[34px] items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-[var(--primary)] transition-colors hover:bg-slate-50"
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
                hideTrigger
            />
        </>
    )
}
