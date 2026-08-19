"use client"

import * as React from "react"
import { ArrowUpRight, Check, FolderOpen, Globe, X } from "lucide-react"
import { cn } from "@/lib/utils"
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
    onToggleService,
    recurringServices,
    oneTimeServices,
}: ProjectSheetInfoSectionProps) {
    return (
        <section className="space-y-4 border-t border-[var(--line-subtle)] pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={onOpenPartner}
                    className="group flex h-[68px] w-full items-center justify-between rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 text-left shadow-xs transition-all duration-200 hover:border-[color:color-mix(in_srgb,var(--line-subtle)_60%,var(--brand-cyan)_40%)]"
                >
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Partner</span>
                        <p className="truncate text-sm font-bold text-[var(--text-primary)]">{partnerName}</p>
                    </div>
                    <FolderOpen className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:text-[var(--text-primary)]" />
                </button>

                <div className="flex h-[68px] w-full items-center justify-between rounded-[16px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-3.5 shadow-xs">
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Domain</span>
                        <button
                            type="button"
                            onClick={onOpenSitePanel}
                            className="block truncate text-left text-sm font-bold text-[var(--text-primary)] transition hover:text-[var(--brand-primary)]"
                            title="Open site panel"
                        >
                            {domainName}
                        </button>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-1.5">
                        {externalSiteUrl ? (
                            <a
                                href={externalSiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-lowest)] hover:text-[var(--text-primary)]"
                                title="Open website in new tab"
                            >
                                <span>Visit</span>
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={onOpenSitePanel}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--text-muted)]"
                            >
                                <Globe className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-[18px] border border-[var(--line-subtle)] bg-[var(--surface-lowest)] p-4">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--text-muted)]">Services</span>
                    {isEditingServices ? (
                        <span className="text-xs font-medium text-[var(--text-muted)]">Select at least one</span>
                    ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    {services.map((service) => isEditingServices ? (
                        <button
                            key={service.id}
                            type="button"
                            onClick={() => onToggleService(service.id)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100/70"
                        >
                            {service.serviceName}
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <span key={service.id} className="inline-flex min-h-8 items-center rounded-[8px] border border-[var(--line-subtle)] bg-[var(--surface-low)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                            {service.serviceName}
                        </span>
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
