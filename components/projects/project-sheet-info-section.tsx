"use client"

import * as React from "react"
import { ArrowUpRight, Check, FolderOpen, Globe, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidePanelChip, SidePanelInfoCard, SidePanelSectionTitle } from "@/components/ui/side-panel-primitives"
import { StatusChip } from "@/components/ui/status-chip"

type ServiceOption = {
    id: string
    serviceName: string
}

type SelectedService = {
    id: string
    serviceName: string
}

type ProjectSheetInfoSectionProps = {
    partnerName: string
    domainName: string
    onOpenPartner: () => void
    onOpenSitePanel: () => void
    externalSiteUrl: string | null
    services: SelectedService[]
    isEditingServices: boolean
    onToggleEditServices: () => void
    onToggleService: (serviceId: string) => void
    recurringServices: ServiceOption[]
    oneTimeServices: ServiceOption[]
}

export function ProjectSheetInfoSection({
    partnerName,
    domainName,
    onOpenPartner,
    onOpenSitePanel,
    externalSiteUrl,
    services,
    isEditingServices,
    onToggleEditServices,
    onToggleService,
    recurringServices,
    oneTimeServices,
}: ProjectSheetInfoSectionProps) {
    return (
        <section className="space-y-3 border-t border-[var(--line-subtle)] pt-3">
            <SidePanelSectionTitle title="Project info" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={onOpenPartner} className="text-left">
                    <SidePanelInfoCard
                        title="Partner"
                        subtitle={<p className="truncate text-base font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-lg">{partnerName}</p>}
                        action={<FolderOpen className="h-4 w-4 text-[var(--text-muted)] transition group-hover:text-[var(--text-secondary)]" />}
                    />
                </button>

                <SidePanelInfoCard
                    title="Domain"
                    subtitle={
                        <button
                            type="button"
                            onClick={onOpenSitePanel}
                            className="truncate text-left text-base font-black leading-tight tracking-tight text-[var(--text-primary)] transition hover:text-blue-600 sm:text-lg"
                            title="Open site panel"
                        >
                            {domainName}
                        </button>
                    }
                    action={
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)] transition group-hover:text-[var(--text-secondary)]">
                            <Globe className="h-4 w-4" />
                            <ArrowUpRight className="h-4 w-4" />
                        </span>
                    }
                >
                    <div className="flex items-center gap-2">
                        {externalSiteUrl ? (
                            <a href={externalSiteUrl} target="_blank" rel="noopener noreferrer">
                                <SidePanelChip
                                    tone="blue"
                                    label={
                                        <>
                                            Open website
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                        </>
                                    }
                                    className="rounded-lg px-2.5 py-1.5 text-[10px]"
                                />
                            </a>
                        ) : (
                            <SidePanelChip tone="slate" label="Open website" className="cursor-not-allowed rounded-lg px-2.5 py-1.5 text-[10px] opacity-70" />
                        )}
                    </div>
                </SidePanelInfoCard>
            </div>

            <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4 shadow-[var(--shadow-apple)]">
                <div className="flex items-center justify-between gap-3">
                    <SidePanelSectionTitle title="Project services" className="text-xs" />
                    <button
                        type="button"
                        onClick={onToggleEditServices}
                        className="rounded-full border border-[var(--line-subtle)] px-3.5 py-1.5 ui-text-caption font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-low)]"
                    >
                        + Add
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    {services.map((service) => (
                        <button
                            key={service.id}
                            type="button"
                            onClick={() => onToggleService(service.id)}
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100/70"
                        >
                            {service.serviceName}
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ))}
                </div>
            </div>

            {isEditingServices && (
                <div className="rounded-[20px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <StatusChip tone="recurring" size="xs" className="mb-2">Recurring</StatusChip>
                            <div className="mt-2 space-y-2">
                                {recurringServices.map((service) => {
                                    const isSelected = services.some((item) => item.id === service.id)
                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => onToggleService(service.id)}
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                                                isSelected
                                                    ? "border-blue-300 bg-blue-50 text-blue-700"
                                                    : "border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                                            )}
                                        >
                                            {service.serviceName}
                                            {isSelected && <Check className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div>
                            <StatusChip tone="oneTime" size="xs" className="mb-2">One-time</StatusChip>
                            <div className="mt-2 space-y-2">
                                {oneTimeServices.map((service) => {
                                    const isSelected = services.some((item) => item.id === service.id)
                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => onToggleService(service.id)}
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                                                isSelected
                                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                    : "border-[var(--line-subtle)] bg-[var(--surface-low)] text-[var(--text-secondary)] hover:border-[color:color-mix(in_srgb,var(--line-subtle)_70%,var(--text-muted)_30%)]"
                                            )}
                                        >
                                            {service.serviceName}
                                            {isSelected && <Check className="h-4 w-4" />}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
