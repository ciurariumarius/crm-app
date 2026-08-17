"use client"

import * as React from "react"
import Link from "next/link"
import { CirclePlus, FolderPlus, NotebookPen, WalletCards } from "lucide-react"
import type { Service } from "@prisma/client"
import type { PartnerWithSites } from "@/types"
import type { TaskDialogProject } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateTaskDialog } from "@/components/tasks/global-create-task-dialog"
import { GlobalCreateProjectDialog } from "@/components/projects/global-create-project-dialog"
import { AddPartnerPaymentDialog } from "@/components/payments/add-partner-payment-dialog"
import { Button } from "@/components/ui/button"

interface HomeHeaderActionsProps {
    partners: PartnerWithSites[]
    services: Service[]
    projects: TaskDialogProject[]
}

export function HomeHeaderActions({ partners, services, projects }: HomeHeaderActionsProps) {
    const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
    const [createProjectOpen, setCreateProjectOpen] = React.useState(false)
    const [createPaymentOpen, setCreatePaymentOpen] = React.useState(false)

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

    const actionClassName = "h-12 w-full justify-start rounded-[12px] px-4 sm:justify-center"

    return (
        <section
            aria-label="Quick actions"
            className="rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-2.5 shadow-[var(--shadow-apple)] sm:p-3"
        >
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                <Button
                    type="button"
                    onClick={() => setCreateTaskOpen(true)}
                    className={actionClassName}
                >
                    <CirclePlus className="h-4.5 w-4.5" />
                    Add Task
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateProjectOpen(true)}
                    className={actionClassName}
                >
                    <FolderPlus className="h-4.5 w-4.5" />
                    Add Project
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreatePaymentOpen(true)}
                    className={actionClassName}
                >
                    <WalletCards className="h-4.5 w-4.5" />
                    Add Payment
                </Button>

                <Button asChild variant="outline" className={actionClassName}>
                    <Link href="/notes?new=1">
                        <NotebookPen className="h-4.5 w-4.5" />
                        Add Note
                    </Link>
                </Button>
            </div>

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
        </section>
    )
}
